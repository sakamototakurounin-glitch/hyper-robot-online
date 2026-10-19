# AGENTS.md — ハイパーロボット ONLINE

オンライン対戦ロボットパズル（Cloudflare Workers + D1）。詳細は `docs/ARCHITECTURE.md`、引き継ぎは `docs/HANDOFF.md`。

## 共通ルール（Claude Code / Codex 共通）

### 方針
- デザインはシンプルに。**スマホ表示を最優先**（幅 390px で崩れない・横スクロールなし）。
- 既存機能とユーザーデータ（localStorage / IndexedDB / DB）を壊さない。保存キーや形式を変える場合は移行処理を必須とする。
- 依頼されていないリファクタ・機能追加・依存追加はしない。差分は最小に。
- 調査と説明は簡潔に。必要なファイルだけ読む（`docs/` を先に読むこと）。

### 禁止・要事前確認（ユーザーの明示的な許可が必要）
- 本番 DB の変更（マイグレーション適用・データ書き換え・削除）
- 公開デプロイ（main への直接 push、本番デプロイコマンドの実行）
- データ削除、`git push --force`、履歴の書き換え
- API キー・環境変数・`.env*`・`.dev.vars*` の閲覧結果を出力・コミットしない。値をコードに直書きしない。

### 同時編集の防止
- 作業は AI ごとのブランチで行う：Claude Code は `claude/<作業名>`、Codex は `codex/<作業名>`。main へは PR 経由で取り込む。
- 着手時に `docs/HANDOFF.md` の「作業中」欄に「担当AI・ブランチ・編集予定ファイル」を書いて commit / push する。
- 他の AI が「作業中」に挙げているファイルは編集しない。必要なら HANDOFF.md に依頼を書く。
- 作業開始前に `git fetch` で最新を取り込み、自分のブランチを main にリベースしておく。

### テスト
- 変更後は既存テストと `npm run test:e2e`（Playwright、スマホ/PC）を実行する。
- E2E はローカルサーバーのみに接続する。本番 URL・本番 API には接続しない。

### 作業終了時（必須）
1. `docs/HANDOFF.md` を更新：変更内容（仕様変更は明記）・未解決の問題・次の作業。「作業中」欄から自分の行を消す。
2. 構成や設計判断が変わった場合は `docs/ARCHITECTURE.md` も更新する。
3. commit してブランチを push する（デプロイはしない）。

## このリポジトリ固有
- コマンド：`npm run check`（構文チェック）、`npm run test:e2e`（ローカルD1で wrangler dev を起動）、`npm run dev`
- **`npm run deploy` と `npm run db:migrate` は本番 D1 を変更するため、実行前に必ずユーザー確認。**
- ソースは `dist/server/*.js` を直接編集する（ビルド工程なし）。
- スキーマ変更は `drizzle/` に新しい連番 SQL を追加する。既存マイグレーションは編集しない。データ削除を伴う SQL は禁止（要確認）。
- 保存キー `hr-token` / `hr-name` / `hr-profile` / `hr-*-design`（localStorage）は既存ユーザーデータ。
