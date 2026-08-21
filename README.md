<div align="center">

# TROUBLE DINER

### お店のピンチを、みんなの攻略データに。

作業者の判断を支え、対応履歴を改善へつなげる  
飲食店トラブル対応フローの個人PoC

</div>

## Live Demo

[GitHub PagesでDEMO MODEを開く](https://ryohei0otsuka.github.io/trouble-diner/)

公開デモはPHP・MySQL不要で、そのまま操作できます。対応記録・未分類トラブル・追加クエストは閲覧者自身のブラウザにだけ保存され、集計画面から初期状態へ戻せます。

![TROUBLE DINER ホーム画面](docs/screenshots/home.png)

## About

飲食店でトラブルが起きたとき、作業者が「何を確認するか」「どこまで対応するか」「誰へ引き継ぐか」で迷う時間を減らすためのタッチパネル型Webアプリです。

```text
受付 → 確認 → 切り分け → 対応／引き継ぎ → 記録 → 集計 → 改善
```

単なるマニュアルではなく、対応結果を蓄積し、頻発・長期化・再発している問題を開発・保守側へ返すところまでを扱います。

## Features

- ドット絵の店内マップから発生エリアを選択
- YES／NOを中心にした1画面1判断の対応フロー
- 「判断できない」「危険を感じる」の常設退避ルート
- 一次解決・使用停止・エスカレーションの記録
- 確認経路を含む引き継ぎ票の生成
- 件数・影響度・対応時間・再発性による改善優先度集計
- 想定外トラブルを蓄積する未分類ボックス
- タブレット・スマートフォン・PC対応のPWA

## Modes

| Mode | Storage | Use |
|---|---|---|
| `DB CONNECTED` | PHP + MySQL / MariaDB | XAMPPで完全版を検証 |
| `DEMO MODE` | Browser localStorage | GitHub Pagesなどで操作感を公開 |

## Tech Stack

`React 19` `TypeScript 5.9` `Vite 8.2` `PHP 8+` `MySQL / MariaDB` `XAMPP` `PWA`

## Local Setup

リポジトリを`C:\xampp\htdocs\trouble-diner`へ配置するか、同じパスへのジャンクションを作成します。XAMPPでApacheとMySQLを起動し、phpMyAdminから`database/setup.sql`をインポートした後、リポジトリ直下で実行します。

```powershell
npm install
npm run dev
```

```text
http://localhost:5173/
```

`DB CONNECTED`ならMySQL接続版、`DEMO MODE`ならブラウザ内デモで動作しています。

## Safety and Privacy

- 危険・判断不能時は、解決を強制せず使用停止・連携へ逃がす
- アレルギー・衛生・設備異常を作業者の推測で判断させない
- TRAININGのEXPを実対応の速さや個人評価に使用しない
- 実在企業、実際の手順書、障害コード、対応履歴、個人情報は使用しない

本プロジェクトは特定の企業・業務・サービスを再現したものではなく、一般的なトラブル対応業務を題材とした個人PoCです。

掲載内容は模擬練習用であり、実際の緊急対応や食品衛生上の判断を代替しません。

ドット絵素材は本プロジェクト用に生成したオリジナル素材です。

## License

MIT License
