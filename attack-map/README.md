# 日本へのサイバー攻撃マップ

日本を標的（宛先）とするサイバー攻撃の**送信元 国・地域**を、太平洋中心の世界地図上に
リアルタイム風のアニメーションとランキングで表示する単一 HTML ページです。
ビルド不要で、GitHub Pages にそのまま置けます。

- ページ: `attack-map/index.html`（公開 URL の例: `https://<user>.github.io/<repo>/attack-map/`）
- 統計ページ: `attack-map/stats/index.html`（`…/attack-map/stats/`）。GitHub Actions が蓄積した履歴から、国別シェアの推移・期間ランキング・任意の時刻のランキングを見られます
- 地図・ランキング・ライブフィード・スパークライン（L7 攻撃量の推移）・設定パネルを含みます
- **国フィルタ**（地図の下）: 国名・コードで検索するか、チップ・ランキングの行・地図の点をクリックして送信元を絞り込めます。複数選択可
- **攻撃種別フィルタ**: 地図の凡例をクリックすると、その種別の矢印とフィードを表示/非表示にできます。上部の「統合 / L7 / L3/4」はデータ自体の切り替えです
- **タイムライン**（地図の下）: 直近の期間を時間帯ごとに再生します。L7 攻撃量の時系列に合わせて矢印の量が変わり、ページを開いたまま更新を重ねると、このブラウザに保存されたスナップショット（最大 96 件・localStorage）から時刻に近い国別内訳に切り替わります。デモ表示でも参考用の時系列で動きます
- **上位ランキング（TOP 5）**: 攻撃元（L7 / L3-4 の送信元国）と攻撃先（業種・分野、設定があれば標的ホスト）を並べて表示します
- **配色**: ヘッダー右の「自動 / 🌙 / ☀️」でダーク・ライトを切り替えられます（既定は端末の設定に追従）。スマートフォン幅ではボタンや凡例を地図の外に出し、横スクロールなしで表示します
- 地図は既定で**ゆっくり回る地球儀**（正射図法）。ドラッグで回せ、「一周 / 日本中心に往復 / 固定」と「🎯 日本」ボタン、平面地図への切り替えがあります。外部ライブラリは使っていません

## データの意味

| 項目 | 内容 |
|---|---|
| 国別シェア | Cloudflare Radar の「日本を標的とする L7 HTTP DDoS / L3-4 DDoS の上位送信元国」（%） |
| 矢印・フィード | 上記シェアに比例してランダム生成する**演出**。1 本＝1 件の実攻撃ではない |
| 「国」 | 送信元 IP の地理情報。ボットネットや踏み台経由の通信を含み、国家や国民が攻撃者という意味ではない |
| デモ表示 | 公開レポート（NICTER など）の傾向を参考にした**概算の参考値**。実測値ではない |

## ライブデータを有効にする（3 通り）

どれも Cloudflare の無料アカウントと、**Account → Radar: Read** 権限の API トークンが必要です
（Cloudflare ダッシュボード → My Profile → API Tokens → Create Token）。

### A. GitHub Actions（推奨・トークンを公開しない）

1. リポジトリの **Settings → Secrets and variables → Actions** に `CLOUDFLARE_API_TOKEN` を登録
2. `.github/workflows/attack-map-feed.yml` が毎時 `attack-map/data/latest.json` を更新してコミットします
   （**Actions** タブから `attack-map feed` を手動実行して初回データを作れます）
3. ページは既定（「自動」）でこのファイルを最初に読みます。3 時間以上古い場合は「更新なし」表示になります

### B. Cloudflare Worker プロキシ（数分単位で更新したい場合）

```sh
cd attack-map/worker
npx wrangler deploy
npx wrangler secret put CLOUDFLARE_API_TOKEN
# 任意: 許可するオリジンを絞る
npx wrangler secret put ALLOWED_ORIGIN   # 例 https://<user>.github.io
```

ページの「⚙ データソース設定」で **プロキシ URL** に `https://<worker>.workers.dev/` を入力して保存します。

### C. ブラウザから直接呼ぶ

設定パネルの **Cloudflare API トークン** に入力すると、ブラウザの localStorage に保存して直接 API を呼びます。
ブラウザの CORS 制限で失敗する場合は A または B を使ってください。トークンは他人と共有する端末では入力しないでください。

## フィード履歴

