#!/bin/bash
# WELLSHIP リポジトリ分離 - 最終ステップ

echo "🚀 WELLSHIP リポジトリ分離 - 最終ステップ"
echo ""
echo "このスクリプトは以下を実行します:"
echo "1. WELLSHIP → WELLSHIP_MVP にリネーム"
echo "2. 動作確認の案内"
echo ""

# 現在のディレクトリを確認
if [ "$(basename $(pwd))" = "WELLSHIP" ]; then
    echo "❌ エラー: WELLSHIPディレクトリ内からは実行できません"
    echo "以下のコマンドを実行してください:"
    echo ""
    echo "  cd /Users/wataru"
    echo "  bash WELLSHIP/finalize-migration.sh"
    echo ""
    exit 1
fi

# /Users/wataru にいることを確認
if [ "$(pwd)" != "/Users/wataru" ]; then
    echo "⚠️  警告: /Users/wataru ディレクトリにいません"
    echo "現在のディレクトリ: $(pwd)"
    read -p "続行しますか? (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "キャンセルしました"
        exit 0
    fi
fi

# WELLSHIP ディレクトリの存在確認
if [ ! -d "WELLSHIP" ]; then
    echo "❌ エラー: WELLSHIP ディレクトリが見つかりません"
    exit 1
fi

# WELLSHIP_MVP が既に存在する場合は警告
if [ -d "WELLSHIP_MVP" ]; then
    echo "⚠️  警告: WELLSHIP_MVP ディレクトリが既に存在します"
    read -p "上書きしますか? (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "キャンセルしました"
        exit 0
    fi
    rm -rf WELLSHIP_MVP
fi

# リネーム実行
echo ""
echo "📝 WELLSHIP → WELLSHIP_MVP にリネーム中..."
mv WELLSHIP WELLSHIP_MVP

if [ $? -eq 0 ]; then
    echo "✅ リネーム完了!"
    echo ""
    echo "📁 現在の構成:"
    echo "  /Users/wataru/WELLSHIP_MVP  (SaaS アプリケーション)"
    echo "  /Users/wataru/WELLSHIP_LP   (ランディングページ)"
    echo ""
    echo "🎉 移行が完全に完了しました！"
    echo ""
    echo "次のステップ:"
    echo "1. 動作確認:"
    echo "   cd /Users/wataru/WELLSHIP_MVP/SaaS && npm run dev"
    echo "   cd /Users/wataru/WELLSHIP_LP && npm run dev"
    echo ""
    echo "2. GitHubリポジトリの設定:"
    echo "   - WELLSHIP_MVP用の新しいリポジトリを作成"
    echo "   - WELLSHIP_LP用の新しいリポジトリを作成"
    echo "   - 各ディレクトリでリモートを設定してプッシュ"
    echo ""
    echo "詳細は WELLSHIP_MVP/MIGRATION_GUIDE.md を参照してください"
else
    echo "❌ エラー: リネームに失敗しました"
    exit 1
fi
