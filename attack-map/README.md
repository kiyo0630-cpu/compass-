# 日本へのサイバー攻撃マップ

日本を標的（宛先）とするサイバー攻撃の**送信元 国・地域**を、太平洋中心の世界地図上に
リアルタイム風のアニメーションとランキングで表示する単一 HTML ページです。
ビルド不要で、GitHub Pages にそのまま置けます。

- ページ: `attack-map/index.html`（公開 URL の例: `https://<user>.github.io/<repo>/attack-map/`）
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
  scripts/targets-from-cloudflare-zone.mjs 自分のゾーンへの攻撃をホスト名別に集計（任意）
  data/targets.json       上記の出力（CLOUDFLARE_ZONE_IDS 設定時のみ）
  worker/radar-proxy.js   Cloudflare Worker プロキシ
  worker/wrangler.toml
.github/workflows/attack-map-feed.yml
```

ローカルで試す:

```sh
CLOUDFLARE_API_TOKEN=xxxx node attack-map/scripts/fetch-radar.mjs --out attack-map/data/latest.json --range 1d
python3 -m http.server 8000   # http://localhost:8000/attack-map/
```

## 参考資料

- NICT [NICTER 観測レポート 2025](https://www.nict.go.jp/press/2026/02/05-1.html) / [NICTER 観測統計](https://blog.nicter.jp/)
- Cloudflare [Radar: Japan](https://radar.cloudflare.com/security?location=jp) / [Radar API](https://developers.cloudflare.com/radar/)
- 総務省 [情報通信白書](https://www.soumu.go.jp/johotsusintokei/whitepaper/)
