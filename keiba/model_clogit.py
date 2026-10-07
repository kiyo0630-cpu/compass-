#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
条件付きロジット（レース内 softmax）で「市場確率に特徴量を足すと対数尤度が改善するか」をウォークフォワードで測る。
  - 学習: test 年より前の全年。  テスト: その年。  2020〜2026 を順に。
  - モデル A: 市場のみ  logit ∝ b·log(pm)
  - モデル B: 市場 + ファンダメンタル特徴量
  - モデル C: ファンダメンタルのみ（市場なし）
評価: レース単位の対数尤度、擬似 R²、A→B の改善（1 レースあたり）、期待値閾値での単勝回収率。
依存: numpy, pandas
"""
import os, sys
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
RESULTS = os.path.join(HERE, 'results')

FEATS = ['ewm_adj_time', 'best3_adj_time', 'mean3_adj_time', 'prev1_adj_time', 'trend_adj_time', 'ewm_adj_last3f',
         'prior_top3_rate', 'prior_win_rate', 'n_prior', 'prev_fin_pct', 'prev_pop_pct', 'prev_margin', 'prev_pos_pct',
         'class_change', 'dist_change', 'surface_change', 'interval_w', 'prev_unlucky_front', 'prev_unlucky_back',
         '年齢', '斤量', '馬番']

def load():
    df = pd.read_csv(os.path.join(DATA, 'features.csv'), low_memory=False)
    df = df[df['ran'] & df['pm'].notna()].copy()
    df['date'] = pd.to_datetime(df['date'])
    return df

def prep(df):
    """レース内で標準化（z）し、欠測は 0 で埋め + 欠測フラグ。log 市場確率も作る。"""
    X = pd.DataFrame(index=df.index)
    g = df.groupby('race_key')
    for f in FEATS:
        v = df[f].astype(float)
        if f in ('interval_w',): v = np.log1p(v.clip(0, 200))
        if f in ('n_prior',): v = np.log1p(v)
        mu = g[f].transform('mean') if False else v.groupby(df['race_key']).transform('mean')
        sd = v.groupby(df['race_key']).transform('std').replace(0, np.nan)
        z = ((v - mu) / sd)
        X[f] = z.fillna(0).clip(-4, 4)
        if v.isna().mean() > 0.01:
            X[f + '_na'] = v.isna().astype(float)
    X['lpm'] = np.log(df['pm'].clip(1e-5, 1))
    return X

def race_blocks(race_key):
    """ソート済み前提。各レースの開始・終了インデックス。"""
    codes, idx = pd.factorize(race_key)
    starts = np.r_[0, np.flatnonzero(np.diff(codes)) + 1]
    ends = np.r_[starts[1:], len(codes)]
    return codes, starts, ends

def softmax_by_race(s, codes, nR):
    m = np.full(nR, -np.inf); np.maximum.at(m, codes, s)
    e = np.exp(s - m[codes])
    den = np.zeros(nR); np.add.at(den, codes, e)
    return e / den[codes]

def fit_clogit(X, y, codes, nR, l2=1e-3, iters=30):
    """Newton 法。X: (n,k) numpy。"""
    n, k = X.shape
    w = np.zeros(k)
    for it in range(iters):
        p = softmax_by_race(X @ w, codes, nR)
        grad = X.T @ (y - p) - l2 * w
        # Hessian = -Σ_r [X_r' diag(p_r) X_r - (X_r' p_r)(X_r' p_r)']
        Xp = X * p[:, None]
        H = Xp.T @ X
        # 各レースの X_r' p_r を集計
        xbar = np.zeros((nR, k)); np.add.at(xbar, codes, Xp)
        H -= xbar.T @ xbar
        H += l2 * np.eye(k)
        step = np.linalg.solve(H, grad)
        w += step
        if np.max(np.abs(step)) < 1e-6: break
    p = softmax_by_race(X @ w, codes, nR)
    ll = float(np.sum(y * np.log(np.clip(p, 1e-12, 1))))
    return w, ll

def loglik(X, w, y, codes, nR):
    p = softmax_by_race(X @ w, codes, nR)
    return float(np.sum(y * np.log(np.clip(p, 1e-12, 1)))), p

def main():
    df = load()
    df = df.sort_values(['date', 'race_key']).reset_index(drop=True)
    X = prep(df)
    y = df['win'].values.astype(float)
    cols_f = [c for c in X.columns if c != 'lpm']
    print(f'出走 {len(df):,}  レース {df["race_key"].nunique():,}  特徴量 {len(cols_f)}')
    rows = []
    bets_all = []
    for test_year in range(2020, 2027):
        tr = (df['year'] < test_year).values; te = (df['year'] == test_year).values
        for name, cols in [('A 市場のみ', ['lpm']), ('B 市場+特徴量', ['lpm'] + cols_f), ('C 特徴量のみ', cols_f)]:
            Xtr = X.loc[tr, cols].values; Xte = X.loc[te, cols].values
            ctr, _, _ = race_blocks(df.loc[tr, 'race_key']); nRtr = ctr.max() + 1
            cte, _, _ = race_blocks(df.loc[te, 'race_key']); nRte = cte.max() + 1
            w, _ = fit_clogit(Xtr, y[tr], ctr, nRtr)
            ll, p = loglik(Xte, w, y[te], cte, nRte)
            n_run = pd.Series(cte).value_counts().sort_index().values
            ll0 = float(-np.sum(np.log(n_run)))
            rows.append(dict(year=test_year, model=name, races=nRte, LL=ll, pseudoR2=1 - ll / ll0, LL_per_race=ll / nRte))
            if name == 'B 市場+特徴量':
                w_lpm = w[0]
                rows[-1]['coef_lpm'] = w_lpm
                top = sorted(zip(cols, w), key=lambda t: -abs(t[1]))[:6]
                rows[-1]['top_coefs'] = ', '.join(f'{c}:{v:+.2f}' for c, v in top if c != 'lpm')
                # 期待値ベッティング（単勝、確定オッズ）: EV = p × オッズ
                d = df.loc[te, ['race_key', 'win', '単勝オッズ', 'pm']].copy()
                d['p'] = p; d['ev'] = d['p'] * d['単勝オッズ']
                for thr in (1.0, 1.1, 1.2):
                    m = (d['ev'] >= thr) & (d['単勝オッズ'] <= 50)
                    ret = (d.loc[m, 'win'] * d.loc[m, '単勝オッズ']).sum() / max(m.sum(), 1) * 100
                    bets_all.append(dict(year=test_year, thr=thr, n=int(m.sum()), roi=ret,
                                         hit=d.loc[m, 'win'].mean() * 100 if m.sum() else np.nan))
    res = pd.DataFrame(rows)
    piv = res.pivot(index='year', columns='model', values='LL_per_race')
    piv['ΔLL/レース (B−A)'] = piv['B 市場+特徴量'] - piv['A 市場のみ']
    print('\n=== レースあたり対数尤度（大きいほど良い） ===')
    print(piv.round(4).to_string())
    piv2 = res.pivot(index='year', columns='model', values='pseudoR2')
    print('\n=== 擬似 R² ===')
    print(piv2.round(4).to_string())
    b = res[res['model'] == 'B 市場+特徴量'][['year', 'coef_lpm', 'top_coefs']]
    print('\n=== モデル B の市場係数と主要係数 ===')
    print(b.to_string(index=False))
    bets = pd.DataFrame(bets_all)
    print('\n=== モデル B の期待値ベッティング（単勝 100 円、確定オッズ、50 倍以下） ===')
    print(bets.pivot(index='year', columns='thr', values=['n', 'roi']).round(1).to_string())
    tot = bets.groupby('thr').apply(lambda g: pd.Series({'n': g['n'].sum(), 'roi': np.average(g['roi'], weights=g['n'])}), include_groups=False)
    print('\n全年合計'); print(tot.round(1).to_string())
    res.to_csv(os.path.join(RESULTS, 'clogit_results.csv'), index=False)

if __name__ == '__main__':
    main()
