# Eカード — 極限心理戦（スマホ縦画面特化）

漫画「カイジ」の Eカード を題材にした、プレイヤー対 CPU の心理戦 Web アプリ。
スマートフォン縦画面（`100dvh`・スクロールなし）で片手プレイできるよう最適化しています。

## ルール

- 王様側: 王様 1 枚 + 市民 4 枚 ／ 奴隷側: 奴隷 1 枚 + 市民 4 枚
- 王様 ＞ 市民、市民 ＞ 奴隷、奴隷 ＞ 王様。市民同士は引き分けで次ターンへ（最大 5 ターン）
- 毎ターン **奴隷側が先に** 伏せ、王様側が後に伏せる。双方が出したら 1.5 秒のタメの後に同時オープン
- **5 勝先取**。1 セットごとに王様側／奴隷側を交代

## 演出

- PK 風スコアボード（勝ち: 黄金の天使、負け: 血色の悪魔、引き分け: `-`、進行中: 点滅する破線サークル）
- 3D フリップでカードを公開。結果オーバーレイにも両者のカードを大きく並べて表示
- 最終勝利: 地下財宝の一枚絵 ／ 最終敗北: 地下牢の一枚絵
- Web Audio API で心拍音をシンセ生成（ターン進行と REVEAL 直前で BPM 上昇）。外部音源ファイル不要
- ヘッダーのスピーカーアイコンでミュート切替

## 画像アセットの差し替え

`e-card-src/src/assets/` に以下のファイル名（png / jpg / webp）で画像を置いてビルドすると、SVG の代わりにそれを使います（無ければ SVG で描画）。

`king.png` `citizen.png` `slave.png` `card_back.png` `angel.png` `demon.png` `win_treasure.png` `lose_dungeon.png`

## フォルダ構成と公開

- `e-card-src/` … ソースコード（このフォルダ）
- `e-card/` … `npm run build` の出力。GitHub Pages で `https://kiyo0630-cpu.github.io/compass-/e-card/` として配信される
- `.github/workflows/e-card-build.yml` … main の `e-card-src/` が変わると自動でビルドして `e-card/` をコミットする

スマホの Safari で開いて「共有 → ホーム画面に追加」すると、フルスクリーンのアプリとして起動できます。

## 開発

```bash
cd e-card-src
npm install
npm run dev -- --host   # 同じ Wi-Fi のスマホから Network の URL で開ける
npm run build           # ../e-card に出力（base は './' なのでサブディレクトリ配信可）
```

開発サーバー限定で `?debug=win` / `?debug=lose` を付けると最終結果画面を直接確認できます。

技術スタック: React + TypeScript + Vite + Tailwind CSS v4 + Framer Motion + Lucide React
