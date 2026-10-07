#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
レース一覧成績（history/*.csv, cp932）から分析テーブルを作る。
- 補正タイム: 走破タイム を コース(場所×芝ダ×コース区分×距離) / クラス / 日別馬場(場所×日×芝ダ) / 斤量 / 馬齢 で
  交互に中心化（固定効果の alternating projections）し、残差 = その走のパフォーマンス（負ほど速い）
- 馬ごとの過去走からの特徴量は、必ず「当該レースより前の走」だけで計算する（shift）
出力: features.parquet（pyarrow が無ければ csv）
"""
import glob, os, sys
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')   # history/*.csv と出力の置き場所（git 管理外）

def read_all(path='history'):
    use = ['年','月','日','回次','場所','日次','レース番号','レース名','クラスコード','芝・ダ','コースコード','距離','馬場状態',
           '馬名','性別','年齢','騎手名','斤量','頭数','馬番','確定着順','異常コード','着差タイム','人気順','走破タイム',
           '通過順1','通過順2','通過順3','通過順4','上がり3Fタイム','馬体重','調教師','所属地','賞金','血統登録番号','騎手コード','調教師コード',
           'レースID','父馬名','母の父馬名','生年月日','単勝オッズ','PCI','間隔',
           '前走年','前走月','前走日','前走場所','前走クラスコード','前走芝・ダ','前走距離','前走馬場状態','前走斤量','前走頭数',
           '前走確定着順','前走異常コード','前走着差タイム','前走人気順','前走走破タイム','前走通過順4','前走上がり3Fタイム','前走馬体重','前走PCI']
    parts = []
    for f in sorted(glob.glob(os.path.join(DATA, path, '*.csv'))):
        d = pd.read_csv(f, encoding='cp932', dtype=str, usecols=lambda c: c.strip() in use)
        d.columns = [c.strip() for c in d.columns]
        parts.append(d)
    df = pd.concat(parts, ignore_index=True)
    for c in df.columns: df[c] = df[c].str.strip()
    num = ['年','月','日','クラスコード','コースコード','距離','年齢','斤量','頭数','馬番','確定着順','異常コード','着差タイム','人気順',
           '走破タイム','通過順1','通過順2','通過順3','通過順4','上がり3Fタイム','馬体重','賞金','単勝オッズ','PCI','間隔',
           '前走年','前走月','前走日','前走クラスコード','前走距離','前走斤量','前走頭数','前走確定着順','前走異常コード','前走着差タイム',
           '前走人気順','前走走破タイム','前走通過順4','前走上がり3Fタイム','前走馬体重','前走PCI']
    for c in num:
        if c in df: df[c] = pd.to_numeric(df[c].str.replace('"', ''), errors='coerce')
    df['date'] = pd.to_datetime(dict(year=2000 + df['年'], month=df['月'], day=df['日']), errors='coerce')
    df['year'] = df['date'].dt.year
    df['race_key'] = df['レースID'].str[:-2]
    df['ran'] = (df['異常コード'] == 0) & df['確定着順'].notna() & (df['確定着順'] > 0)
    return df

# ---------- 補正タイム（固定効果の交互中心化） ----------
def adjusted_time(df, n_iter=25):
    """走破タイム（秒）を複数の固定効果で説明し、残差を返す。対象は正常出走かつタイムあり。"""
    m = df['ran'] & df['走破タイム'].notna() & (df['走破タイム'] > 0) & df['距離'].notna()
    d = df.loc[m, ['走破タイム','場所','芝・ダ','コースコード','距離','クラスコード','date','斤量','年齢','馬場状態']].copy()
    d['course'] = d['場所'] + '_' + d['芝・ダ'] + '_' + d['コースコード'].astype(int).astype(str) + '_' + d['距離'].astype(int).astype(str)
    d['cls'] = d['クラスコード'].astype(int).astype(str) + '_' + d['芝・ダ']
    d['day_track'] = d['場所'] + '_' + d['date'].dt.strftime('%Y%m%d') + '_' + d['芝・ダ']
    d['age'] = d['年齢'].clip(2, 7).astype(int).astype(str) + '_' + d['芝・ダ']
    # 連続変数: 斤量（距離で効果が変わるので距離比にはせず単純に）
    y = d['走破タイム'].values.astype(float)
    kin = d['斤量'].fillna(d['斤量'].median()).values.astype(float)
    kin_c = kin - kin.mean()
    # 速度に直すほうが距離間で安定するが、ここではコース固定効果が距離を含むので秒のまま
    effects = {k: np.zeros(len(d)) for k in ['course', 'cls', 'day_track', 'age']}
    beta_kin = 0.0
    resid = y.copy()
    groups = {k: d[k].values for k in effects}
    for it in range(n_iter):
        for k in effects:
            partial = y - beta_kin * kin_c - sum(v for kk, v in effects.items() if kk != k)
            means = pd.Series(partial).groupby(groups[k]).transform('mean').values
            effects[k] = means
        partial = y - sum(effects.values())
        beta_kin = float(np.dot(kin_c, partial - partial.mean()) / np.dot(kin_c, kin_c))
        new_resid = y - beta_kin * kin_c - sum(effects.values())
        if np.max(np.abs(new_resid - resid)) < 1e-4: resid = new_resid; break
        resid = new_resid
    out = pd.DataFrame(index=d.index)
    out['adj_time'] = resid                 # 負ほど速い（コース・クラス・馬場・斤量・馬齢を除いた残差、秒）
    out['day_track_eff'] = effects['day_track'] - pd.Series(effects['day_track']).groupby(groups['course']).transform('mean').values
    out['cls_eff'] = effects['cls']
    print(f'補正タイム: 反復 {it+1}, 斤量係数 {beta_kin:.3f} 秒/kg, 残差SD {resid.std():.3f} 秒')
    return out

# ---------- 上がり 3F の文脈化 ----------
def adjusted_last3f(df):
    m = df['ran'] & df['上がり3Fタイム'].notna() & (df['上がり3Fタイム'] > 30) & df['PCI'].notna()
    d = df.loc[m, ['上がり3Fタイム','場所','芝・ダ','コースコード','距離','date','PCI','通過順4','頭数','クラスコード']].copy()
    d['course'] = d['場所'] + '_' + d['芝・ダ'] + '_' + d['コースコード'].astype(int).astype(str) + '_' + d['距離'].astype(int).astype(str)
    d['day_track'] = d['場所'] + '_' + d['date'].dt.strftime('%Y%m%d') + '_' + d['芝・ダ']
    d['cls'] = d['クラスコード'].astype(int).astype(str)
    pos = (d['通過順4'] / d['頭数']).fillna(0.5).values
    pci = d['PCI'].clip(30, 70).values
    y = d['上がり3Fタイム'].values.astype(float)
    X = np.column_stack([np.ones(len(d)), pci - 50, (pci - 50) ** 2, pos - 0.5])
    # 固定効果（course, day_track, cls）を先に中心化してから回帰
    e = {k: np.zeros(len(d)) for k in ['course', 'day_track', 'cls']}
    beta = np.zeros(X.shape[1]); groups = {k: d[k].values for k in e}
    for it in range(20):
        for k in e:
            partial = y - X @ beta - sum(v for kk, v in e.items() if kk != k)
            e[k] = pd.Series(partial).groupby(groups[k]).transform('mean').values
        partial = y - sum(e.values())
        beta = np.linalg.lstsq(X, partial, rcond=None)[0]
    resid = y - X @ beta - sum(e.values())
    print(f'上がり補正: PCI係数 {beta[1]:.3f}, 位置取り係数 {beta[3]:.3f}, 残差SD {resid.std():.3f}')
    return pd.Series(resid, index=d.index, name='adj_last3f')

# ---------- 馬ごとの履歴特徴量（当該レースより前のみ） ----------
def horse_history(df):
    d = df.sort_values(['血統登録番号', 'date', 'race_key']).copy()
    g = d.groupby('血統登録番号', sort=False)
    # 直前走までの値を shift で参照する
    for col in ['adj_time', 'adj_last3f', 'perf_rank']:
        d[f'prev1_{col}'] = g[col].shift(1)
        d[f'prev2_{col}'] = g[col].shift(2)
        d[f'prev3_{col}'] = g[col].shift(3)
    d['n_prior'] = g.cumcount()
    # 過去走の指数移動平均（減衰 0.6）
    def ewm_prev(s):
        return s.shift(1).ewm(alpha=0.4, ignore_na=True).mean()
    d['ewm_adj_time'] = g['adj_time'].transform(ewm_prev)
    d['best3_adj_time'] = d[['prev1_adj_time', 'prev2_adj_time', 'prev3_adj_time']].min(axis=1)
    d['mean3_adj_time'] = d[['prev1_adj_time', 'prev2_adj_time', 'prev3_adj_time']].mean(axis=1)
    d['trend_adj_time'] = d['prev1_adj_time'] - d['prev3_adj_time']
    d['ewm_adj_last3f'] = g['adj_last3f'].transform(ewm_prev)
    # 過去の着順率
    d['top3_flag'] = (d['確定着順'] <= 3).astype(float).where(d['ran'])
    d['prior_top3_rate'] = g['top3_flag'].transform(lambda s: s.shift(1).expanding().mean())
    d['prior_win_rate'] = g['確定着順'].transform(lambda s: (s.shift(1) == 1).expanding().mean())
    # 前走情報（CSV の前走列から）
    d['prev_pos_pct'] = d['前走通過順4'] / d['前走頭数']
    d['prev_fin_pct'] = d['前走確定着順'] / d['前走頭数']
    d['prev_pci'] = d['前走PCI']
    d['prev_margin'] = d['前走着差タイム']
    d['prev_pop'] = d['前走人気順']
    d['prev_pop_pct'] = d['前走人気順'] / d['前走頭数']
    d['class_change'] = d['クラスコード'] - d['前走クラスコード']
    d['dist_change'] = d['距離'] - d['前走距離']
    d['surface_change'] = (d['芝・ダ'] != d['前走芝・ダ']).astype(float).where(d['前走芝・ダ'].notna())
    d['interval_w'] = d['間隔']
    d['weight_change'] = d['馬体重'] - d['前走馬体重']   # 当日のみ利用可
    # 展開不利: 前走ハイペース(PCI 低)で先行(位置 < 0.3)、または スロー(PCI 高)で後方(位置 > 0.7)
    d['prev_unlucky_front'] = ((d['prev_pci'] < 45) & (d['prev_pos_pct'] < 0.3)).astype(float)
    d['prev_unlucky_back'] = ((d['prev_pci'] > 53) & (d['prev_pos_pct'] > 0.7)).astype(float)
    return d

def build():
    df = read_all()
    print('行数', len(df), 'レース数', df['race_key'].nunique())
    at = adjusted_time(df)
    df = df.join(at)
    df = df.join(adjusted_last3f(df))
    # レース内パフォーマンス順位（残差ベース）
    df['perf_rank'] = df.groupby('race_key')['adj_time'].rank(pct=True)
    df = horse_history(df)
    # 市場確率（確定単勝オッズ。前日オッズが来たら差し替え）
    r = df['ran'] & df['単勝オッズ'].notna() & (df['単勝オッズ'] > 0)
    inv = 1.0 / df.loc[r, '単勝オッズ']
    df.loc[r, 'pm'] = inv / inv.groupby(df.loc[r, 'race_key']).transform('sum')
    df['win'] = (df['確定着順'] == 1).astype(int)
    df['top3'] = (df['確定着順'] <= 3).astype(int)
    out = os.path.join(DATA, 'features.parquet')
    try:
        df.to_parquet(out, index=False)
    except Exception as e:
        out = out.replace('.parquet', '.csv'); df.to_csv(out, index=False, encoding='utf-8')
    print('書き出し', out)
    return df

if __name__ == '__main__':
    build()