`attack-map feed` ワークフローは `latest.json` を取得するたびに、`attack-map/scripts/history.mjs append` で
`attack-map/data/history/` に 1 回分を 1 行として追記します（同じ `generatedAt` は二重に保存しません）。
統計ページ（`attack-map/stats/`）はこのフォルダだけを読みます。他のスクリプト（異常検知や週次レポート）からもそのまま使えます。

```
attack-map/data/history/
  index.json      月ファイルの一覧と件数・期間（統計ページが最初に読む）
  YYYY-MM.jsonl   月ごとの生データ。1 行 = 1 回の取得（JSON Lines、UTC 時刻順）
  daily.csv       日本時間の日別 × 種別 × 国の集計（表計算ソフト向け。jsonl から自動生成）
```

### `YYYY-MM.jsonl` の 1 行（schema 1）

```json
{"t":"2026-10-22T10:12:37Z","target":"JP","range":"1d",
 "l7":[["US",23.881],["NL",7.414],["SG",5.996]],
 "l3":[["BR",37.603],["US",13.601]],
 "industries":[["Computer Software",26.177],["Retail",9.067]],
 "verticals":[["Computer and Electronics",27.07]],
 "industriesL3":[["Gambling & Gaming",43.5]],
 "verticalsL3":[["Gambling",43.6]],
 "updated":{"l7":"2026-10-22T08:30:00Z","l3":"2026-10-22T08:15:00Z"},
 "errors":0,
 "l7PeakAt":"2026-10-21T19:15:00Z"}
```

| キー | 内容 |
|---|---|
| `t` | 取得時刻（UTC、ISO 8601）。行の一意キー |
| `target` / `range` | 標的の国コードと集計窓（`1d` = 直近 24 時間）。隣り合う行の窓は重なる |
| `l7` / `l3` | 送信元 国別シェア（%）を `[国コード, シェア]` の配列で上位順。小数 3 桁。取得できなかった場合は `null` |
| `industries` / `verticals` | 攻撃を受けた側の業種・分野（L7、`[英語名, シェア%]`）。`…L3` は L3/4 の同じもの |
| `updated` | Cloudflare Radar 側のデータ最終更新時刻（L7 / L3） |
| `errors` | 取得時に失敗した API 呼び出しの数（0 なら全項目そろっている） |
| `l7PeakAt` | 窓内で L7 攻撃量（相対値）が最大だった時刻。時系列そのものは保存しない |

ランキングは Radar の上位 20 か国までなので、圏外の国はその行に現れません（集計では 0% とみなします）。

### `daily.csv`

```
date,layer,code,share_avg,share_min,share_max,snapshots
2026-10-22,l7,US,23.512,22.901,24.102,6
```

`date` は日本時間の日付、`layer` は `l7` / `l3`、`share_avg` はその日の全取得回数で割った平均（圏外の回は 0%）、
`snapshots` はその国がランキングに入っていた回数です。

### コマンド

```sh
node attack-map/scripts/history.mjs append     # latest.json を履歴に追記（Actions が毎時実行）
node attack-map/scripts/history.mjs backfill   # git 履歴にある過去の latest.json を全部取り込む（復旧用）
node attack-map/scripts/history.mjs rebuild    # index.json と daily.csv を jsonl から作り直す
```

## 異常検知アラート

`attack-map feed` ワークフローはフィード取得のあとに `attack-map/scripts/detect-anomalies.mjs` を実行し、
最新スナップショットを**直近 7 日のベースライン**（`latest.json` の過去コミット、git 履歴から復元）と比べて
`attack-map/data/alerts.json` に結果を書き出します。実行ごとの Markdown 要約は Actions のジョブサマリーにも出ます。

| 種別 | 判定（シェアは %） | 重要度 |
|---|---|---|
| `volume-surge` | L7 攻撃量の時系列で、直近 2 時間に 24 時間のピークがあり、普段（中央値）がピークの 40% 以下 | warn |
| `l7-surge` | L7 送信元国のシェアが 5% 以上で、7 日平均の 2 倍・+5pt・+3σ をすべて超えた | warn |
| `l3-new-dominant` | L3 送信元の首位が 50% 以上で、その国の 7 日平均が 10% 未満（新顔の大型 DDoS） | warn |
| `industry-spike` | 被害業種（L7）のシェアが 25% 以上で、7 日平均 +10pt かつ +3σ を超えた | warn |
| `feed` | 国別データが空（warn）/ 一部の API だけ失敗（info） | warn / info |
| `l7-drop`, `l3-single-source` | 平均 10% 以上の国が半減・圏外、L3 首位が 90% 以上の集中 | info |

