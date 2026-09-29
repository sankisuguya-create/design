# design

小学校向けサイト・教材で使うデザインの正本（仕様・生成器・見本・手順）。

| フォルダ | 内容 |
|---|---|
| [growing-figures/](growing-figures/) | 背景デザイン「成長する図形」：練習を重ねるほど育つ非周期の模様。仕様・生成器・見本帳・検査・手順・色2の台帳 |

## 成長する図形

- [SPEC.md](growing-figures/SPEC.md) — 仕様（育ち方・育ちやすさ・色・軽さ・採否の基準・登録済み／見送った図形）
- [ADD_PATTERN.md](growing-figures/ADD_PATTERN.md) — 新しい図形を足す手順
- [COLORS.md](growing-figures/COLORS.md) — サイトごとの色2の台帳
- [generators.js](growing-figures/generators.js) — 生成器（ペンローズ・多重格子（八角・七角・十角・十二角）・ひまわり・丸い渦格子・生命の花・円弧の曼荼羅・巻き尺の渦・渦の花びら・文字盤の星・パスカルの偶奇・椅子のタイル・フィボナッチの格子・ファレイの円盤・パドバンの三角渦・十進の渦）
- [ideas/](growing-figures/ideas/) — 試作の記録（見送った案を含む）
- [sampler.html](growing-figures/sampler.html) — 見本帳（`python3 -m http.server` で `growing-figures/` を配信して開く）
- [check.cjs](growing-figures/check.cjs) — 採否の検査（`node growing-figures/check.cjs`）

使っているサイト：[arithmetic-timeattack](https://github.com/sankisuguya-create/arithmetic-timeattack)（九九・あまりのあるわり算・長さ・重さ。台帳は COLORS.md）
