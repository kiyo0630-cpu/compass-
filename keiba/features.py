#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
レース一覧成績（data/history/*.csv, cp932）から分析テーブルを作る。v2

- 補正タイム: 走破タイム を コース / クラス / 日別馬場 / 馬齢 / 斤量 / **馬（能力）** の固定効果で交互中心化。
  馬効果を入れることで斤量・馬場の係数が能力と交絡しなくなる。
  特徴量に使う「その走のパフォーマンス」= 走破タイム − (馬以外の効果) で、能力 + 当日の出来 + 誤差を含む（負ほど速い）。
- 上がり 3F: PCI（ペース）と 4 角位置で補正した残差。
- 馬ごとの履歴特徴量は必ず「当該レースより前の走」だけで計算（shift）。
- ペース×位置取り: 前走の交互作用、今回の想定ペース（先行型の頭数）× 自身の脚質。
- レースレベル: 前走レースの (a) 上位 3 頭の補正タイム平均（前走時点で確定）、(b) 出走馬のその後の次走成績（今日より前の分だけ）。
- Elo 型レーティング: 日付順に逐次更新。レース前の値だけを特徴量にする。
出力: data/features.csv
"""
import glob, os, sys, time
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')

USE = ['年','月','日','回次','場所','日次','レース番号','レース名','クラスコード','芝・ダ','コースコード','距離','馬場状態',
       '馬名','性別','年齢','騎手名','斤量','頭数','馬番','確定着順','異常コード','着差タイム','人気順','走破タイム',
       '通過順1','通過順2','通過順3','通過順4','上がり3Fタイム','馬体重','調教師','所属地','賞金','血統登録番号','騎手コード','調教師コード',
       'レースID','父馬名','母の父馬名','生年月日','単勝オッズ','PCI','間隔',
       '前走年','前走月','前走日','前走場所','前走クラスコード','前走芝・ダ','前走距離','前走馬場状態','前走斤量','前走頭数',
       '前走確定着順','前走異常コード','前走着差タイム','前走人気順','前走走破タイム','前走通過順4','前走上がり3Fタイム','前走馬体重','前走PCI',
       '前走競走識別コード']
NUM = ['年','月','日','クラスコード','コースコード','距離','年齢','斤量','頭数','馬番','確定着順','異常コード','着差タイム','人気順',
       '走破タイム','通過順1','通過順2','通過順3','通過順4','上がり3Fタイム','馬体重','賞金','単勝オッズ','PCI','間隔',
       '前走年','前走月','前走日','前走クラスコード','前走距離','前走斤量','前走頭数','前走確定着順','前走異常コード','前走着差タイム',
       '前走人気順','前走走破タイム','前走通過順4','前走上がり3Fタイム','前走馬体重','前走PCI']

def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)

def read_all(path='history'):
    parts = []
    for f in sorted(glob.glob(os.path.join(DATA, path, '*.csv'))):
        d = pd.read_csv(f, encoding='cp932', dtype=str, usecols=lambda c: c.strip() in USE)
        d.columns = [c.strip() for c in d.columns]
        parts.append(d)
    df = pd.concat(parts, ignore_index=True)
    for c in df.columns: df[c] = df[c].str.strip()
    for c in NUM:
        if c in df: df[c] = pd.to_numeric(df[c].str.replace('"', ''), errors='coerce')
    df['date'] = pd.to_datetime(dict(year=2000 + df['年'], month=df['月'], day=df['日']), errors='coerce')
    df['year'] = df['date'].dt.year
    df['race_key'] = df['レースID'].str[:-2]
    df['prev_race_key'] = df['前走競走識別コード'].str[:-2]
    df['ran'] = (df['異常コード'] == 0) & df['確定着順'].notna() & (df['確定着順'] > 0)
    df = df.drop_duplicates('レースID').sort_values(['date', 'race_key', '馬番']).reset_index(drop=True)
    return df

# ---------- 補正タイム（馬の固定効果つき、交互中心化） ----------
def alternating_fe(y, groups: dict, xcont: dict, n_iter=40, tol=1e-4):
    """y = Σ_g effect_g + Σ_x beta_x·x + e を交互中心化で解く。effects と beta を返す。"""
    eff = {k: np.zeros(len(y)) for k in groups}
    beta = {k: 0.0 for k in xcont}
    xc = {k: v - v.mean() for k, v in xcont.items()}
    prev = y.copy()
    for it in range(n_iter):
        for k in groups:
            partial = y - sum(beta[x] * xc[x] for x in xc) - sum(v for kk, v in eff.items() if kk != k)
            eff[k] = pd.Series(partial).groupby(groups[k]).transform('mean').values
        partial = y - sum(eff.values())
        for x in xc:
            other = sum(beta[xx] * xc[xx] for xx in xc if xx != x)
            r = partial - other
            beta[x] = float(np.dot(xc[x], r - r.mean()) / np.dot(xc[x], xc[x]))
        resid = y - sum(eff.values()) - sum(beta[x] * xc[x] for x in xc)
        if np.max(np.abs(resid - prev)) < tol:
            prev = resid; break
        prev = resid
    return eff, beta, prev, it + 1

def adjusted_time(df):
    m = df['ran'] & df['走破タイム'].notna() & (df['走破タイム'] > 0) & df['距離'].notna() & df['血統登録番号'].notna()
    d = df.loc[m].copy()
    g = {
        'course': (d['場所'] + '_' + d['芝・ダ'] + '_' + d['コースコード'].astype(int).astype(str) + '_' + d['距離'].astype(int).astype(str)).values,
        'cls': (d['クラスコード'].astype(int).astype(str) + '_' + d['芝・ダ']).values,
        'day_track': (d['場所'] + '_' + d['date'].dt.strftime('%Y%m%d') + '_' + d['芝・ダ']).values,
        'age': (d['年齢'].clip(2, 7).astype(int).astype(str) + '_' + d['性別'].fillna('')).values,
        'horse': d['血統登録番号'].values,
    }
    y = d['走破タイム'].values.astype(float)
    kin = d['斤量'].fillna(d['斤量'].median()).values.astype(float)
    # 斤量の効果は距離に比例するはずなので 距離/1600 を掛けたものも同時に入れる
    x = {'kin': kin, 'kin_x_dist': kin * (d['距離'].values / 1600.0 - 1.0)}
    eff, beta, resid, it = alternating_fe(y, g, x, n_iter=60)
    log(f'補正タイム(馬FEあり): 反復 {it}, 斤量 {beta["kin"]:+.3f} 秒/kg, 斤量×距離 {beta["kin_x_dist"]:+.3f}, 残差SD {resid.std():.3f} 秒, 馬効果SD {np.std(eff["horse"]):.3f}')
    out = pd.DataFrame(index=d.index)
    # パフォーマンス = 馬効果 + 残差（= タイムから馬以外の要因を除いたもの）。負ほど速い。
    out['adj_time'] = eff['horse'] + resid
    out['day_track_eff'] = eff['day_track']
    out['horse_eff_insample'] = eff['horse']   # 診断用。特徴量には使わない（未来を含む）
    return out, beta

def adjusted_last3f(df):
    m = df['ran'] & df['上がり3Fタイム'].notna() & (df['上がり3Fタイム'] > 30) & df['PCI'].notna() & df['血統登録番号'].notna()
    d = df.loc[m].copy()
    g = {
        'course': (d['場所'] + '_' + d['芝・ダ'] + '_' + d['コースコード'].astype(int).astype(str) + '_' + d['距離'].astype(int).astype(str)).values,
        'day_track': (d['場所'] + '_' + d['date'].dt.strftime('%Y%m%d') + '_' + d['芝・ダ']).values,
        'cls': d['クラスコード'].astype(int).astype(str).values,
        'horse': d['血統登録番号'].values,
    }
    pos = (d['通過順4'] / d['頭数']).fillna(0.5).values
    pci = d['PCI'].clip(30, 70).values - 50
    y = d['上がり3Fタイム'].values.astype(float)
    x = {'pci': pci, 'pci2': pci ** 2, 'pos': pos - 0.5}
    eff, beta, resid, it = alternating_fe(y, g, x, n_iter=40)
    log(f'上がり補正(馬FEあり): PCI {beta["pci"]:+.3f}, PCI² {beta["pci2"]:+.4f}, 位置 {beta["pos"]:+.3f}, 残差SD {resid.std():.3f}')
    return pd.Series(eff['horse'] + resid, index=d.index, name='adj_last3f')

# ---------- Elo 型レーティング（日付順、レース前の値を使う） ----------
def elo_ratings(df, k_new=40.0, k_old=20.0, n_switch=6, scale=400.0):
    d = df[df['ran'] & df['血統登録番号'].notna()][['race_key', 'date', '血統登録番号', '確定着順']]
    horses, hidx = np.unique(d['血統登録番号'].values, return_inverse=True)
    rating = np.full(len(horses), 1500.0); games = np.zeros(len(horses), dtype=int)
    pre = np.empty(len(d)); pre_games = np.empty(len(d), dtype=int)
    # レースをブロックで処理
    codes, starts = pd.factorize(d['race_key'].values)[0], None
    order = np.argsort(codes, kind='stable')  # d は日付順なのでレース順も日付順
    bounds = np.r_[0, np.flatnonzero(np.diff(codes[order])) + 1, len(order)]
    fin = d['確定着順'].values
    for b in range(len(bounds) - 1):
        idx = order[bounds[b]:bounds[b + 1]]
        h = hidx[idx]; r = rating[h]; f = fin[idx]
        pre[idx] = r; pre_games[idx] = games[h]
        n = len(idx)
        if n < 2: continue
        diff = (r[None, :] - r[:, None]) / scale
        E = 1.0 / (1.0 + 10.0 ** diff)            # i が j に勝つ期待
        S = (f[:, None] < f[None, :]).astype(float) + 0.5 * (f[:, None] == f[None, :])
        np.fill_diagonal(S, 0); np.fill_diagonal(E, 0)
        K = np.where(games[h] < n_switch, k_new, k_old) / (n - 1)
        rating[h] = r + K * (S - E).sum(axis=1)
        games[h] += 1
    out = pd.DataFrame({'elo_pre': pre, 'elo_games': pre_games}, index=d.index)
    log(f'Elo: 馬 {len(horses):,}, レーティングSD {rating.std():.1f}')
    return out

# ---------- 履歴特徴量 ----------
def horse_history(df):
    d = df.sort_values(['血統登録番号', 'date', 'race_key']).copy()
    g = d.groupby('血統登録番号', sort=False)
    d['pos_pct'] = (d['通過順4'] / d['頭数']).where(d['ran'])
    d['top3_flag'] = (d['確定着順'] <= 3).astype(float).where(d['ran'])
    d['win_flag'] = (d['確定着順'] == 1).astype(float).where(d['ran'])
    ewm = lambda s: s.shift(1).ewm(alpha=0.4, ignore_na=True).mean()
    d['ewm_adj_time'] = g['adj_time'].transform(ewm)
    d['prev1_adj_time'] = g['adj_time'].shift(1)
    d['best3_adj_time'] = pd.concat([g['adj_time'].shift(i) for i in (1, 2, 3)], axis=1).min(axis=1)
    d['ewm_adj_last3f'] = g['adj_last3f'].transform(ewm)
    d['style'] = g['pos_pct'].transform(ewm)                       # 0 に近いほど先行型
    d['n_prior'] = g.cumcount()
    d['prior_top3_rate'] = g['top3_flag'].transform(lambda s: s.shift(1).expanding().mean())
    d['prior_win_rate'] = g['win_flag'].transform(lambda s: s.shift(1).expanding().mean())
    # 次走情報（レースレベル (b) 用）: この走の「次の走」の日付とパフォーマンス
    d['next_date'] = g['date'].shift(-1)
    d['next_adj_time'] = g['adj_time'].shift(-1)
    d['next_top3'] = g['top3_flag'].shift(-1)
    # 前走列（CSV 由来）
    d['prev_pos_pct'] = d['前走通過順4'] / d['前走頭数']
    d['prev_fin_pct'] = d['前走確定着順'] / d['前走頭数']
    d['prev_pop_pct'] = d['前走人気順'] / d['前走頭数']
    d['prev_margin'] = d['前走着差タイム']
    d['prev_pci'] = d['前走PCI']
    d['class_change'] = d['クラスコード'] - d['前走クラスコード']
    d['dist_change'] = (d['距離'] - d['前走距離']) / 400.0
    d['surface_change'] = (d['芝・ダ'] != d['前走芝・ダ']).astype(float).where(d['前走芝・ダ'].notna())
    d['interval_w'] = d['間隔']
    # ペース × 位置取り（前走）: ハイペース(PCI 低)で前にいた / スロー(PCI 高)で後ろにいた ほど「不利」= 正
    d['prev_pace_pos'] = -((d['prev_pci'] - 50) / 5.0) * (0.5 - d['prev_pos_pct'])
    return d

def race_context(d):
    """今回のレース内で決まる文脈: 想定ペース（先行型の頭数）× 自身の脚質。"""
    front = (d['style'] < 0.3).astype(float).where(d['style'].notna())
    d['n_front'] = front.groupby(d['race_key']).transform('sum')
    d['n_front_z'] = d['n_front'] - d['n_front'].groupby(d['race_key']).transform('mean')
    # 先行型(style 小)は逃げ候補が少ないほど有利 → style と n_front の積（符号は学習に任せる）
    d['style_x_front'] = (0.5 - d['style']) * (d['n_front'] - 2.0)
    return d

def race_level(d):
    """前走レースのレベル。(a) 前走の上位 3 頭の補正タイム平均（前走時点で確定）。
    (b) 前走の出走馬たちの「次走」成績のうち、今日より前に行われた分の平均。"""
    starts = d[d['ran'] & d['adj_time'].notna()][['race_key', 'adj_time', '確定着順', 'next_date', 'next_adj_time', 'next_top3']]
    top3 = starts[starts['確定着順'] <= 3].groupby('race_key')['adj_time'].mean().rename('prev_race_top3_adj')
    d = d.join(top3, on='prev_race_key')
    # (b) 多対多の結合は大きいので必要列だけ
    q = d[d['prev_race_key'].notna()][['prev_race_key', 'date']].reset_index().rename(columns={'index': 'rid'})
    s = starts[['race_key', 'next_date', 'next_adj_time', 'next_top3']].dropna(subset=['next_date'])
    m = q.merge(s, left_on='prev_race_key', right_on='race_key', how='inner')
    m = m[m['next_date'] < m['date']]
    agg = m.groupby('rid').agg(prev_race_next_adj=('next_adj_time', 'mean'), prev_race_next_top3=('next_top3', 'mean'), prev_race_next_n=('next_top3', 'size'))
    d = d.join(agg)
    log(f'レースレベル: (a) あり {d["prev_race_top3_adj"].notna().mean():.1%}, (b) あり {d["prev_race_next_n"].notna().mean():.1%}, (b) 平均件数 {d["prev_race_next_n"].mean():.1f}')
    return d

def build():
    log('読込')
    df = read_all()
    log(f'行数 {len(df):,} レース数 {df["race_key"].nunique():,}')
    at, beta = adjusted_time(df)
    df = df.join(at)
    df = df.join(adjusted_last3f(df))
    df = df.join(elo_ratings(df))
    df = horse_history(df)
    df = race_context(df)
    df = race_level(df)
    r = df['ran'] & df['単勝オッズ'].notna() & (df['単勝オッズ'] > 0)
    inv = 1.0 / df.loc[r, '単勝オッズ']
    df.loc[r, 'pm'] = inv / inv.groupby(df.loc[r, 'race_key']).transform('sum')
    df['win'] = (df['確定着順'] == 1).astype(int)
    df['top3'] = (df['確定着順'] <= 3).astype(int)
    df = df.sort_values(['date', 'race_key', '馬番'])
    out = os.path.join(DATA, 'features.csv')
    df.to_csv(out, index=False, encoding='utf-8')
    log('書き出し', out)
    return df

if __name__ == '__main__':
    build()