- `alerts.json` の `status` は `ok` / `info` / `warn`。`alerts[].id` は「種別:対象:UTC 日付」で、同じ日の再検出は同じ ID になります。
- ベースラインが 3 件未満のとき（導入直後など）は国別・業種の判定を保留し、`baseline.sufficient: false` を記録します。
- しきい値はスクリプト冒頭の `RULES` にまとめてあります。ローカル実行: `node attack-map/scripts/detect-anomalies.mjs --out /tmp/alerts.json`
- `warn` が出たときの通知は、このリポジトリとは別に、プロジェクト側の定期チェックが `alerts.json` を読んで行います（ワークフロー自体は失敗しません。`--fail-on-alert` を付けると warn でジョブを失敗させられます）。

## 攻撃を「受けている側」を見る

被害を受けた**個別の IP アドレスやドメイン**は、被害者側が公表しないため公開データには存在しません。
このページで表示できるのは次の 3 段階です。

| 段階 | 内容 | 必要なもの |
|---|---|---|
| 業種・分野の内訳 | 日本で攻撃を受けている業種（ゲーム、金融など）と分野のシェア。L7 と L3/4 それぞれ Cloudflare Radar から取得し、日本語名で表示。未設定時はデモの参考値 | A〜C いずれかのライブ設定 |
| 自分の管理ドメイン | 自分の Cloudflare ゾーンでブロック/チャレンジされたリクエストを**ホスト名別**・送信元国別に集計 | 下記の `CLOUDFLARE_ZONE_IDS` |
| 任意のログ | WAF、ハニーポット、fail2ban などの集計を `targets` 配列で取り込み | カスタム JSON |

### 自分のドメインへの攻撃を表示する

1. API トークンに **Zone → Analytics: Read**（対象ゾーン）の権限を追加する（Radar: Read と同じトークンでよい）
2. リポジトリの Secrets に `CLOUDFLARE_ZONE_IDS` を登録する（ゾーン ID をカンマ区切り。Cloudflare ダッシュボードのサイト概要ページ右下に表示）
3. 次回の Actions 実行から `attack-map/data/targets.json` が生成され、ページの「攻撃を受けている側」にホスト名別の件数が出ます

ローカルで試す:

```sh
CLOUDFLARE_API_TOKEN=xxxx CLOUDFLARE_ZONE_IDS=zone1,zone2 \
  node attack-map/scripts/targets-from-cloudflare-zone.mjs --out attack-map/data/targets.json --hours 24
```

Radar の国別シェアが取れない場合でも、`targets.json` に送信元国の集計があればそれを地図とランキングに使います。

## 週次・月次レポート（自動生成）

`attack-map/data/latest.json` の git 履歴（全スナップショット）から、送信元国・業種のトレンドレポートを
Markdown と HTML（前期間との比較グラフ付き、依存ライブラリなし）で生成します。

- 出力先: `attack-map/reports/`（一覧: `attack-map/reports/index.html`。GitHub Pages なら `…/attack-map/reports/`）
- 週次 `weekly-YYYY-MM-DD.{md,html}`: 最終日までの 7 日平均を前週と比較
- 月次 `monthly-YYYY-MM.{md,html}`: 月平均を前月と比較し、週ごとの推移も載せる
- ハイライト（自動検出）: 前期間比で 1.5 倍以上または 3pt 以上の増減、新顔・消失、期間内の単日突発（中央値の 3 倍以上）を
  国・業種ごとに抽出。L3/4 は少数の大型攻撃で動くため、突発は 50% 以上を基準にする
- `.github/workflows/attack-map-report.yml` が毎週月曜（週次）と毎月 1 日（月次）に実行してコミットします。**Actions** タブから手動実行もできます

```sh
node attack-map/scripts/trend-report.mjs --mode weekly  --end 2026-10-18   # 10/12〜10/18 の週次
node attack-map/scripts/trend-report.mjs --mode monthly --month 2026-10    # 2026 年 10 月の月次
node attack-map/scripts/trend-report.mjs --index                           # 一覧ページだけ再生成
```

