#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TARGET「レース一覧成績」の大きな CSV を年ごとに分割して zip にする（Mac / Windows、追加ライブラリ不要）。

使い方（ターミナルで、ファイルのあるフォルダに移動せずそのままパスを渡す）:
  python3 split_history.py "/path/to/レース一覧成績20260621.csv"
  python3 split_history.py "/path/to/レース一覧成績20260621.csv" --out ~/Desktop/keiba_history

結果: 出力フォルダに history_2016.csv.zip, history_2017.csv.zip, ... ができる。
       フォルダごと Google Drive にドラッグすればよい（各ファイルは 3MB 未満）。
"""
import sys, os, csv, io, zipfile, argparse

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('--out', default=None, help='出力フォルダ（既定: 入力ファイルと同じ場所の keiba_history）')
    ap.add_argument('--enc', default='cp932')
    a = ap.parse_args()
    out = a.out or os.path.join(os.path.dirname(os.path.abspath(a.src)), 'keiba_history')
    os.makedirs(out, exist_ok=True)

    with open(a.src, 'r', encoding=a.enc, errors='replace', newline='') as f:
        reader = csv.reader(f)
        header = next(reader)
        cols = [c.strip() for c in header]
        if '年' not in cols:
            sys.exit(f'列「年」が見つかりません。先頭の列: {cols[:10]}')
        iy = cols.index('年')
        buffers = {}   # year -> StringIO
        counts = {}
        for row in reader:
            if not row or len(row) <= iy: continue
            y = row[iy].strip()
            if not y.isdigit(): continue
            y = int(y); y = 2000 + y if y < 100 else y
            if y not in buffers:
                buffers[y] = io.StringIO(); counts[y] = 0
                csv.writer(buffers[y], lineterminator='\r\n').writerow(header)
            csv.writer(buffers[y], lineterminator='\r\n').writerow(row)
            counts[y] += 1

    im = cols.index('月') if '月' in cols else None
    total = 0
    def write_zip(name, rows_text):
        zpath = os.path.join(out, name + '.zip')
        data = rows_text.encode(a.enc, errors='replace')
        with zipfile.ZipFile(zpath, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            z.writestr(name, data)
        return os.path.getsize(zpath) / 1e6

    LIMIT = 3.0   # MB。これを超える zip は四半期に分ける（転送経路の上限が約 4MB のため）
    for y in sorted(buffers):
        text = buffers[y].getvalue()
        sz = write_zip(f'history_{y}.csv', text)
        if sz < LIMIT or im is None:
            total += sz
            print(f'{y}: {counts[y]:>7,} 行  {sz:5.1f} MB')
            continue
        os.remove(os.path.join(out, f'history_{y}.csv.zip'))
        lines = text.splitlines()
        head, body = lines[0], lines[1:]
        def month_of(line):
            try: return int(next(csv.reader([line]))[im])
            except Exception: return 0
        parts = []
        for q, (m1, m2) in enumerate([(1, 3), (4, 6), (7, 9), (10, 12)], start=1):
            rows = [l for l in body if m1 <= month_of(l) <= m2]
            if not rows: continue
            sq = write_zip(f'history_{y}_Q{q}.csv', '\r\n'.join([head] + rows) + '\r\n')
            total += sq; parts.append(f'Q{q} {sq:.1f}MB')
        print(f'{y}: {counts[y]:>7,} 行  ' + ' / '.join(parts) + '（四半期に分割）')
    print(f'\n出力先: {out}  合計 {total:.1f} MB')
    print('このフォルダを Google Drive にアップロードしてください。')

if __name__ == '__main__':
    main()
