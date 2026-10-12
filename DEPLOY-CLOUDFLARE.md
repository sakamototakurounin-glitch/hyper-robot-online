# ハイパーロボット ONLINE

公開サイト: https://hyper-robot-online.sakamototakurounin.workers.dev

このリポジトリの設定は現在の公開先に接続済みです。同じCloudflareアカウントで更新する場合は、npm ci → npx wrangler login → npm run deploy の順で実行します。以下は別アカウントに新しく公開する場合の手順です。

ルーム名で集まれるオンライン対戦ロボットパズル。1人プレイ、ボット、6色のロボット、虹色の目的地、最短経路探索、表示テーマを備えています。

## 公開手順

1. GitHubで空のリポジトリを作り、このフォルダーのファイルをアップロードします。
2. Cloudflareのアカウントを作り、手元のPCで以下を実行します。

~~~sh
npm install
npx wrangler login
npm run db:create
~~~

3. 表示されたdatabase_idをwrangler.jsoncのREPLACE_WITH_YOUR_D1_DATABASE_IDと置き換えます。bindingはDBのままにしてください。
4. 以下を実行します。

~~~sh
npm run check
npm run deploy
~~~

5. 表示されたworkers.devのURLで遊べます。更新後もnpm run deployで反映します。

## GitHub連携

CloudflareのWorkers & PagesでGitHubリポジトリを接続すれば自動デプロイを設定できます。D1を作成・初期化してから接続し、デプロイコマンドをnpm run deployにします。

## データ

このパッケージはソースとDBの構造だけを含みます。従来のSitesの部屋・得点・能力データは自動では移行されません。認証情報はGitHubにアップロードしないでください。

## 操作

ロボットをタップして選択・解除。移動はスワイプまたは方向キー。解答を決定するとLIVEに反映されるまで解答中表示を保持します。
