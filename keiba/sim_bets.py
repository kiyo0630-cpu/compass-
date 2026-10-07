#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
現実的な単勝ベッティングのシミュレーション（テスト年 2020〜2026、モデル B の予測値を使用）。

- 賭け対象: 新馬・重賞（G1〜G3、格付けなし重賞）・OP(L) を除く平地（未勝利、1〜3 勝、OP特別）。
  さらに「ダートのみ」「ダート 1400m 以下」の絞り込みも比較する。
- 自分の投票によるオッズ低下: 単勝プール総額 P を仮定し、
    馬 i への既存投票額 W_i = 0.8·P / オッズ_i
    自分が b 円賭けた後のオッズ = 0.8·(P + b) / (W_i + b)   （10 円単位切り捨て、下限 1.1 倍）
  P はクラス別の仮定値（未勝利・1勝 3,000 万円、2・3 勝 5,000 万円、OP特別 8,000 万円）。
  仮定の影響を見るため ×0.5 / ×1 / ×2 で感度分析する。
- 期待値の判定は「自分の投票後のオッズ」で行う。EV = p × オッズ_after ≥ 閾値。
- 資金配分: (a) 100 円均一、(b) 分数ケリー（1/4、1 レース上限 2%、年初 100 万円、年内複利）。
  ケリーは b に依存するオッズで自己整合的に解く（数回の反復）。
- 推定の不確実性: p_used = pm × (pB/pm)^α。α=1 はモデルをそのまま、α=0.7 は市場寄りに縮める。
- 評価: 年別の口数・投資額・回収額・回収率、レース単位ブートストラップによる回収率 95% 信頼区間、最大ドローダウン。

注意: オッズは確定オッズ（レース後に分かる値）なので、実運用より楽観的。前日オッズ列が来たら差し替える。
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data'); RESULTS = os.path.join(HERE, 'results')

POOL_BY_CLASS = {7: 3.0e7, 23: 3.0e7, 43: 5.0e7, 67: 5.0e7, 131: 8.0e7}   # 単勝プール総額の仮定（円）
ELIGIBLE = set(POOL_BY_CLASS)
TAKE = 0.8

def odds_after(odds, pool, b):
    """自分が b 円賭けた後の単勝オッズ（10 円単位切り捨て、下限 1.1）。"""
    w = TAKE * pool / odds
    o = TAKE * (pool + b) / (w + b)
    return np.maximum(np.floor(o * 10) / 10, 1.1)

def kelly_stake(p, odds, pool, bank, frac=0.25, cap=0.02, iters=6):
    """分数ケリー。オッズが b に依存するので反復で自己整合させる。"""
    b = 0.0
    for _ in range(iters):
        o = odds_after(odds, pool, b)
        f = (p * o - 1.0) / (o - 1.0)
        b_new = max(0.0, min(f * frac, cap)) * bank
        b_new = np.floor(b_new / 100) * 100
        if abs(b_new - b) < 100: b = b_new; break
        b = b_new
    return b, odds_after(odds, pool, b)

def bootstrap_roi(stake, ret, race_ids, n_boot=400, seed=0):
    """レース単位のブートストラップで回収率の 95% 信頼区間。"""
    rng = np.random.default_rng(seed)
    g = pd.DataFrame({'s': stake, 'r': ret, 'race': race_ids}).groupby('race').sum()
    s = g['s'].values; r = g['r'].values; n = len(g)
    if n < 5 or s.sum() == 0: return np.nan, np.nan
    rois = []
    for _ in range(n_boot):
        idx = rng.integers(0, n, n)
        rois.append(r[idx].sum() / max(s[idx].sum(), 1) * 100)
    return np.percentile(rois, 2.5), np.percentile(rois, 97.5)

def run(df, label, thr=1.10, alpha=1.0, pool_mult=1.0, mode='flat', frac=0.25, bank0=1_000_000):
    rows = []
    for year, g in df.groupby('year'):
        g = g.sort_values(['date', 'race_key', '馬番'])
        pool = g['クラスコード'].map(POOL_BY_CLASS).values * pool_mult
        p = (g['pm'] * (g['pB'] / g['pm']) ** alpha).values
        odds0 = g['単勝オッズ'].values; win = g['win'].values
        stakes = np.zeros(len(g)); rets = np.zeros(len(g)); odds_used = odds0.copy()
        bank = float(bank0); peak = bank; maxdd = 0.0
        # レースごとに処理（同一レース内で複数頭に賭けることも許す）
        race_codes, starts = np.unique(g['race_key'].values, return_index=True)
        order = np.argsort(starts); starts = starts[order]; ends = np.r_[starts[1:], len(g)]
        for s0, e0 in zip(starts, ends):
            for i in range(s0, e0):
                if mode == 'flat':
                    b = 100.0
                    o = odds_after(odds0[i], pool[i], b)
                    if p[i] * o < thr or odds0[i] > 50: continue
                else:
                    o_pre = odds_after(odds0[i], pool[i], 100.0)
                    if p[i] * o_pre < thr or odds0[i] > 50: continue
                    b, o = kelly_stake(p[i], odds0[i], pool[i], bank, frac=frac)
                    if b < 100 or p[i] * o < thr: continue
                stakes[i] = b; rets[i] = b * o if win[i] == 1 else 0.0
                odds_used[i] = o
            if mode != 'flat':
                bank += rets[s0:e0].sum() - stakes[s0:e0].sum()
                peak = max(peak, bank); maxdd = max(maxdd, (peak - bank) / peak)
        m = stakes > 0
        lo, hi = bootstrap_roi(stakes[m], rets[m], g['race_key'].values[m])
        rows.append(dict(scenario=label, mode=mode, thr=thr, alpha=alpha, pool_mult=pool_mult, year=year,
                         bets=int(m.sum()), races_bet=int(pd.Series(g['race_key'].values[m]).nunique()),
                         staked=stakes.sum(), returned=rets.sum(), roi=rets.sum() / max(stakes.sum(), 1) * 100,
                         roi_ci_lo=lo, roi_ci_hi=hi, profit=rets.sum() - stakes.sum(),
                         avg_odds_impact=float(np.mean(odds0[m] / odds_used[m])) if m.sum() else np.nan,
                         end_bank=bank if mode != 'flat' else np.nan, max_dd=maxdd if mode != 'flat' else np.nan))
    return pd.DataFrame(rows)

