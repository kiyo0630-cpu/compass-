#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""日経225 構成銘柄の終値 CSV を作る（GitHub Actions で毎営業日に実行する）。

背景: Claude の定期タスク「日経225 月次モメンタム リバランス」が動くクラウド環境からは
Yahoo Finance に直接つなげないことがある（2026-10-14 に通信方針で拒否されて失敗）。
そこで株価の取得だけを GitHub Actions に任せ、結果を data/closes.csv としてコミットしておく。
定期タスクは raw.githubusercontent.com からその CSV を取る（momentum.py --prices-url）。

入力: nikkei225_components.json  {"7203": "Toyota Motor Corp.", ...}
      （Google Drive の nikkei225-momentum フォルダにある正本と同じ内容にしておく）
出力: <out>/closes.csv  1列目 Date（YYYY-MM-DD）、以降は銘柄コードの列、最後に N225（日経平均）
      <out>/splits.csv  期間中の株式分割（Date, code, ratio。10 = 1株→10株）。momentum.py が保有株数を補正する
      <out>/meta.json   取得日時・最終日付・取れなかった銘柄 など
取得元: Yahoo Finance（yfinance。配当・分割調整済みの終値 = simulate.py の fetch_closes と同じ）
        取れなかった銘柄は stooq.com の日足 CSV で補う（分割調整のみの終値。分割情報は付かない）
終了コード: 0 = 正常（CSV を書いた） / 1 = 取得不足・鮮度不良（CSV は書かない）

