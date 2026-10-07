#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
モデル B（市場+特徴量）の改善がどこに集中しているかを分解する。
入力: data/predictions_test.csv（model_clogit.py が出すテスト年の予測値）
出力: results/edge_breakdown.csv と標準出力の表
軸: クラス / 芝ダ / 頭数 / 単勝オッズ帯 / 競馬場 / 年
指標: レースあたり対数尤度の改善 (B−A)、EV≥1.1 の単勝ベット数・回収率・標準誤差、
      「モデルが市場より高く評価した馬（pB/pm ≥ 1.15）」の単勝回収率
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data'); RESULTS = os.path.join(HERE, 'results')

CLASS = {7: '未勝利', 15: '新馬', 23: '1勝', 43: '2勝', 67: '3勝', 115: 'OP(L)', 131: 'OP特別', 147: '重賞(無格)', 163: 'G3', 179: 'G2', 195: 'G1'}

def roi(mask, win, odds):
    n = int(mask.sum())
    if n == 0: return np.nan, np.nan, 0
    r = (win[mask] * odds[mask]).values
    return r.mean() * 100, r.std(ddof=1) / np.sqrt(n) * 100 if n > 1 else np.nan, n

def breakdown(df, key, label):
    rows = []
    for k, g in df.groupby(key, observed=True):
        races = g['race_key'].nunique()
        llA = np.sum(g['win'] * np.log(g['pA'].clip(1e-9))); llB = np.sum(g['win'] * np.log(g['pB'].clip(1e-9)))
        ev = g['pB'] * g['単勝オッズ']
        m = (ev >= 1.1) & (g['単勝オッズ'] <= 50)
        r, se, n = roi(m, g['win'], g['単勝オッズ'])
        m2 = (g['pB'] / g['pm'] >= 1.15) & (g['単勝オッズ'] <= 50)
        r2, se2, n2 = roi(m2, g['win'], g['単勝オッズ'])
        rows.append(dict(axis=label, group=str(k), races=races, horses=len(g), dLL_per_race=(llB - llA) / races,
                         ev11_n=n, ev11_roi=r, ev11_se=se, over115_n=n2, over115_roi=r2, over115_se=se2,
                         flat_roi=(g['win'] * g['単勝オッズ']).mean() * 100))
    return rows

def main():
    df = pd.read_csv(os.path.join(DATA, 'predictions_test.csv'))
    df['class'] = df['クラスコード'].map(CLASS).fillna('other')
    df['field'] = pd.cut(df['頭数'], [0, 10, 13, 16, 19], labels=['〜10頭', '11〜13頭', '14〜16頭', '17〜18頭'])
    df['odds_band'] = pd.cut(df['単勝オッズ'], [1, 3, 6, 12, 25, 50, 10000], labels=['1〜3', '3〜6', '6〜12', '12〜25', '25〜50', '50〜'], right=False)
    df['dist_band'] = pd.cut(df['距離'], [0, 1400, 1800, 2200, 4000], labels=['〜1400', '1401〜1800', '1801〜2200', '2201〜'])
    out = []
    out += breakdown(df, 'class', 'クラス')
    out += breakdown(df, '芝・ダ', '芝ダ')
    out += breakdown(df, 'field', '頭数')
    out += breakdown(df, 'dist_band', '距離')
    out += breakdown(df, '場所', '競馬場')
    out += breakdown(df, 'year', '年')
    # オッズ帯はレース単位の LL 分解ができないので、ベット側だけ
    for k, g in df.groupby('odds_band', observed=True):
        ev = g['pB'] * g['単勝オッズ']; m = ev >= 1.1
        r, se, n = roi(m, g['win'], g['単勝オッズ'])
        m2 = (g['pB'] / g['pm'] >= 1.15); r2, se2, n2 = roi(m2, g['win'], g['単勝オッズ'])
        out.append(dict(axis='オッズ帯', group=str(k), races=g['race_key'].nunique(), horses=len(g), dLL_per_race=np.nan,
                        ev11_n=n, ev11_roi=r, ev11_se=se, over115_n=n2, over115_roi=r2, over115_se=se2,
                        flat_roi=(g['win'] * g['単勝オッズ']).mean() * 100))
    res = pd.DataFrame(out)
    pd.set_option('display.width', 200)
    for ax in res['axis'].unique():
        sub = res[res['axis'] == ax].drop(columns='axis').set_index('group')
        print(f'\n=== {ax} ===')
        print(sub.round({'dLL_per_race': 4, 'ev11_roi': 1, 'ev11_se': 1, 'over115_roi': 1, 'over115_se': 1, 'flat_roi': 1}).to_string())
    os.makedirs(RESULTS, exist_ok=True)
    res.to_csv(os.path.join(RESULTS, 'edge_breakdown.csv'), index=False)
    # 3 着内: モデル B の確率と市場 Harville の比較を同じ軸で
    print('\n=== 3 着内: 1 頭あたり対数尤度の改善（B − 市場 Harville）をクラス別に ===')
    for k, g in df.groupby('class'):
        y = g['top3']; a = g['p3_market'].clip(1e-6, 1 - 1e-6); b = g['p3_B'].clip(1e-6, 1 - 1e-6)
        lla = np.sum(y * np.log(a) + (1 - y) * np.log(1 - a)); llb = np.sum(y * np.log(b) + (1 - y) * np.log(1 - b))
        print(f'  {k:10s} n={len(g):7,}  ΔLL/頭={(llb - lla) / len(g):+.4f}')

if __name__ == '__main__':
    main()
