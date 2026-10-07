#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v2: 条件付きロジット（単勝）と 3 着内モデルのウォークフォワード検証。
  学習 = テスト年より前の全年、テスト = その年（2020〜2026）。
  単勝:   A 市場のみ / B 市場+特徴量 / C 特徴量のみ（レース内 softmax）
  3着内:  Harville 式で市場の勝率から作った 3 着内確率（割引指数 λ を学習年で推定）を基準に、
          特徴量を足した二値ロジットが対数尤度を改善するか。
係数は Hessian 由来の標準誤差つきで出力し、年をまたいだ安定性を見る。
依存: numpy, pandas
"""
import os, sys
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
RESULTS = os.path.join(HERE, 'results')

# 統合後の特徴量（相関の高いものは 1 本に）
FEATS = {
    'ewm_adj_time':        '補正タイムの指数移動平均（過去走）',
    'best3_adj_time':      '直近 3 走の最良補正タイム',
    'ewm_adj_last3f':      '文脈化した上がり 3F の指数移動平均',
    'elo_pre':             '着差つき Elo レーティング（レース前）',
    'prior_top3_rate':     '過去の複勝率',
    'n_prior_log':         'log(1+出走回数)',
    'prev_fin_pct':        '前走 着順/頭数',
    'prev_pop_pct':        '前走 人気/頭数',
    'prev_margin':         '前走 着差',
    'dev_hi_front':        '前走ハイペースを先行（不利）',
    'dev_hi_back':         '前走ハイペースを後方（有利）',
    'dev_slow_front':      '前走スローを先行（有利）',
    'dev_slow_back':       '前走スローを後方（不利）',
    'style_x_front':       '脚質×今回の先行型頭数',
    'layoff':              '休み明け（10 週以上）',
    'prev_race_top3_adj':  'レースレベル(a): 前走上位 3 頭の補正タイム',
    'prev_race_next_adj':  'レースレベル(b): 前走出走馬の次走成績',
    'class_change':        'クラス変化（正=昇級）',
    'dist_change':         '距離変化（400m 単位）',
    'surface_change':      '芝ダ替わり',
    'interval_log':        'log(間隔週)',
    '年齢':                '馬齢',
    '斤量':                '斤量',
    '馬番':                '馬番',
}

def load():
    df = pd.read_csv(os.path.join(DATA, 'features.csv'), low_memory=False)
    df = df[df['ran'] & df['pm'].notna()].copy()
    df['date'] = pd.to_datetime(df['date'])
    df['n_prior_log'] = np.log1p(df['n_prior'])
    df['interval_log'] = np.log1p(df['interval_w'].clip(0, 200))
    return df.sort_values(['date', 'race_key', '馬番']).reset_index(drop=True)

def prep(df):
    """レース内 z 標準化。欠測は 0（= レース平均）で埋め、履歴なしフラグを 1 本だけ持つ。"""
    X = pd.DataFrame(index=df.index)
    rk = df['race_key']
    for f in FEATS:
        v = df[f].astype(float)
        mu = v.groupby(rk).transform('mean'); sd = v.groupby(rk).transform('std').replace(0, np.nan)
        X[f] = ((v - mu) / sd).fillna(0).clip(-4, 4)
    X['no_history'] = df['ewm_adj_time'].isna().astype(float)
    X['no_prev_race'] = df['prev_race_top3_adj'].isna().astype(float)
    X['lpm'] = np.log(df['pm'].clip(1e-5, 1))
    return X

def race_codes(race_key):
    codes = pd.factorize(race_key)[0]
    return codes, codes.max() + 1

def softmax_by_race(s, codes, nR):
    m = np.full(nR, -np.inf); np.maximum.at(m, codes, s)
    e = np.exp(s - m[codes]); den = np.zeros(nR); np.add.at(den, codes, e)
    return e / den[codes]

def fit_clogit(X, y, codes, nR, l2=1e-3, iters=40):
    n, k = X.shape; w = np.zeros(k)
    for it in range(iters):
        p = softmax_by_race(X @ w, codes, nR)
        grad = X.T @ (y - p) - l2 * w
        Xp = X * p[:, None]; H = Xp.T @ X
        xbar = np.zeros((nR, k)); np.add.at(xbar, codes, Xp); H -= xbar.T @ xbar; H += l2 * np.eye(k)
        step = np.linalg.solve(H, grad); w += step
        if np.max(np.abs(step)) < 1e-7: break
    se = np.sqrt(np.diag(np.linalg.inv(H)))
    return w, se

def ll_clogit(X, w, y, codes, nR):
    p = softmax_by_race(X @ w, codes, nR)
    return float(np.sum(y * np.log(np.clip(p, 1e-12, 1)))), p

# ---------- 3 着内: Harville（割引つき） ----------
def harville_place3(p, codes, nR, lam=1.0):
    """各馬の 3 着内確率（Harville 式、割引指数 λ）。
    1 着確率は p、2・3 着の条件付き確率には q = p^λ（正規化）を使う。λ<1 で本命の 3 着内確率の過大評価を抑える。
    レース内を n×n 行列で一括計算する。"""
    out = np.zeros(len(p))
    order = np.argsort(codes, kind='stable')
    bounds = np.r_[0, np.flatnonzero(np.diff(codes[order])) + 1, len(order)]
    for b in range(len(bounds) - 1):
        idx = order[bounds[b]:bounds[b + 1]]
        pi = p[idx]; pi = pi / pi.sum(); n = len(idx)
        if n <= 3: out[idx] = 1.0; continue
        q = pi ** lam; q = q / q.sum()
        a = pi / (1.0 - q)                                   # a_i = P(i 1着)/(1-q_i)
        P2 = q * (a.sum() - a)                               # Σ_{i≠j} p_i q_j/(1-q_i)
        denom = 1.0 - q[:, None] - q[None, :]
        np.fill_diagonal(denom, 1.0)
        M = q[None, :] / denom                               # M_ij = q_j/(1-q_i-q_j), i≠j
        np.fill_diagonal(M, 0.0)
        R = M.sum(axis=1)                                    # R_i = Σ_{j≠i} M_ij
        T = float(np.dot(a, R))
        P3 = q * (T - a * R - (a @ M))                       # q_k [Σ_i a_i R_i − a_k R_k − Σ_{i≠k} a_i M_ik]
        out[idx] = np.clip(pi + P2 + P3, 1e-6, 1 - 1e-6)
    return out

def fit_logit(X, y, l2=1e-3, iters=40):
    n, k = X.shape; w = np.zeros(k)
    for it in range(iters):
        z = X @ w; p = 1 / (1 + np.exp(-z))
        grad = X.T @ (y - p) - l2 * w
        H = (X * (p * (1 - p))[:, None]).T @ X + l2 * np.eye(k)
        step = np.linalg.solve(H, grad); w += step
        if np.max(np.abs(step)) < 1e-7: break
    return w, np.sqrt(np.diag(np.linalg.inv(H)))

def ll_logit(X, w, y):
    p = 1 / (1 + np.exp(-(X @ w))); p = np.clip(p, 1e-9, 1 - 1e-9)
    return float(np.sum(y * np.log(p) + (1 - y) * np.log(1 - p))), p

def main():
    df = load(); X = prep(df)
    y = df['win'].values.astype(float); y3 = df['top3'].values.astype(float)
    cols_f = [c for c in X.columns if c != 'lpm']
    print(f'出走 {len(df):,}  レース {df["race_key"].nunique():,}  特徴量 {len(cols_f)}')
    rows, coef_rows, bets, place_rows, preds = [], [], [], [], []
    for ty in range(2020, 2027):
        tr = (df['year'] < ty).values; te = (df['year'] == ty).values
        ctr, nRtr = race_codes(df.loc[tr, 'race_key']); cte, nRte = race_codes(df.loc[te, 'race_key'])
        n_run = pd.Series(cte).value_counts().sort_index().values; ll0 = float(-np.sum(np.log(n_run)))
        pB = None
        for name, cols in [('A 市場のみ', ['lpm']), ('B 市場+特徴量', ['lpm'] + cols_f), ('C 特徴量のみ', cols_f)]:
            w, se = fit_clogit(X.loc[tr, cols].values, y[tr], ctr, nRtr)
            ll, p = ll_clogit(X.loc[te, cols].values, w, y[te], cte, nRte)
            rows.append(dict(year=ty, model=name, races=nRte, LL_per_race=ll / nRte, pseudoR2=1 - ll / ll0))
            if name == 'A 市場のみ':
                pA = p
            if name == 'B 市場+特徴量':
                pB = p
                keep = df.loc[te, ['race_key', 'date', 'year', '場所', 'クラスコード', '芝・ダ', '距離', '頭数', '馬番', '人気順', '単勝オッズ', 'pm', 'win', 'top3']].copy()
                keep['pA'] = pA; keep['pB'] = p
                preds.append(keep)
                for c, wv, sv in zip(cols, w, se):
                    coef_rows.append(dict(year=ty, feature=c, coef=wv, se=sv, t=wv / sv))
                d = df.loc[te, ['race_key', 'win', '単勝オッズ']].copy(); d['p'] = p; d['ev'] = d['p'] * d['単勝オッズ']
                for thr in (1.0, 1.1, 1.2):
                    m = (d['ev'] >= thr) & (d['単勝オッズ'] <= 50)
                    bets.append(dict(year=ty, thr=thr, n=int(m.sum()), roi=(d.loc[m, 'win'] * d.loc[m, '単勝オッズ']).sum() / max(m.sum(), 1) * 100))
        # ---- 3 着内 ----
        pm_tr = df.loc[tr, 'pm'].values; pm_te = df.loc[te, 'pm'].values
        best = None
        for lam in (1.0, 0.9, 0.8, 0.7, 0.6):
            ph = harville_place3(pm_tr, ctr, nRtr, lam)
            ll = float(np.sum(y3[tr] * np.log(ph) + (1 - y3[tr]) * np.log(1 - ph)))
            if best is None or ll > best[1]: best = (lam, ll)
        lam = best[0]
        ph_te = harville_place3(pm_te, cte, nRte, lam)
        ll_h = float(np.sum(y3[te] * np.log(ph_te) + (1 - y3[te]) * np.log(1 - ph_te)))
        # 市場由来 3 着内確率（ロジット）+ 特徴量 の二値ロジット
        ph_tr = harville_place3(pm_tr, ctr, nRtr, lam)
        lh_tr = np.log(ph_tr / (1 - ph_tr)); lh_te = np.log(ph_te / (1 - ph_te))
        XA_tr = np.column_stack([np.ones(tr.sum()), lh_tr]); XA_te = np.column_stack([np.ones(te.sum()), lh_te])
        wA, _ = fit_logit(XA_tr, y3[tr]); llA, _ = ll_logit(XA_te, wA, y3[te])
        XB_tr = np.column_stack([XA_tr, X.loc[tr, cols_f].values]); XB_te = np.column_stack([XA_te, X.loc[te, cols_f].values])
        wB, seB = fit_logit(XB_tr, y3[tr]); llB, p3 = ll_logit(XB_te, wB, y3[te])
        # モデル B の勝率から Harville で作った 3 着内確率（単勝モデルの転用）
        p3_from_win = harville_place3(pB, cte, nRte, lam)
        ll_w = float(np.sum(y3[te] * np.log(p3_from_win) + (1 - y3[te]) * np.log(1 - p3_from_win)))
        n3 = te.sum()
        preds[-1]['p3_market'] = ph_te; preds[-1]['p3_B'] = p3
        place_rows.append(dict(year=ty, lam=lam, LL_harville_raw=ll_h / n3, LL_A_market_logit=llA / n3, LL_B_market_feats=llB / n3,
                               LL_from_win_modelB=ll_w / n3, dLL_B_minus_A_per_horse=(llB - llA) / n3,
                               coef_market=wB[1], top3_rate=y3[te].mean()))
    res = pd.DataFrame(rows)
    piv = res.pivot(index='year', columns='model', values='LL_per_race'); piv['ΔLL/レース(B−A)'] = piv['B 市場+特徴量'] - piv['A 市場のみ']
    print('\n=== 単勝: レースあたり対数尤度 ==='); print(piv.round(4).to_string())
    print('\n=== 単勝: 擬似 R² ==='); print(res.pivot(index='year', columns='model', values='pseudoR2').round(4).to_string())
    coef = pd.DataFrame(coef_rows)
    tab = coef.pivot(index='feature', columns='year', values='t').round(1)
    tab['coef_mean'] = coef.groupby('feature')['coef'].mean().round(3)
    tab['sign_stable'] = coef.groupby('feature')['coef'].apply(lambda s: (np.sign(s) == np.sign(s.mean())).all())
    tab = tab.loc[tab['coef_mean'].abs().sort_values(ascending=False).index]
    print('\n=== モデル B 係数の t 値（年別）と平均係数、符号の安定性 ==='); print(tab.to_string())
    b = pd.DataFrame(bets); print('\n=== 単勝 期待値ベッティング（確定オッズ、50 倍以下、100 円） ===')
    print(b.pivot(index='year', columns='thr', values=['n', 'roi']).round(1).to_string())
    tot = b.groupby('thr').apply(lambda g: pd.Series({'n': g['n'].sum(), 'roi': np.average(g['roi'], weights=np.maximum(g['n'], 1))}), include_groups=False)
    print('全年合計'); print(tot.round(1).to_string())
    pl = pd.DataFrame(place_rows)
    print('\n=== 3 着内: 1 頭あたり対数尤度（大きいほど良い） ==='); print(pl.round(4).to_string(index=False))
    os.makedirs(RESULTS, exist_ok=True)
    res.to_csv(os.path.join(RESULTS, 'clogit_results.csv'), index=False)
    coef.to_csv(os.path.join(RESULTS, 'clogit_coefs.csv'), index=False)
    pl.to_csv(os.path.join(RESULTS, 'place_results.csv'), index=False)
    b.to_csv(os.path.join(RESULTS, 'win_ev_bets.csv'), index=False)
    pd.concat(preds).to_csv(os.path.join(DATA, 'predictions_test.csv'), index=False)

if __name__ == '__main__':
    main()
