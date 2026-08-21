# TROUBLE DINER

> お店のピンチを、みんなの攻略データに。

飲食店で起こりうるトラブルを題材に、作業者の判断負荷を減らし、対応履歴を改善材料へつなげるタブレット向けPWAの個人PoCです。

画面はレトロゲーム風ですが、目的はゲームそのものではありません。

`受付 → 確認 → 切り分け → 一次対応 → 使用停止／引き継ぎ → 記録 → 集計 → 改善`

という運用サイクルを、実際に触れる形で検証します。

## 主な機能

- ドット絵の店内マップから発生エリアを選択
- 1画面1判断のタッチ対応フロー
- 質問・行動・結果をDBから読み込むフローエンジン
- 「判断できない」「危険を感じる」の常設退避ルート
- 一次解決・引き継ぎ・使用停止・未分類の記録
- 確認経路を含むエスカレーション票の生成・コピー
- 影響度・対応時間・再発性による改善優先度集計
- 想定外トラブルを蓄積する未分類ボックス
- 1問分岐から始める簡易クエスト作成
- TRAININGモードのEXP演出
- MySQL停止時にも触れるブラウザ内デモモード
- タブレット・スマートフォン・PC対応
- PWAインストールと画面キャッシュ

## 技術構成

- React 19
- TypeScript 5.9
- Vite 8
- PHP 8+
- MySQL / MariaDB
- XAMPP
- CSS（UIライブラリ不使用）

## フォルダ構成

```text
trouble-diner/
├─ api/                 PHP REST API
├─ database/setup.sql  テーブル・初期データ
├─ public/             PWA設定・ドット絵素材
├─ src/                React / TypeScript
├─ index.html
├─ package.json
└─ vite.config.ts
```

## XAMPPでの起動

### 1. 配置

リポジトリを次の場所へ置きます。

```text
C:\xampp\htdocs\trouble-diner
```

GitHub Desktopですでに別の場所へクローンした場合は、リポジトリを上記へ移動するか、Windowsのディレクトリジャンクションを作成してください。

### 2. データベース

XAMPP Control PanelでApacheとMySQLを起動します。

`http://localhost/phpmyadmin/` を開き、`database/setup.sql` をインポートします。

SQLは`trouble_diner`データベースと初期データを作成します。既存の対応記録を削除する処理はありません。

### 3. フロントエンド

Node.js 22系を推奨します。リポジトリ直下で実行します。

```powershell
npm install
npm run dev
```

ブラウザで次を開きます。

```text
http://localhost:5173/
```

画面右上が`DB CONNECTED`ならPHP・MySQL接続成功です。接続できない場合は`DEMO MODE`へ自動的に切り替わります。

### 4. 本番ビルド

```powershell
npm run build
```

Apache経由で次を開きます。HTMLファイルを直接ダブルクリックしないでください。

```text
http://localhost/trouble-diner/dist/
```

## API確認

```text
http://localhost/trouble-diner/api/index.php?action=bootstrap
```

JSONの`ok`が`true`なら接続できています。

## DB接続設定

XAMPPの初期構成は次の値で接続します。

```text
host: 127.0.0.1
port: 3306
database: trouble_diner
user: root
password: 空
```

変更する場合はOSの環境変数を使います。

- `TROUBLE_DINER_DB_HOST`
- `TROUBLE_DINER_DB_PORT`
- `TROUBLE_DINER_DB_NAME`
- `TROUBLE_DINER_DB_USER`
- `TROUBLE_DINER_DB_PASS`

秘密情報はGitHubへコミットしないでください。

## `.gitignore`を置かない運用について

このリポジトリには、指定どおり`.gitignore`を置いていません。GitHub Desktopでコミットするときは、次の生成物を選択しないでください。

- `node_modules/`
- `dist/`
- `*.tsbuildinfo`
- `vite.config.js`
- `vite.config.d.ts`

公開リポジトリの事故防止という点では、将来的に`.gitignore`を追加する運用を推奨します。

## GitHub Pagesについて

GitHub PagesではPHPとMySQLは動きません。静的画面はデモモードで動作しますが、共有DBへの保存は行われません。

公開URLでDB連携まで見せる場合は、PHP対応サーバーへ配置するか、API層を公開サービスへ差し替えます。フロントエンドは`src/lib/api.ts`へデータ取得を集約しているため、UI全体を書き直す必要はありません。

## 安全設計

- 危険・判断不能時は、解決を強制せず停止・連携へ逃がす
- アレルギー、衛生、事故、設備異常を作業者の推測で判断させない
- TRAININGのEXPは学習演出だけに使用し、実対応の速さや件数で個人評価しない
- 実運用時は、店舗の正式な手順書、公的資料、責任者判断を優先する

## 免責・機密情報

本プロジェクトは特定の企業・業務・サービスを再現したものではなく、一般的なトラブル対応業務を題材とした個人PoCです。

以下は使用していません。

- 実在企業・顧客・店舗名
- 実際の障害コード、設備構成、連絡先
- 実際の手順書、SLA、画面、文言
- 実際の対応履歴、件数、個人情報

掲載シナリオは模擬練習用であり、実際の緊急時・食品衛生上の判断を代替しません。

## 画像素材

`public/assets/restaurant-map.png`と`public/assets/crew-mascot.png`は、本プロジェクト専用に生成したオリジナルのドット絵素材です。第三者のゲーム・店舗・キャラクターは参照していません。

生成条件は[`docs/IMAGE_PROMPTS.md`](docs/IMAGE_PROMPTS.md)に記録しています。

## License

MIT License
