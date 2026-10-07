#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TARGET「レース一覧成績」CSV（cp932）を読み、分析用の DataFrame にする。
複数ファイル可（年別に分割されたものを全部渡す）。重複行は レースID+馬番 で除去。

使い方:
  python3 load_results.py  <csv または フォルダ> [...]   → 概要とベースライン統計を表示し、parquet/CSV を書き出す
"""
import sys, os, glob
import numpy as np
import pandas as pd

NUM_COLS = ['年', '月', '日', '回次', '日次', 'レース番号', 'クラスコード', 'コースコード', '距離', '年齢', '斤量', '頭数', '馬番',
            '確定着順', '入線着順', '異常コード', '着差タイム', '人気順', '走破タイム', '上がり3Fタイム', '馬体重', '賞金',
            '単勝オッズ', 'PCI', '間隔',
            '前走年', '前走月', '前走日', '前走クラスコード', '前走距離', '前走斤量', '前走頭数', '前走馬番', '前走確定着順',
            '前走入線着順', '前走異常コード', '前走着差タイム', '前走人気順', '前走走破タイム', '前走上がり3Fタイム', '前走馬体重',
            '前走賞金', '前走PCI',
            '通過順1', '通過順2', '通過順3', '通過順4', '前走通過順1', '前走通過順2', '前走通過順3', '前走通過順4']

def read_one(fp):
    df = pd.read_csv(fp, encoding='cp932', dtype=str, keep_default_na=False)
    df.columns = [c.strip() for c in df.columns]
    # 無名列を落とす
    df = df.loc[:, [c for c in df.columns if c and not c.startswith('Unnamed')]]
    for c in df.columns:
        df[c] = df[c].str.strip()
    for c in NUM_COLS:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c].str.replace('"', ''), errors='coerce')
    return df

def load(paths):
    files = []
    for p in paths:
        files += sorted(glob.glob(os.path.join(p, '*.csv'))) if os.path.isdir(p) else [p]
    parts = []
    for fp in files:
        d = read_one(fp); d['_src'] = os.path.basename(fp); parts.append(d)
        print(f'  読込 {os.path.basename(fp)}: {len(d)} 行')
    df = pd.concat(parts, ignore_index=True)
    before = len(df)
    # レースID は末尾 2 桁が馬番（例 0626491207 = …12R の 07 番）。レース単位のキーは末尾を落とす
    df['race_key'] = df['レースID'].str[:-2]
    df = df.drop_duplicates(subset=['レースID'], keep='last')
    print(f'重複除去 {before} → {len(df)} 行')
    # 日付
    yy = df['年'].astype('Int64'); yyyy = np.where(yy < 100, 2000 + yy.astype(float), yy.astype(float))
    df['date'] = pd.to_datetime(dict(year=yyyy, month=df['月'], day=df['日']), errors='coerce')
    df['year'] = df['date'].dt.year
    # 出走馬のみ（異常コード 0 = 正常。取消・除外・中止は除く）
    df['ran'] = (df['異常コード'] == 0) & df['確定着順'].notna() & (df['確定着順'] > 0)
    # 市場確率（確定単勝オッズ。前日オッズが来たら差し替え）
    r = df[df['ran']].copy()
    inv = 1.0 / r['単勝オッズ']
    r['pm'] = inv / inv.groupby(r['race_key']).transform('sum')
    r['n_run'] = r.groupby('race_key')['馬番'].transform('count')
    r['win'] = (r['確定着順'] == 1).astype(int)
    r['top3'] = (r['確定着順'] <= 3).astype(int)
    return r

def baseline(r):
    print('\n=== ベースライン ===')
    print('レース数', r['race_key'].nunique(), ' 出走延べ頭数', len(r), ' 期間', r['date'].min().date(), '〜', r['date'].max().date())
    # 人気別
    g = r.groupby('人気順').agg(n=('win', 'size'), 勝率=('win', 'mean'), 複勝率=('top3', 'mean'),
                                 単勝回収=('win', lambda s: 0), )
    pay = (r['win'] * r['単勝オッズ'] * 100)
    g['単勝回収%'] = pay.groupby(r['人気順']).sum() / (g['n'] * 100) * 100
    print('\n人気別（上位 8 のみ）'); print(g.head(8).round(3).to_string())
    # オッズ帯別
    bins = [1, 2, 3, 5, 8, 12, 20, 30, 50, 100, 10000]
    band = pd.cut(r['単勝オッズ'], bins, right=False)
    g2 = pd.DataFrame({'n': r.groupby(band, observed=True).size(),
                       '勝率': r['win'].groupby(band, observed=True).mean(),
                       '市場p平均': r['pm'].groupby(band, observed=True).mean(),
                       '単勝回収%': pay.groupby(band, observed=True).sum() / r.groupby(band, observed=True).size() / 100 * 100})
    print('\nオッズ帯別（勝率 vs 市場確率 = キャリブレーション）'); print(g2.round(3).to_string())
    ll_market = float(np.sum(r['win'] * np.log(r['pm'])))
    ll_unif = float(-np.sum(np.log(r.drop_duplicates('race_key')['n_run'])))
    print(f'\n市場モデルの対数尤度 {ll_market:.1f}  一様 {ll_unif:.1f}  擬似R² {1 - ll_market / ll_unif:.4f}')

if __name__ == '__main__':
    r = load(sys.argv[1:])
    baseline(r)
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'results_clean.csv')
    r.to_csv(out, index=False, encoding='utf-8')
    print('\n書き出し', out)