def summarize(res):
    tot = res.groupby(['scenario', 'mode', 'thr', 'alpha', 'pool_mult']).agg(bets=('bets', 'sum'), staked=('staked', 'sum'), returned=('returned', 'sum')).reset_index()
    tot['roi'] = tot['returned'] / tot['staked'] * 100
    return tot

def main():
    df = pd.read_csv(os.path.join(DATA, 'predictions_test.csv'), dtype={'race_key': str})
    df['date'] = pd.to_datetime(df['date'])
    base = df[df['クラスコード'].isin(ELIGIBLE)].copy()
    scen = {
        '全平地(新馬・重賞・L除く)': base,
        'ダートのみ': base[base['芝・ダ'] == 'ダ'],
        'ダート1400m以下': base[(base['芝・ダ'] == 'ダ') & (base['距離'] <= 1400)],
        '参考: 除外した新馬・重賞・L': df[~df['クラスコード'].isin(ELIGIBLE)].assign(クラスコード=7),  # プール仮定は未勝利相当で代用
    }
    pd.set_option('display.width', 220)
    all_res = []
    print('=== (1) 100 円均一、EV 閾値 1.10、プール仮定 ×1、α=1 ===')
    for name, d in scen.items():
        r = run(d, name, thr=1.10, alpha=1.0, pool_mult=1.0, mode='flat'); all_res.append(r)
        print(f'\n[{name}]')
        print(r[['year', 'bets', 'races_bet', 'staked', 'returned', 'roi', 'roi_ci_lo', 'roi_ci_hi']].round(1).to_string(index=False))
        t = summarize(r).iloc[0]; print(f'  合計: {int(t.bets)} 口  回収率 {t.roi:.1f}%')

    print('\n=== (2) 閾値と縮小係数の感度（全平地、100 円均一、プール ×1） ===')
    for thr in (1.00, 1.05, 1.10, 1.20):
        for alpha in (1.0, 0.7):
            r = run(scen['全平地(新馬・重賞・L除く)'], '全平地', thr=thr, alpha=alpha, mode='flat'); all_res.append(r)
            t = summarize(r).iloc[0]
            yrs_pos = int((r['roi'] > 100).sum())
            print(f'  thr={thr:.2f} α={alpha:.1f}: {int(t.bets):5d} 口  回収率 {t.roi:6.1f}%  年別で 100% 超 {yrs_pos}/7')

    print('\n=== (3) 分数ケリー 1/4（年初 100 万円、年内複利、1 レース上限 2%、EV≥1.10、α=0.7） プール仮定の感度 ===')
    for pm_ in (0.5, 1.0, 2.0):
        r = run(scen['全平地(新馬・重賞・L除く)'], '全平地', thr=1.10, alpha=0.7, pool_mult=pm_, mode='kelly'); all_res.append(r)
        print(f'\n[プール ×{pm_}]')
        print(r[['year', 'bets', 'staked', 'returned', 'roi', 'roi_ci_lo', 'roi_ci_hi', 'profit', 'end_bank', 'max_dd', 'avg_odds_impact']].round(2).to_string(index=False))
        t = summarize(r).iloc[0]; print(f'  合計: {int(t.bets)} 口  投資 {t.staked/1e4:.0f} 万円  回収率 {t.roi:.1f}%')

    print('\n=== (4) 分数ケリー 1/4 をダートのみ・ダート 1400m 以下で（プール ×1、EV≥1.10、α=0.7） ===')
    for name in ('ダートのみ', 'ダート1400m以下'):
        r = run(scen[name], name, thr=1.10, alpha=0.7, pool_mult=1.0, mode='kelly'); all_res.append(r)
        print(f'\n[{name}]')
        print(r[['year', 'bets', 'staked', 'returned', 'roi', 'roi_ci_lo', 'roi_ci_hi', 'profit', 'end_bank', 'max_dd']].round(2).to_string(index=False))
        t = summarize(r).iloc[0]; print(f'  合計: {int(t.bets)} 口  回収率 {t.roi:.1f}%')

    os.makedirs(RESULTS, exist_ok=True)
    pd.concat(all_res).to_csv(os.path.join(RESULTS, 'sim_bets.csv'), index=False)

if __name__ == '__main__':
    main()