使い方: python fetch_prices.py --components nikkei225_components.json --out data
"""
import argparse
import datetime as dt
import io
import json
import os
import time
import urllib.request

import pandas as pd

PERIOD = "2y"           # yfinance の取得期間（12-1 モメンタムには 274 営業日あれば足りる）
MAX_ROWS = 520          # CSV に残す行数の上限
MIN_ROWS = 300          # これより少なければ失敗（12ヶ月＋1ヶ月分に足りない）
MIN_OK_RATIO = 0.95     # 取れた銘柄がこの割合未満なら失敗にする
STALE_DAYS = 7          # 最終日付がこれより古ければ失敗にする（取得先の不調）
JST = dt.timezone(dt.timedelta(hours=9))


def log(*args):
    print(*args, flush=True)


def load_components(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def to_naive_dates(index):
    """tz 付きの日時でも日付だけの DatetimeIndex にそろえる"""
    idx = pd.to_datetime(index)
    if getattr(idx, "tz", None) is not None:
        idx = idx.tz_convert("Asia/Tokyo").tz_localize(None)
    return idx.normalize()


def collect_splits(frame, splits, code=None):
    """'Stock Splits' 列（0 以外が分割比率）を splits[(日付, コード)] = 比率 に集める"""
    if frame is None or "Stock Splits" not in frame:
        return
    sp = frame["Stock Splits"]
    if isinstance(sp, pd.Series):  # 1 銘柄
        for d, v in sp.dropna().items():
            if v and float(v) != 0.0:
                splits[(pd.Timestamp(d).normalize(), code)] = float(v)
        return
    for col in sp.columns:
        c = str(col).replace(".T", "")
        for d, v in sp[col].dropna().items():
            if v and float(v) != 0.0:
                splits[(pd.Timestamp(d).normalize(), c)] = float(v)


def fetch_yf_batch(codes, period, splits):
    """yfinance でまとめて終値を取る（列 = 銘柄コード）。分割は splits に集める"""
    import yfinance as yf

    tickers = [f"{c}.T" for c in codes]
    data = yf.download(tickers, period=period, progress=False, threads=False,
                       group_by="column", actions=True)
    if data is None or len(data) == 0:
        raise RuntimeError("yfinance returned no data")
    if isinstance(data.columns, pd.MultiIndex):
        closes = data["Close"].copy()
        data.index = to_naive_dates(data.index)
        collect_splits(data, splits)
    else:  # 1 銘柄だけのときの保険
        closes = data[["Close"]].copy()
        closes.columns = tickers
        data.index = to_naive_dates(data.index)
        collect_splits(data, splits, code=codes[0])
    closes.columns = [str(c).replace(".T", "") for c in closes.columns]
    closes.index = to_naive_dates(closes.index)
    return closes


def fetch_yf_single(ticker, period, splits=None):
    import yfinance as yf

    h = yf.Ticker(ticker).history(period=period, auto_adjust=True, actions=True)
    if h is None or len(h) == 0:
        raise RuntimeError("empty")
    h.index = to_naive_dates(h.index)
    if splits is not None:
        collect_splits(h, splits, code=ticker.replace(".T", ""))
    return h["Close"].astype(float)


def fetch_stooq(symbol, since):
    """stooq.com の日足 CSV（Date,Open,High,Low,Close,Volume）から終値を取る"""
    url = f"https://stooq.com/q/d/l/?s={symbol}&i=d"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        text = r.read().decode("utf-8", "replace")
    if not text.startswith("Date,"):
        raise RuntimeError(text.strip()[:80] or "no data")
    df = pd.read_csv(io.StringIO(text), parse_dates=["Date"])
    s = df.set_index("Date")["Close"].astype(float)
    s.index = to_naive_dates(s.index)
    s = s[s.index >= since]
    if len(s) == 0:
        raise RuntimeError("no rows")
    return s


def needs_retry(series, last_date):
    """列が空、または最終有効日が全体の最終日より 7 日以上古ければ取り直す"""
    s = series.dropna()
    if len(s) == 0:
        return True
    return s.index[-1] < last_date - pd.Timedelta(days=7)


def main():
    ap = argparse.ArgumentParser(description="日経225 構成銘柄の終値 CSV を作る")
    ap.add_argument("--components", default="nikkei225_components.json")
    ap.add_argument("--out", default="data")
    ap.add_argument("--period", default=PERIOD)
    args = ap.parse_args()

    comps = load_components(args.components)
    codes = list(comps.keys())
    since = pd.Timestamp(dt.date.today() - dt.timedelta(days=760))
    log(f"{len(codes)}銘柄の終値を取得中（yfinance, period={args.period}）...")

    splits = {}
    closes, err = None, None
    for i in range(3):
        try:
            closes = fetch_yf_batch(codes, args.period, splits)
            break
        except Exception as e:  # noqa: BLE001 - 取得先の不調はまとめて再試行する
            err = e
            log(f"  一括取得に失敗（{i + 1}/3）: {e!r:.200}")
            time.sleep(60 * (i + 1))
    if closes is None:
        log(f"  一括取得をあきらめて 1 銘柄ずつ取ります（{err!r:.120}）")
        closes = pd.DataFrame(index=pd.DatetimeIndex([], name="Date"))

    last_date = closes.index.max() if len(closes) else None
    from_single, from_stooq, missing = [], [], []
    for code in codes:
        s = closes[code] if code in closes.columns else pd.Series(dtype=float)
        if last_date is not None and not needs_retry(s, last_date):
            continue
        got = None
        try:
            got = fetch_yf_single(f"{code}.T", args.period, splits)
            from_single.append(code)
        except Exception as e1:  # noqa: BLE001
            try:
                time.sleep(1.0)
                got = fetch_stooq(f"{code}.jp", since)
                from_stooq.append(code)
            except Exception as e2:  # noqa: BLE001
                missing.append(code)
                log(f"  {code}: 取得できず（yfinance: {e1!r:.80} / stooq: {e2!r:.80}）")
        if got is not None:
            closes = closes.drop(columns=[code], errors="ignore")
            closes = closes.join(got.rename(code), how="outer")

    n225, n225_src = None, None
    try:
        n225, n225_src = fetch_yf_single("^N225", args.period), "yfinance"
    except Exception as e1:  # noqa: BLE001
        try:
            n225, n225_src = fetch_stooq("^nkx", since), "stooq"
        except Exception as e2:  # noqa: BLE001
            log(f"  日経平均: 取得できず（yfinance: {e1!r:.80} / stooq: {e2!r:.80}）")

    stock_cols = [c for c in codes if c in closes.columns and c not in missing]
    out = closes[stock_cols].copy().dropna(how="all")
    if n225 is not None:
        out = out.join(n225.rename("N225"), how="left")
    out = out.sort_index().iloc[-MAX_ROWS:]
    out.index.name = "Date"

    today = dt.datetime.now(JST).date()
    last = out.index.max() if len(out) else None
    problems = []
    if len(stock_cols) < MIN_OK_RATIO * len(codes):
        problems.append(f"取れた銘柄が少なすぎます（{len(stock_cols)}/{len(codes)}）")
    if last is None or (today - last.date()).days > STALE_DAYS:
        problems.append(f"最終日付が古すぎます（{last.date() if last is not None else None}）")
    if len(out) < MIN_ROWS:
        problems.append(f"行数が足りません（{len(out)} 行、{MIN_ROWS} 行以上必要）")
    if problems:
        log("失敗: " + " / ".join(problems))
        return 1

    os.makedirs(args.out, exist_ok=True)
    csv_path = os.path.join(args.out, "closes.csv")
    out.round(2).to_csv(csv_path, date_format="%Y-%m-%d")
    first = out.index.min()
    split_rows = sorted((d, c, r) for (d, c), r in splits.items() if c in stock_cols and d >= first)
    with open(os.path.join(args.out, "splits.csv"), "w", encoding="utf-8") as f:
        f.write("Date,code,ratio\n")
        for d, c, r in split_rows:
            f.write(f"{d.strftime('%Y-%m-%d')},{c},{r:g}\n")
    meta = {
        "fetched_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "first_date": out.index.min().strftime("%Y-%m-%d"),
        "last_date": last.strftime("%Y-%m-%d"),
        "rows": int(len(out)),
        "n_codes": len(codes),
        "n_ok": len(stock_cols),
        "missing": missing,
        "retried_single": from_single,
        "from_stooq": from_stooq,
        "n225_source": n225_src,
        "splits": len(split_rows),
        "columns": ["Date"] + list(out.columns),
    }
    with open(os.path.join(args.out, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    log(f"書き出し: {csv_path}（{len(out)}営業日 × {len(stock_cols)}銘柄、最終 {meta['last_date']}、"
        f"再取得 {len(from_single)}、stooq {len(from_stooq)}、欠落 {len(missing)}、"
        f"日経平均 {n225_src}、分割 {len(split_rows)} 件）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
