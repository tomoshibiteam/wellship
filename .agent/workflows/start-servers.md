---
description: サーバーを起動する (SaaS)
---

# サーバー起動ワークフロー

このワークフローでは、WELLSHIP SaaSサーバーを起動します。

> **Note**: HPは別リポジトリ `WELLSHIP_LP` に移行されました。

## 前提条件

初回のみ、依存関係をインストールする必要があります:

```bash
npm run install:all
```

または:

```bash
cd SaaS
npm install
```

## サーバーの起動

// turbo-all
以下のコマンドを実行すると、SaaSサーバーが起動します:

```bash
npm run dev
```

または、SaaSディレクトリから直接:

```bash
cd SaaS
npm run dev
```

## アクセスURL

起動後、以下のURLでアクセスできます:

- **SaaS**: http://localhost:3001 (または次に利用可能なポート)

## 注意事項

- サーバーを停止するには `Ctrl+C` を押してください
- HPを起動する場合は、別リポジトリ `WELLSHIP_LP` を参照してください
