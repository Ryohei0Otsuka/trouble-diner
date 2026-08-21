# Local setup with XAMPP

## Requirements

- Windows 11
- XAMPP（Apache / MySQL）
- Node.js 22
- npm

## 1. Repository

GitHub Desktopでクローンしたフォルダを管理元として使用します。

```text
C:\Users\<WindowsUser>\Documents\GitHub\trouble-diner
```

XAMPPから参照するため、コマンドプロンプトでジャンクションを作成します。

```cmd
mklink /J "C:\xampp\htdocs\trouble-diner" "C:\Users\<WindowsUser>\Documents\GitHub\trouble-diner"
```

## 2. Database

1. XAMPP Control PanelでApacheとMySQLを起動
2. [http://localhost/phpmyadmin/](http://localhost/phpmyadmin/)を開く
3. 上部メニューの`インポート`を選択
4. `database/setup.sql`を指定して実行
5. `trouble_diner`データベースと7テーブルを確認

API確認：

```text
http://localhost/trouble-diner/api/index.php?action=bootstrap
```

JSONの`ok`が`true`、`dataSource`が`mysql`なら接続成功です。

## 3. Frontend

リポジトリ直下で実行します。

```powershell
npm install
npm audit
npm run dev
```

[http://localhost:5173/](http://localhost:5173/)を開きます。画面右上が`DB CONNECTED`なら完全版、`DEMO MODE`ならブラウザ内デモで動作しています。

## 4. Production build

```powershell
npm run build
```

```text
http://localhost/trouble-diner/dist/
```

HTMLファイルを直接ダブルクリックせず、Apache経由で開いてください。

## Database defaults

```text
host:     127.0.0.1
port:     3306
database: trouble_diner
user:     root
password: empty
```

変更する場合は、次のOS環境変数を使用します。

- `TROUBLE_DINER_DB_HOST`
- `TROUBLE_DINER_DB_PORT`
- `TROUBLE_DINER_DB_NAME`
- `TROUBLE_DINER_DB_USER`
- `TROUBLE_DINER_DB_PASS`

秘密情報や本番用認証情報はGitHubへコミットしないでください。
