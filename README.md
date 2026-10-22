# compass-

GitHub Pages で公開している個人用 Web ページ群と、その生成スクリプトをまとめたリポジトリです。
公開 URL: `https://kiyo0630-cpu.github.io/compass-/`

## 収録物

| パス | 内容 | 技術 |
|---|---|---|
| `index.html` | **コンパス手帳** — 価値観を今日の一行へ落とし込む手帳アプリ | 単一 HTML（依存なし） |
| `attack-map/` | **日本へのサイバー攻撃マップ** — Cloudflare Radar の送信元国シェアを地球儀とランキングで表示。詳細は [attack-map/README.md](attack-map/README.md) | 単一 HTML + Node.js スクリプト + Cloudflare Worker |
| `seats/` | **席割り表** — 出社日ごとの座席割り当て | 単一 HTML |
| `caffeine/` | **カフェイン時計** — 体内カフェイン量の時間推移 | 単一 HTML |
| `e-card-src/` → `e-card/` | **Eカード 極限心理戦** — カイジの E カード対 CPU。`e-card-src/` がソース、`e-card/` がビルド成果物。詳細は [e-card-src/README.md](e-card-src/README.md) | React + Vite + Tailwind |
| `keiba/` | **競馬予想シミュレーター** — TARGET frontier JV データで市場確率の校正と特徴量検証。詳細は [keiba/README.md](keiba/README.md) | Python（numpy / pandas） |

## 自動化（GitHub Actions）

| ワークフロー | 役割 |
|---|---|
| `ci.yml` | push / PR ごとに Lint とテスト（下記）。`attack-map/data/` と `reports/` だけの変更では走らない |
| `attack-map-feed.yml` | 毎時 Cloudflare Radar から日本向け攻撃のスナップショットを取得し `attack-map/data/latest.json` をコミット。Secrets に `CLOUDFLARE_API_TOKEN` が必要（任意で `CLOUDFLARE_ZONE_IDS`） |
| `e-card-build.yml` | `e-card-src/` が main で変わったら Vite でビルドし `e-card/` にコミット |

## セットアップ

必要なもの: Node.js 22 以上（`.node-version` 参照）、Python 3.11 以上（keiba と ruff を使う場合）。

```sh
git clone https://github.com/kiyo0630-cpu/compass-.git
cd compass-
npm ci                  # ルート: ESLint など（attack-map のスクリプトとテスト用）
cd e-card-src && npm ci # e-card を触る場合のみ
```

静的ページはビルド不要で、ローカルサーバーを立てればそのまま開けます。

```sh
python3 -m http.server 8000
# http://localhost:8000/            コンパス手帳
# http://localhost:8000/attack-map/ 攻撃マップ（data/latest.json があればそれを読む）
```

## テストと Lint

```sh
npm run lint      # ESLint: attack-map/scripts, attack-map/worker, tests
npm test          # node:test: tests/*.test.mjs
npm run lint:py   # ruff: keiba/*.py（pip install ruff）
npm run check     # lint + test
cd e-card-src && npm run lint && npx tsc -b   # e-card: oxlint + 型チェック
```

テストはネットワークに出ません。Cloudflare API は `tests/helpers/` のモックで差し替えており、
CLI スクリプトは `node --import` でモックをプリロードした子プロセスで実行します。

| テスト | 対象 |
|---|---|
| `tests/radar-lib.test.mjs` | Radar 応答の正規化（国コード・share・並び順・部分失敗時の扱い） |
| `tests/radar-proxy.test.mjs` | Cloudflare Worker の CORS・キャッシュ・入力検証・エラー応答 |
| `tests/cli.test.mjs` | `fetch-radar.mjs` / `targets-from-cloudflare-zone.mjs` の終了コードと出力 JSON |
| `tests/data.test.mjs` | Actions がコミットした `attack-map/data/*.json` がページの期待する形式か |

## 変更の流れ

1. ブランチを切って変更し、`npm run check` が通ることを確認する
2. PR を開くと `ci.yml` が Lint・テスト・e-card のビルド検証を行う
3. main にマージすると GitHub Pages に反映される（`e-card-src/` の変更は `e-card-build.yml` が `e-card/` を再生成する）

`attack-map/data/latest.json` は Actions が毎時上書きするので、手で編集しないでください。
