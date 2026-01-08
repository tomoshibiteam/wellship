# WELLSHIP_MVP

WELLSHIP SaaSアプリケーション - 船上の食事管理を最適化するAIプラットフォーム

> **Note**: このリポジトリは以前のWELLSHIPモノレポから分離されました。  
> ランディングページ（HP）は別リポジトリ `WELLSHIP_LP` に移行されています。

## プロジェクト構成

### 📱 SaaS
船上の食事管理を最適化するAIプラットフォーム（メインアプリケーション）

**ディレクトリ**: `./SaaS`

**主な機能**:
- AI献立作成
- クルーフィードバック管理
- 調達・在庫管理
- ESG分析レポート

## 🚀 クイックスタート

### 初回セットアップ

```bash
# 依存関係をインストール
cd SaaS
npm install
```

### サーバー起動

```bash
# SaaSアプリケーションを起動
cd SaaS
npm run dev
```

**アクセスURL**:
- SaaS: http://localhost:3001 (または次に利用可能なポート)

## 開発環境

- Node.js 20+
- Next.js 16
- TypeScript
- Prisma (SaaSのみ)

## ドキュメント

SaaSプロジェクトの詳細なドキュメントは各ファイルを参照してください:
- [DEMO_SCENARIO.md](./SaaS/DEMO_SCENARIO.md) - デモシナリオ
- [DIFY_INTEGRATION.md](./SaaS/DIFY_INTEGRATION.md) - Dify統合ガイド
- [ENV_GUIDE.md](./SaaS/ENV_GUIDE.md) - 環境変数設定ガイド
- [ROADMAP.md](./SaaS/ROADMAP.md) - ロードマップ
