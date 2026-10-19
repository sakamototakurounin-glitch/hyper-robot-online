# 外部サービスと連携方針

| サービス | 用途 | 状態 |
|---|---|---|
| GitHub | ソース管理（sakamototakurounin-glitch/hyper-robot-online） | 接続済み |
| Cloudflare Workers + D1 | 配信・API・DB | 利用中 |
| OpenAI（.openai/hosting.json） | ホスティング設定（project_id のみ） | 詳細不明 |
| Supabase / Vercel | — | 未使用 |

## 提案（未実施・要確認）
1. **D1 のバックアップ**：本番マイグレーションの前に `wrangler d1 export hyper-robot-db --remote --output backup.sql` を取る手順をルール化する（backup.sql はコミットしない）。D1 の Time Travel（過去 30 日の復元）も使える。
2. **Cloudflare × GitHub 連携の注意点**：自動デプロイを設定すると、main への push で本番 D1 のマイグレーションまで走る。自動にする場合は、デプロイコマンドを `wrangler deploy` のみにして、マイグレーションは手動・事前確認とするのが安全。
3. **プレビュー環境**：`wrangler versions upload` でプレビュー URL を作る。ただし D1 は本番を共有するため、プレビュー用に D1 を分けるかは要検討。
4. Supabase / Vercel への移行は不要（D1 で要件を満たしている）。
