# WELLSHIP リポジトリ分離 - 移行ガイド

## 📋 実施内容

WELLSHIPモノレポジトリを以下の2つの独立したリポジトリに分離しました:

### 1. WELLSHIP_MVP (このディレクトリ)
- **内容**: SaaSアプリケーションのみ
- **パス**: `/Users/wataru/WELLSHIP` (まもなく `WELLSHIP_MVP` にリネーム)
- **構成**:
  - `SaaS/` - メインアプリケーション
  - `.agent/` - ワークフロー設定
  - `README.md` - 更新済み
  - `package.json` - HP関連スクリプト削除済み

### 2. WELLSHIP_LP (新規作成)
- **内容**: ランディングページ・マーケティングサイト
- **パス**: `/Users/wataru/WELLSHIP_LP`
- **構成**:
  - 元の `hp/` ディレクトリの全内容を移行
  - `README.md` - 新規作成済み
  - Next.js プロジェクトとして独立

## ✅ 完了した作業

1. ✅ `/Users/wataru/WELLSHIP_LP` ディレクトリを作成
2. ✅ `hp/` の全ファイルを `WELLSHIP_LP/` にコピー
3. ✅ `WELLSHIP/hp/` ディレクトリを削除
4. ✅ `WELLSHIP/README.md` を更新（SaaS専用に）
5. ✅ `WELLSHIP/package.json` を更新（HP関連スクリプト削除）
6. ✅ `.agent/workflows/start-servers.md` を更新
7. ✅ `WELLSHIP_LP/README.md` を作成

## 🔧 次のステップ（手動作業が必要）

### ステップ 1: WELLSHIP を WELLSHIP_MVP にリネーム

現在のディレクトリから出て、リネームを実行してください:

```bash
cd /Users/wataru
mv WELLSHIP WELLSHIP_MVP
```

### ステップ 2: Git リポジトリの設定

#### WELLSHIP_MVP の Git 設定更新

```bash
cd /Users/wataru/WELLSHIP_MVP

# リモートリポジトリを確認
git remote -v

# 必要に応じてリモートURLを更新
# git remote set-url origin <新しいWELLSHIP_MVP用のGitHubリポジトリURL>

# 変更をコミット
git add .
git commit -m "chore: migrate to WELLSHIP_MVP - remove HP directory and update configs"

# プッシュ（リモートが設定されている場合）
# git push origin main
```

#### WELLSHIP_LP の Git 初期化

```bash
cd /Users/wataru/WELLSHIP_LP

# Git リポジトリを初期化
git init

# 初回コミット
git add .
git commit -m "feat: initial commit - WELLSHIP Landing Page"

# GitHubに新しいリポジトリを作成後、リモートを追加
# git remote add origin <WELLSHIP_LP用のGitHubリポジトリURL>
# git branch -M main
# git push -u origin main
```

### ステップ 3: 動作確認

#### WELLSHIP_MVP (SaaS) の動作確認

```bash
cd /Users/wataru/WELLSHIP_MVP
npm run dev
# http://localhost:3001 でアクセス可能か確認
```

#### WELLSHIP_LP (HP) の動作確認

```bash
cd /Users/wataru/WELLSHIP_LP
npm install  # 念のため再インストール
npm run dev
# http://localhost:3000 でアクセス可能か確認
```

### ステップ 4: IDE/エディタの設定更新

使用しているIDEやエディタで、ワークスペース設定を更新してください:

- **VS Code**: 2つの別々のワークスペースとして開く
- **Cursor**: 同様に2つの独立したプロジェクトとして管理

## 📝 変更点まとめ

### WELLSHIP_MVP の変更

| ファイル | 変更内容 |
|---------|---------|
| `README.md` | モノレポからSaaS専用に更新 |
| `package.json` | HP関連スクリプト削除、名前を `wellship-mvp` に変更 |
| `.agent/workflows/start-servers.md` | SaaS専用ワークフローに更新 |
| `hp/` ディレクトリ | 削除（WELLSHIP_LPに移行） |

### WELLSHIP_LP の変更

| ファイル | 変更内容 |
|---------|---------|
| `README.md` | HP専用の新規README作成 |
| 全ファイル | `WELLSHIP/hp/` から移行 |

## 🎯 利点

この分離により、以下のメリットが得られます:

1. **容量削減**: 各リポジトリが軽量化
2. **独立したデプロイ**: HPとSaaSを別々にデプロイ可能
3. **明確な責任分離**: マーケティング（LP）とプロダクト（SaaS）の分離
4. **開発効率向上**: 各チームが独立して作業可能
5. **Git履歴の整理**: 各リポジトリが専用の履歴を持つ

## ⚠️ 注意事項

- 両方のリポジトリで `node_modules` が存在するため、ディスク容量に注意
- 共通のコンポーネントやユーティリティがある場合は、npm パッケージ化を検討
- 環境変数ファイル（`.env`）は各リポジトリで個別に管理

## 🔗 関連ドキュメント

- [WELLSHIP_MVP README](/Users/wataru/WELLSHIP/README.md)
- [WELLSHIP_LP README](/Users/wataru/WELLSHIP_LP/README.md)

---

**作成日**: 2026-01-09  
**作成者**: Antigravity AI Assistant
