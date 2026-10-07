#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TARGET 出馬表 CSV（1 ファイル = 1 レース、着順列あり）をまとめて読み、
ZI / マイニング（タイム型 DM）/ 対戦型マイニング（TM）に
「市場（単勝オッズ）を超える情報」があるかを測る。

使い方:
  python3 eval_indices.py <CSV のあるフォルダ>  [--enc cp932]

出力:
  1. 各指数と人気・着順の順位相関（レース平均）
  2. 条件付きロジット: 市場のみ vs 市場 + 指数 の対数尤度・擬似 R²（leave-one-year-out ではなく全体。レース数が増えたら時系列分割に変える）
  3. 単純ルールの回収率: 「指数順位が人気より k 以上高い馬」の単勝・複勝回収率と信頼区間
依存: numpy, pandas のみ
"""
import sys, glob, os, re, argparse
import numpy as np
import pandas as pd

# ---------- 読み込み ----------
def to_num(x):
    if x is None: return np.nan
    s = str(x).strip().replace('>', '').replace('+', '').replace('*', '').replace('万', '')
    s = s.replace(' ', '')
    if s in ('', '--', '-', '―'): return np.nan
    try: return float(s)
    except ValueError: return np.nan

COLMAP = {  # TARGET の列名 → 内部名（先頭スペースの揺れを吸収）
    '単勝': 'odds', '人気': 'pop', '複勝下限': 'pl_lo', '複勝上限': 'pl_hi',
    'ZI': 'zi', 'ZI順': 'zi_r', 'ZI印': 'zi_flag',
    'マイニング': 'dm', 'マイニング順位': 'dm_r',
    '対戦型マイニング': 'tm', '対戦型マイニング順位': 'tm_r',
    '着順': 'fin', '馬番': 'umaban', '番': 'umaban', '馬名S': 'name', '馬名': 'name',
    '斤量': 'kinryo', 'キャリア': 'career', '間隔': 'interval', '本賞金': 'prize', '1走当賞': 'prize_per',
}

def load_dir(path, enc):
    races = []
    for fp in sorted(glob.glob(os.path.join(path, '*.csv'))):
        try:
            df = pd.read_csv(fp, encoding=enc, dtype=str)
        except UnicodeDecodeError:
            df = pd.read_csv(fp, encoding='utf-8', dtype=str)
        df.columns = [c.strip() for c in df.columns]
        # 着順が 2 列ある形式（末尾の着順を採用）
        cols = list(df.columns)
        if cols.count('着順') > 1:
            df = df.loc[:, ~pd.Index(cols).duplicated(keep='last')]
        ren = {c: COLMAP[c] for c in df.columns if c in COLMAP}
        df = df.rename(columns=ren)
        need = ['odds', 'pop', 'fin']
        if any(c not in df.columns for c in need):
            print(f'[skip] 必要列なし: {fp}'); continue
        for c in ['odds', 'pop', 'pl_lo', 'pl_hi', 'zi', 'zi_r', 'dm', 'dm_r', 'tm', 'tm_r', 'fin', 'career', 'interval', 'prize', 'prize_per']:
            if c in df.columns: df[c] = df[c].map(to_num)
        df = df[df['fin'].notna() & df['odds'].notna()].copy()   # 取消・除外は除く
        if len(df) < 5: continue
        df['race'] = os.path.basename(fp)
        df['class_up'] = df['zi_flag'].astype(str).str.contains('>') if 'zi_flag' in df else False
        df['prev_higher'] = df['zi_flag'].astype(str).str.contains(r'\+') if 'zi_flag' in df else False
        races.append(df)
    if not races:
        sys.exit('CSV が読めませんでした')
    return pd.concat(races, ignore_index=True)

# ---------- 市場確率 ----------
def market_prob(df):
    inv = 1.0 / df['odds']
    return inv / inv.groupby(df['race']).transform('sum')

# ---------- 条件付きロジット（レース内 softmax） ----------
def race_softmax(score, race):
    s = pd.Series(score, index=race.index)
    m = s.groupby(race).transform('max')
    e = np.exp(s - m)
    return e / e.groupby(race).transform('sum')

def fit_clogit(X, y, race, iters=3000, lr=0.05, l2=1e-4):
    """X: (n,k) 特徴量, y: 1着=1。レース内 softmax の対数尤度を勾配上昇で最大化。"""
    X = np.asarray(X, float); y = np.asarray(y, float)
    k = X.shape[1]; w = np.zeros(k)
    for _ in range(iters):
        p = race_softmax(X @ w, race).values
        grad = X.T @ (y - p) - l2 * w
        w += lr * grad / len(np.unique(race))
    p = race_softmax(X @ w, race).values
    ll = float(np.sum(y * np.log(np.clip(p, 1e-12, 1))))
    return w, ll, p

def loglik_uniform(df):
    n = df.groupby('race').size()
    return float(-np.sum(np.log(n)))

def zscore_in_race(v, race):
    g = v.groupby(race)
    sd = g.transform('std').replace(0, np.nan)
    return ((v - g.transform('mean')) / sd).fillna(0)

# ---------- 回収率 ----------
def roi(stake_mask, payoff):
    n = int(stake_mask.sum())
    if n == 0: return np.nan, np.nan, 0
    r = payoff[stake_mask].values
    mean = r.mean(); se = r.std(ddof=1) / np.sqrt(n) if n > 1 else np.nan
    return mean, se, n

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('path'); ap.add_argument('--enc', default='cp932')
    a = ap.parse_args()
    df = load_dir(a.path, a.enc)
    nR = df['race'].nunique()
    print(f'レース数 {nR}, 馬数 {len(df)}')
    df['pm'] = market_prob(df)
    df['win'] = (df['fin'] == 1).astype(int)
    df['place'] = (df['fin'] <= 3).astype(int)   # 7 頭以下は 2 着内に直すこと
    df['pop_r'] = df.groupby('race')['odds'].rank(method='first')

    # 1. 順位相関
    print('\n[1] 順位相関（Spearman, レース平均）  指数順位 vs 人気 / vs 着順')
    for c, lab in [('zi_r', 'ZI順'), ('dm_r', 'DM順(タイム型)'), ('tm_r', 'TM順(対戦型)'), ('pop_r', '人気')]:
        if c not in df: continue
        rp = df.groupby('race').apply(lambda g: g[c].rank().corr(g['pop_r'].rank()), include_groups=False).mean()
        rf = df.groupby('race').apply(lambda g: g[c].rank().corr(g['fin'].rank()), include_groups=False).mean()
        print(f'  {lab:14s} vs人気 {rp:+.2f}   vs着順 {rf:+.2f}')

    # 2. 条件付きロジット
    print('\n[2] 条件付きロジット: 1着の対数尤度（大きいほど良い）と擬似R²')
    ll0 = loglik_uniform(df)
    feats = {'市場のみ': ['lpm']}
    df['lpm'] = np.log(df['pm'])
    df['zi_z'] = zscore_in_race(df['zi'], df['race']) if 'zi' in df else 0
    df['dm_z'] = -zscore_in_race(df['dm'], df['race']) if 'dm' in df else 0   # タイムは小さいほど良い
    df['tm_z'] = zscore_in_race(df['tm'], df['race']) if 'tm' in df else 0
    for name, extra in [('ZI', ['zi_z']), ('DM', ['dm_z']), ('TM', ['tm_z']), ('ZI+DM+TM', ['zi_z', 'dm_z', 'tm_z'])]:
        feats['市場+' + name] = ['lpm'] + extra
    base_ll = None
    for name, cols in feats.items():
        w, ll, p = fit_clogit(df[cols].values, df['win'].values, df['race'])
        r2 = 1 - ll / ll0
        if base_ll is None: base_ll = ll
        print(f'  {name:12s} LL={ll:9.2f}  擬似R²={r2:.4f}  ΔLL(対市場)={ll-base_ll:+.3f}  係数={np.round(w,3)}')
    print('  目安: ΔLL は「1レースあたり」ではなく合計。レース数×0.003 以上が継続して出れば Benter 級。')
    print('  注意: 全データで当てはめているので楽観的。レース数が 1,000 を超えたら年で分割して out-of-sample にすること。')

    # 3. 単純ルールの回収率
    print('\n[3] 単純ルール: 指数順位が人気順位より k 以上「良い」馬を買う（単勝・複勝 100 円）')
    df['pay_win'] = np.where(df['win'] == 1, df['odds'] * 100, 0)
    # 複勝の実払戻は不明なので下限〜上限の中点で近似（本番は HR の払戻を使う）
    pl_mid = (df['pl_lo'] + df['pl_hi']) / 2 if 'pl_lo' in df else np.nan
    df['pay_place'] = np.where(df['place'] == 1, pl_mid * 100, 0)
    allw, allse, n = roi(df['odds'] > 0, df['pay_win']); print(f'  全馬ベタ買い 単勝 回収率 {allw:.1f}% (±{allse:.1f}) n={n}')
    for c, lab in [('zi_r', 'ZI'), ('dm_r', 'DM'), ('tm_r', 'TM')]:
        if c not in df: continue
        for k in (3, 5):
            m = (df['pop_r'] - df[c] >= k) & (df['odds'] <= 50)
            mw, sew, n = roi(m, df['pay_win']); mp, sep, _ = roi(m, df['pay_place'])
            print(f'  {lab} 順位が人気より{k}以上良い & 50倍以下: 単勝 {mw:.1f}% (±{sew:.1f})  複勝≈{mp:.1f}% (±{sep:.1f})  n={n}')
    if 'class_up' in df:
        m = df['class_up']; mw, sew, n = roi(m, df['pay_win']); print(f'  昇級戦(ZI印 ">"): 単勝 {mw:.1f}% (±{sew:.1f}) n={n}')
        m = df['prev_higher']; mw, sew, n = roi(m, df['pay_win']); print(f'  前走格上(ZI印 "+"): 単勝 {mw:.1f}% (±{sew:.1f}) n={n}')
    print('\n判定の目安: 回収率の ± は 1σ。単勝で 95% と 100% を区別するには 1 万口規模が必要。まず [2] の ΔLL を見る。')

if __name__ == '__main__':
    main()