集計の決め方: 各 UTC 日の最後のスナップショット（直近 24h 集計）をその日の値とし、期間平均を取ります。
上位 20 件に入らなかった国・業種は 0% とみなします。ポート別の内訳は Radar の公開 API に無いため扱いません。
履歴を別の場所に保存している場合は `--snapshots-dir DIR`（JSON ファイルのディレクトリ）で追加できます。

## カスタム JSON

独自のハニーポットや SIEM の集計を表示したい場合は、次のどちらかの形式の JSON を HTTPS（CORS 許可）で公開し、
設定の **カスタム JSON URL** に指定します。

```json
{ "generatedAt": "2026-10-10T12:00:00Z",
  "countries": [ { "code": "US", "share": 31.2 }, { "code": "CN", "count": 1200 } ] }
```

```json
{ "generatedAt": "2026-10-10T12:00:00Z", "dateRange": "1d",
  "l7": [ { "code": "US", "share": 31.2 } ],
  "l3": [ { "code": "CN", "share": 18.5 } ],
  "series": { "timestamps": ["2026-10-10T00:00:00Z"], "values": [0.42] },
  "industries": [ { "name": "Gaming", "share": 34.2 } ], "verticals": [ { "name": "Financial Services", "share": 18.0 } ],
  "industriesL3": [ { "name": "Telecommunications", "share": 40.1 } ],
  "targets": [ { "host": "www.example.jp", "count": 1532 }, { "host": "203.0.113.10", "count": 80 } ] }
```

`share`（%）が無ければ `count` から構成比を計算します。`code` は ISO 3166-1 alpha-2 です。

## ファイル構成

```
attack-map/
  index.html              ページ本体（依存ライブラリなし）
  data/latest.json        GitHub Actions が生成するスナップショット（初回実行後に出現）
  data/countries-110m.json 地図の輪郭（world-atlas）。Actions が初回に保存。無ければ CDN から取得
  scripts/radar-lib.mjs   Cloudflare Radar 取得・整形の共通ロジック
  scripts/fetch-radar.mjs Actions / ローカル実行用 CLI
  scripts/history.mjs     フィード履歴の追記・復旧・再生成
  data/history/           フィード履歴（index.json / YYYY-MM.jsonl / daily.csv）
  stats/index.html        統計ページ（履歴の閲覧。依存ライブラリなし）
  scripts/targets-from-cloudflare-zone.mjs 自分のゾーンへの攻撃をホスト名別に集計（任意）
  scripts/trend-report.mjs 週次・月次レポート生成（Markdown + HTML）
  scripts/names-ja.mjs    国コード・業種名の日本語表記（レポート用。index.html と同じ内容）
  reports/                生成されたレポート（index.html が一覧）
  data/targets.json       上記の出力（CLOUDFLARE_ZONE_IDS 設定時のみ）
  worker/radar-proxy.js   Cloudflare Worker プロキシ
  worker/wrangler.toml
tests/                    上記スクリプト・Worker のテスト（npm test）
.github/workflows/attack-map-feed.yml
.github/workflows/attack-map-report.yml 週次・月次レポート生成
.github/workflows/ci.yml  Lint とテスト
```

ローカルで試す:

```sh
CLOUDFLARE_API_TOKEN=xxxx node attack-map/scripts/fetch-radar.mjs --out attack-map/data/latest.json --range 1d
python3 -m http.server 8000   # http://localhost:8000/attack-map/
```

## 開発・テスト

リポジトリのルートで実行します（Node.js 22 以上）。

```sh
npm ci
npm run lint   # ESLint（scripts/ と worker/）
npm test       # tests/ のユニットテスト。Cloudflare API はモックで差し替えるのでトークン不要
```

Worker は `caches.default` と `fetch` を差し替えて Node.js 上でテストしています。
`wrangler dev` で実機確認したい場合は `attack-map/worker/` で `npx wrangler dev` を実行してください。

## 参考資料

- NICT [NICTER 観測レポート 2025](https://www.nict.go.jp/press/2026/02/05-1.html) / [NICTER 観測統計](https://blog.nicter.jp/)
- Cloudflare [Radar: Japan](https://radar.cloudflare.com/security?location=jp) / [Radar API](https://developers.cloudflare.com/radar/)
- 総務省 [情報通信白書](https://www.soumu.go.jp/johotsusintokei/whitepaper/)
