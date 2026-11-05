# AGENTS.md

お弁当づめ：形のちがうおかず（ポリオミノ）を、お弁当箱のます目にすき間なく詰める1日3箱のパズル。`index.html` と `gen.js`（箱の作り方）を GitHub Pages で公開する。

## 準備（最初に一度）

```bash
bash scripts/setup.sh   # Node.js（版は .nvmrc）を確かめ、検査の依存とブラウザを入れる。何度実行してもよい
```

## push する前の確認

```bash
node qa/run.mjs   # 箱の作り方（4つの大きさ×400箱が答えどおりに埋まる・詰め方の数を別の数え方で確かめる）・3箱の組み方・詰める/回す/戻す・ヒント・続きから・上級・図鑑・スマホ幅・PWA（CI の QA と同じ）
```

## このリポジトリの決まり

- 箱は `gen.js` の `make` が種から作る：先に箱をおかずに切り分けてから（必ず解ける）、候補4つのうち詰め方の少ないものを選び、おかずの並びと向きを種で混ぜて出す。大きさとおかずの大きさは `SIZES`（小・中・大）と `HARD`（特盛・仕切り2つ）。回すのはよいが裏返しはしない（裏返した形は別の形）。
- 1箱の中で、形がちがえば必ずちがうおかず（色と絵）にする。同じ形のおかずは2つまで（QA が見る）。
- 今日の3箱・上級は日本時間の日付から作る種（`seedOf`）で決まり、だれでも同じ。`Math.random()` は練習・とことんの箱の種だけ（QA が数を見る）。`gen.js` を変えると過去の日の箱も変わるので、変えた PR に一言書く。
- ★はヒントの数（0で★3・1で★2・2で★1）。ヒントは1品を答えの場所に詰め、動かせなくする（2回まで）。上級はヒントなし。時間制限は付けない。
- 今日の3箱・上級は1日1回で、途中で閉じても詰めたおかずとヒントのまま続きから。保存してあった置き方は、形と場所が正しいか確かめてから使う（`valid`）。途中経過はモードごとに分けて保存し（`runs.d`・`runs.h`・`runs.p`）、練習で今日・上級の途中を消さない。答えを入れる前に、保存した進み具合が画面と同じ箱か確かめる。記録は保存の前に読み直す。保存に失敗したあとは、途中経過を時刻でなく進み具合で選び、図鑑の数は多いほうを残す（shared-workflows `incidents/2026-11-04-daily-game-save-gaps.md`）。
- とことん（`runs.e`）：今日の分のあとも続けて遊べるよう、小3→中5→大10→特盛42箱を毎回ちがう種で次々に出す（`endlessList`）。ヒント1回で🎫1枚（3枚まで）、「ここで降りる」で終わり、詰めた箱の数の自己ベスト `ebest` を残す。今日の記録・連続・Ko-fi・シェアには数えない（図鑑・詰めた箱には入る）。他の人との順位は出さない。ホームと今日の結果の画面に大きなボタンを置く（2026-11-05 satou さん「一日で遊べる量が少なすぎる」）。
- 実績（`ACH`）は記録（`days`・`hdays`・`pdays`・`eat`）から毎回数え、新しく残すのは結果の画面で知らせ終えた印 `ach` だけ。腕前・集める・続けるをまぜ、まだのものは「いま/目標」を出す。実績を足したら QA の数（10〜14）も見直す。詰めたおかずはぽんと入り（`flash`）、完成で順に光る（`wave`）。どう詰めても埋まらない小さな空き（`gapsOf`）には斜線を出す（答えは教えない。答えどおりの途中では出さないのを QA が見る）。
- 取りこぼした日（きのう〜7日前、`EPOCH` より後）は、カレンダーから「あとから」遊べる。途中経過は日付ごとに `runs["a:日付"]`（別の日を選んでも前の日の途中を消さない）、記録は `pdays`。問題は `dailyList(その日)` のまま。連続の日・今日の記録・シェア・Ko-fi には数えない（図鑑・詰めた箱・実績の日数には入る）。`load` は合わせる前に両方を `fresh()` で補う。
- 共有は遊ぶ人が押したときに開くリンク（X・LINE・Web Share・コピー）だけ。シェアの文に箱の形・答えを出さない（🍱ヒントなし・🟨1回・🟧2回）。
- 文字は少なめ・一画面一箱。お笑いの言葉は入れない（QA が見る）。ほかの作品の名前・キャラ・見た目は使わない。
- 感想は「感想を送る」から GitHub の Issue フォーム（`.github/ISSUE_TEMPLATE/feedback.yml`、ラベル「感想」）を開くだけ。項目は shared-workflows の `template/.github/ISSUE_TEMPLATE/feedback.yml` と同じにし、名前・メールは聞かない。週1で shared-workflows `routines/game-feedback.md` が読んで直す。
- 応援は Ko-fi（https://ko-fi.com/satouaaaaa）へのただのリンクだけ。今日の3箱・上級を初めて終えて全部ヒントなしのときだけ、結果の画面の下に1行（共有フォルダ kofi/app-guide.md）。遊ぶのは無料のまま、有料版は置かない。
- 外へ通信しない。外から読むのは Google Fonts の文字だけ（CSP の `connect-src 'self'` を広げない）。記録は遊ぶ人のブラウザ（localStorage）だけ。
- 同じ日はどの端末でも同じ問題にする：乱数は `sort` の比較の中で引かない（QA が見る）。少し遅れて動く処理（setTimeout）は、画面が替わっていたら何もしない。
- 押せる所は高さ44px以上、箱のますは幅320pxの特盛でも36px以上（QA が見る）。機能を足す・直すたびに `qa/run.mjs` に検査を足す。乱数で組む部分は何百回も作って確かめる（shared-workflows `incidents/2026-10-31-roppo-empty-village.md`）。
- PWA（`manifest.webmanifest`・`sw.js`・`icon-*.png`）：画面のファイルを足したら `sw.js` の `SHELL` にも足し、中身を大きく変えたら `CACHE` の版を上げる。アイコンは `node tools/make-icons.cjs`、SNS 用の絵 `og.png` は `node tools/make-og.cjs`（今日の箱を入れない）。
- 公開リポジトリなので、個人情報・鍵を入れない。

## 公開

- GitHub Pages は `main` のルート（`/`）を公開する。PR の QA と Secret scan が ✅ になると `automerge.yml` が自動でマージする。止めたいときは下書きにするか、ラベル「自動マージしない」を付ける。
- `sw.js`・`manifest.webmanifest` を変える PR は自動ではマージされない（`hold_paths`）。CodeRabbit のレビューを待ち、手でマージする直前に今の head へのレビューを読み直す（shared-workflows `incidents/2026-11-01-roppo-merged-before-review.md`）。CodeRabbit は PR に `@coderabbitai review` とコメントして頼む。

## 共通のきまり

- PR の作り方・マージの仕方は satou-aaaaa/shared-workflows の `routines/pr.md`、全体のきまりは `routines/common.md` に従う。
- CI の部品は shared-workflows の共通部品を呼ぶ。リポジトリ側の .github/workflows には呼び出しと設定値だけを書く。
- Claude 以外の AI・人が作業するときは、shared-workflows の `routines/tool-map.md` と `routines/without-claude.md` を読む。
