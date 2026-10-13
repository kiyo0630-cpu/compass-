# keiba — 競馬予想シミュレーター（TARGET frontier JV データ）

`index.html`（コンパス）とは独立したサブプロジェクト。このフォルダ内で完結する。

## 構成

| パス | 内容 |
|---|---|
| `split_history.py` | TARGET「レース一覧成績」の大きな CSV を四半期ごとに分割して zip にする（Mac 側で実行） |
| `load_results.py` | レース一覧成績 CSV を読み込み、ベースライン（人気別・オッズ帯別回収率、市場確率の校正）を出す |
| `features.py` | 補正タイム（固定効果回帰）、文脈化した上がり 3F、馬ごとの履歴特徴量を作り `data/features.csv` に書く |
| `model_clogit.py` | 条件付きロジット（レース内 softmax）で「市場 + 特徴量」が「市場のみ」を上回るかをウォークフォワード検証 |
| `eval_indices.py` | 出馬表形式 CSV（ZI・マイニング・対戦型マイニング入り）を溜めて指数の情報量を測る |
| `docs/research-v2.md` | 調査レポート（JV-Data の棚卸し、市場の知見、精度向上の工夫、仮説リスト） |
| `results/` | 検証結果（CSV）。`model_clogit.py` が書き出す。**git 管理外**（下の「結果の置き場」参照） |
| `data/` | 入力データと中間ファイル。**git 管理外**（Google Drive 経由で受け渡し） |

## データの置き方

```
keiba/data/history/history_2016_Q1.csv ... history_2026_Q2.csv   ← レース一覧成績（cp932）
keiba/data/features.csv                                           ← features.py の出力
```

## 実行順

```
python3 load_results.py data/history        # ベースライン
python3 features.py                         # 特徴量テーブル（約 1.5 分）
python3 model_clogit.py                     # ウォークフォワード検証（約 40 秒）
```

依存は numpy と pandas のみ。

## 列の意味（データから確定したもの）

- クラスコード: 7 未勝利 / 15 新馬 / 23 1勝 / 43 2勝 / 67 3勝 / 115 リステッド / 131 OP特別 / 147 格付けなし重賞 / 163 G3 / 179 G2 / 195 G1
- コースコード: 0 芝（内・通常） / 8 芝外回り / 1 ダート
- 間隔: 前走からの週数（日数 ÷ 7 の四捨五入）
- PCI: 前半 600m 換算タイム ÷ 上がり 3F × 100 − 50（大きいほどスロー）
- レースID: 末尾 2 桁が馬番。レース単位のキーは末尾を落とす

## 結果の置き場

検証結果（`results/` の CSV 4 本と、これまでの結果の要約）は 2026-10-13 に公開リポジトリから外し、
Google Drive（マイドライブ直下の `keiba_results` フォルダ。非公開で、`data/` の zip と同じ場所）へ移した。
`model_clogit.py` を実行すると `results/` に同じ形式で作り直されるが、`.gitignore` で除外しているので git には入らない。
調査レポートは引き続き `docs/research-v2.md`。
