# Publish DEMO MODE

GitHub PagesではPHPとMySQLを使用せず、ブラウザ内へ保存する`DEMO MODE`を公開します。

## 1. Push

変更を`main`ブランチへコミットし、GitHubへPushします。

## 2. Enable GitHub Pages

GitHubのリポジトリ画面で次を設定します。

```text
Settings → Pages → Build and deployment → Source → GitHub Actions
```

## 3. Check deployment

`Actions`タブで`Deploy demo to GitHub Pages`が緑色になったら公開完了です。

```text
https://ryohei0otsuka.github.io/trouble-diner/
```

以後は`main`へPushするたびに自動更新されます。

## Local demo check

PHP・MySQLへ接続せず、公開版と同じ動作をローカルで確認できます。

```powershell
npm run dev:demo
```
