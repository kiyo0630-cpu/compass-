# nikkei225-momentum — 株価 CSV の自動更新

日経225 月次モメンタム戦略（12-1 モメンタム上位20銘柄・等金額・月1回入替）のシミュレーション運用で使う
**株価データだけ**をここで作る。運用本体（`momentum.py` / `simulate.py` / `momentum_state.json`）の正本は
Google Drive の `nikkei225-momentum` フォルダにあり、このリポジトリには置かない。

| パス | 内容 |
|---|---|
| `fetch_prices.py` | Yahoo Finance（yfinance）から構成銘柄の終値（約2年分）と日経平均を取り、CSV に書く。取れない銘柄は stooq.com で補う |
| `nikkei225_components.json` | 構成銘柄（コード → 銘柄名）。Drive の正本と同じ内容にしておく |
| `data/closes.csv` | 生成物。1列目 `Date`、以降は銘柄コードの列、最後に `N225`（日経平均） |
| `data/meta.json` | 生成物。取得日時・最終日付・取れなかった銘柄 |

## 動き

`.github/workflows/nikkei225-prices.yml` が平日 17:23 JST（大引け後）に `fetch_prices.py` を実行し、
`data/` に差分があればコミットする（`[skip ci]` 付き）。

Claude の定期タスク「日経225 月次モメンタム リバランス」（毎月14日 19:07 JST）は
`https://raw.githubusercontent.com/kiyo0630-cpu/compass-/main/nikkei225-momentum/data/closes.csv`
を取ってから `python momentum.py rebalance --prices-url <そのURL>` を実行する。
Claude のクラウド環境からは Yahoo Finance に直接つなげないことがある（2026-10-14 の失敗の原因）ため、
取得だけをこちらに寄せている。

## 手元で動かす

```sh
pip install yfinance pandas
python nikkei225-momentum/fetch_prices.py --components nikkei225-momentum/nikkei225_components.json --out nikkei225-momentum/data
```

構成銘柄を入れ替えるときは、Drive の `nikkei225_components.json` を直してから、ここにも同じ内容を置く
（push すると自動で CSV が作り直される）。
