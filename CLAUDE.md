# CLAUDE.md

共通ルールは AGENTS.md に集約しています（Codex と共有）。必ず従うこと。

@AGENTS.md

## Claude Code 向け補足
- Auto Memory はクラウドセッションでは引き継がれず、Codex からも読めません。**重要事項は Memory ではなく `docs/HANDOFF.md` に記録してコミットする**こと。
- ローカル環境で Auto Memory を使う場合も、内容は HANDOFF.md と矛盾させないこと（HANDOFF.md を優先）。
