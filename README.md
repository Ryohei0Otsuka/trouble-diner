<div align="center">
  <img src="public/assets/crew-mascot.png" width="148" alt="TROUBLE DINER crew mascot">

TROUBLE DINER

お店のピンチを、みんなの攻略データに。

作業者の判断を支え、対応履歴を次の改善へつなげる
飲食店トラブル対応フローの個人PoC

React TypeScript PHP MySQL / MariaDB PWA XAMPP

</div>



About

飲食店でトラブルが起きたとき、作業者が「何を確認するか」「どこまで対応するか」「誰へ引き継ぐか」で迷う時間を減らすためのタッチパネル型Webアプリです。

単に手順を表示するだけではなく、対応結果を蓄積し、頻発・長期化・再発している問題を開発・保守側へ返すところまでを一つの仕組みとして扱います。

受付 → 確認 → 切り分け → 一次対応／使用停止／引き継ぎ → 記録 → 集計 → 改善

画面はレトロゲーム風ですが、実対応の速さや件数を競わせることが目的ではありません。遊びやすさを入口にしながら、判断の標準化と安全なエスカレーションを検証します。

Screenshots

実画面の確認後、次の3画面を掲載します。撮影条件はdocs/screenshots/README.mdに記録しています。

店内マップと発生エリア選択

1画面1判断の対応フロー

改善優先度を示す集計ダッシュボード

解決したいこと

現場で起こること

TROUBLE DINERでの扱い

最初に何を確認すればよいか分からない

1画面1判断で確認順を固定する

経験者ごとに判断が変わる

YES／NOを中心に分岐を共通化する

危険でも解決を続けようとしてしまう

「危険」「判断できない」退避ルートを常設する

引き継ぎ時に確認内容が抜ける

通過した質問と回答から引き継ぎ票を生成する

対応して終わり、改善へつながらない

件数・影響度・時間・再発性を集計する

想定外の問題がマニュアルから漏れる

未分類ボックスへ蓄積し、次のシナリオ候補にする

主な機能

現場対応

ドット絵の店内マップから発生エリアを選択

大きなタップ領域と1画面1判断の対応フロー

質問・行動・結果をDBから読み込むフローエンジン

「判断できない」「危険を感じる」の常設退避ルート

一次解決・引き継ぎ・使用停止・未分類の記録

確認経路を含むエスカレーション票の生成・コピー

可視化・改善

対応件数、一次解決率、エスカレーション率、平均対応時間

影響度・対応時間・再発性による改善優先度ランキング

最近の対応履歴

想定外トラブルを蓄積する未分類ボックス

1問分岐から始める簡易シナリオ作成

体験・公開

TRAININGモード限定のEXP演出

タブレット・スマートフォン・PC対応

PWAインストールと画面キャッシュ

PHP／MySQL停止時に切り替わるブラウザ内デモモード

Architecture

flowchart LR
    UI["React PWA"] --> API["PHP REST API"]
    API --> DB[("MySQL / MariaDB")]
    UI -. "API接続不可" .-> DEMO["localStorage Demo"]
    DB --> DASH["集計・改善優先度"]
    DEMO --> DASH

フロントエンドのデータアクセスはsrc/lib/api.tsへ集約しています。将来APIやDBを変更する場合も、UI全体を作り直さずに差し替えられる構成です。

動作モード

モード

保存先

用途

DB CONNECTED

PHP + MySQL / MariaDB

XAMPPで完全版を検証する

DEMO MODE

ブラウザのlocalStorage

GitHub Pagesなどで操作感を公開する

GitHub PagesはPHPとMySQLを実行できないため、公開デモではDEMO MODEを使用します。ブラウザごとの保存となり、利用者間でデータは共有されません。

想定シナリオ

注文と違う料理を提供した

料理の提供が大幅に遅れている

POSレジが操作できない

キャッシュレス決済が完了しない

冷蔵設備に異常表示が出た

営業中に主要食材が不足した

持ち帰り商品と注文内容が違う

急な欠勤で人員が不足した

アレルギーについて質問された

店舗設備の電源が入らない

すべて架空のシナリオです。実在店舗の手順やデータは使用していません。

Tech Stack

Layer

Technology

Frontend

