# ARCHITECTURE — ハイパーロボット ONLINE

## 構成
- Cloudflare Workers：`dist/server/index.js`（エントリ・API）、`engine.js`（盤面ロジック）、`bots.js` / `bot-controller.js`（ボット）、`ui.js`（HTML/CSS/JS を文字列で返す）、`icons.js`
- ビルド工程なし。`dist/` がそのままソース。
- 公開先：https://hyper-robot-online.sakamototakurounin.workers.dev（`workers_dev: true`）
- API：`/api/room/create`・`/api/room/join`・`/api/state`・`/api/start`・`/api/attempt`・`/api/submit`・`/api/finish`・`/api/cancel`・`/api/leave`・`/api/bot/*`（同期はポーリング方式）

## 保存方式
- **Cloudflare D1**（binding `DB`、database `hyper-robot-db`）：rooms / players / rounds / submissions / events / player_rounds / player_stats / bot_rounds
  - スキーマ：`db/schema.ts`（drizzle）、マイグレーション：`drizzle/0000〜0009`
- localStorage：`hr-token`（認証トークン）、`hr-name`、`hr-profile`（永続プロフィール ID）、`hr-board-design` / `hr-robot-design`

## デプロイ
- `npm run deploy` = `wrangler d1 migrations apply DB --remote` → `wrangler deploy`（**本番 DB と公開サイトを同時に変更する**。必ず事前確認）
- Cloudflare 認証は `wrangler login`（トークンはリポジトリに置かない。`.dev.vars*`・`.env*` は gitignore 済み）

## 重要な設計判断
- マイグレーションは追加専用（0003 はバックフィル）。既存ファイルは編集しない。
- プロフィールは `hr-profile` で端末に紐づけて永続化（0007）。
- ローカル開発・E2E は `.wrangler/` 内のローカル D1 を使用（`--local`）。

## テスト
- `npm run check`：構文チェック
- `npm run test:e2e`：Playwright（iPhone 13 / Desktop Chrome）。ローカル D1 にマイグレーションを適用してから `wrangler dev` を起動する
