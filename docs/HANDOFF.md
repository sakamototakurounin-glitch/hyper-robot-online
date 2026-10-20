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
### 2026-10-20 Codex — Claude Code のPR操作権限を設定（`codex/claude-permissions`）
- `.claude/settings.json` に `gh pr create` / `view` / `checks` / `merge` の許可を追加。トークンや環境変数の値は保存していない。
- `AGENTS.md` に、`gh pr merge` はユーザーが「マージして」と明示した場合のみ、main への直接 push は禁止、と追記。
- 検証：設定JSONと許可4件を確認、既存の構文チェック・ローカルD1のスマホ/PC E2E6件成功。アプリコード・DB・保存データは変更なし。
- 次の作業：ユーザーがPRを確認してマージ。Fine-grained token の作成とクラウド環境の `GH_TOKEN` 登録もユーザーが行う。今回マージ・本番デプロイは実施しない。
### 2026-10-19 Claude Code — 開発環境整備（`claude/dev-setup`）
- 追加：AGENTS.md（共通ルール）、CLAUDE.md（AGENTS.md を取り込む）、docs/、Playwright（`npm run test:e2e`、e2e/smoke.spec.js）
- アプリ本体のコード・データの変更はなし。
- 仕様変更：なし