React 19 / TypeScript 5.9 / Vite 8.2

Backend

PHP 8+ / PDO / JSON REST API

Database

MySQL / MariaDB

UI

CSS / responsive layout / pixel-art assets

Local environment

XAMPP / Node.js 22

App delivery

PWA / Service Worker

UIライブラリは使用せず、タッチ操作とドット絵の世界観に合わせてCSSを設計しています。

Quick Start with XAMPP

1. リポジトリを配置

GitHub Desktopでクローンしたフォルダを、そのまま管理元として使用できます。

C:\Users\<WindowsUser>\Documents\GitHub\trouble-diner

XAMPPから参照する場合は、コマンドプロンプトでディレクトリジャンクションを作成します。

mklink /J "C:\xampp\htdocs\trouble-diner" "C:\Users\<WindowsUser>\Documents\GitHub\trouble-diner"

別のWindowsユーザーが試す場合は、クローン先に合わせて2つ目のパスを変更してください。

2. データベースを準備

XAMPP Control PanelでApacheとMySQLを起動

http://localhost/phpmyadmin/を開く

database/setup.sqlをインポート

trouble_dinerデータベースと7テーブルを確認

SQLは初期データを登録しますが、既存の対応履歴を削除する処理はありません。

3. フロントエンドを起動

Node.js 22系を推奨します。

npm install
npm run dev

http://localhost:5173/を開き、画面右上がDB CONNECTEDならPHP・MySQL接続成功です。

4. APIを確認

http://localhost/trouble-diner/api/index.php?action=bootstrap

JSONのokがtrue、dataSourceがmysqlなら正常です。

5. 本番ビルド

npm run build

Apache経由で次を開きます。HTMLファイルを直接ダブルクリックしないでください。

http://localhost/trouble-diner/dist/

Database Configuration

XAMPP初期構成では次の値を使用します。

host:     127.0.0.1
port:     3306
database: trouble_diner
user:     root
password: empty

変更する場合はOSの環境変数を使用します。

TROUBLE_DINER_DB_HOST

TROUBLE_DINER_DB_PORT

TROUBLE_DINER_DB_NAME

TROUBLE_DINER_DB_USER

TROUBLE_DINER_DB_PASS

秘密情報や本番用認証情報はGitHubへコミットしないでください。

Project Structure

trouble-diner/
├─ api/                  PHP REST API
├─ database/setup.sql   テーブル・初期データ
├─ docs/                画像生成記録・スクリーンショット
├─ public/              PWA設定・ドット絵素材
├─ src/                 React / TypeScript
├─ .gitignore
├─ LICENSE
├─ README.md
├─ package.json
└─ vite.config.ts

.gitignoreでnode_modules/、dist/、環境変数、ログ、一時生成物を除外しています。依存バージョンを固定するpackage-lock.jsonはコミット対象です。

Safety Design

危険・判断不能時は、解決を強制せず使用停止・連携へ逃がす

アレルギー、衛生、事故、設備異常を作業者の推測で判断させない

TRAININGのEXPは学習演出だけに使用し、実対応の速さや件数で個人評価しない

実運用時は、店舗の正式な手順書、公的資料、責任者判断を優先する

Privacy and Disclaimer

本プロジェクトは特定の企業・業務・サービスを再現したものではなく、一般的なトラブル対応業務を題材とした個人PoCです。

以下は使用していません。

実在企業・顧客・店舗名

実際の障害コード、設備構成、連絡先

実際の手順書、SLA、画面、文言

実際の対応履歴、件数、個人情報

掲載シナリオは模擬練習用であり、実際の緊急対応や食品衛生上の判断を代替しません。

Assets

public/assets/restaurant-map.pngとpublic/assets/crew-mascot.pngは、本プロジェクト専用に生成したオリジナルのドット絵素材です。第三者のゲーム、店舗、キャラクターは参照していません。

生成条件はdocs/IMAGE_PROMPTS.mdに記録しています。

Roadmap

GitHub Pages向けDEMO MODEの自動デプロイ

シナリオ編集機能の拡張とバージョン管理

未分類トラブルからシナリオ候補を作るレビュー画面

拠点別・期間別フィルター

CSVエクスポート

テストコードと操作ログの検証

License

MIT License