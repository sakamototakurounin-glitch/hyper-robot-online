# HANDOFF — 作業引き継ぎ

Claude Code / Codex のどちらも、作業開始時にこのファイルを読み、終了時に更新する。新しい記録を上に追加し、古い記録は簡潔に保つ（目安 100 行以内）。

## 作業中（同時編集防止）
| 担当AI | ブランチ | 編集予定ファイル | 開始日 |
|---|---|---|---|
| （なし） | | | |

## 未解決の問題
- `.openai/hosting.json` は Codex/OpenAI 側のホスティング設定ファイル。`.gitignore` に `hosting.json` が含まれるが、既に追跡されている。扱いは未決定。
- フロントは `dist/server/ui.js` に圧縮された 1 行 JS として埋め込まれており、編集しにくい。整形・分割するかは未決定（大きな変更になるため要相談）。
- E2E は現在スモークテストのみ。ルーム作成・対戦フローは未カバー。

## 作業記録
### 2026-10-19 Claude Code — 開発環境整備（`claude/dev-setup`）
- 追加：AGENTS.md（共通ルール）、CLAUDE.md（AGENTS.md を取り込む）、docs/、Playwright（`npm run test:e2e`、e2e/smoke.spec.js）
- アプリ本体のコード・データの変更はなし。
- 仕様変更：なし
