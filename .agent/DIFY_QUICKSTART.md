# Dify統合 クイックスタートガイド

## 🚀 5分で始めるDify統合

このガイドに従えば、**5分でDify統合を完了**できます。

---

## ✅ チェックリスト

開始前に以下を確認:

- [ ] Difyアカウント作成済み（https://dify.ai/）
- [ ] Gemini APIキー取得済み（https://aistudio.google.com/）
- [ ] WELLSHIPローカル環境起動済み

---

## 📋 ステップ1: Dify Workflowをインポート（推奨）

### オプションA: DSLファイルからインポート（最速）

1. Difyダッシュボードにログイン
2. **「Studio」** → **「Import DSL」** をクリック
3. 以下のDSLファイルをアップロード:

**DSLファイル**: `wellship-menu-generator.yml`

```yaml
version: "0.1"
kind: "app"
name: "wellship-menu-generator"
description: "WELLSHIP船舶献立生成ワークフロー"
mode: "workflow"

environment_variables: []

conversation_variables: []

workflow:
  graph:
    nodes:
      - id: "start"
        type: "start"
        data:
          title: "開始"
          variables:
            - variable: "crew_count"
              type: "number"
              required: true
              label: "乗員数"
            - variable: "days"
              type: "number"
              required: true
              label: "献立日数"
            - variable: "budget_per_person_per_day"
              type: "number"
              required: true
              label: "1人1日あたりの予算（円）"
            - variable: "min_budget_usage_percent"
              type: "number"
              required: true
              default: 90
              label: "最低予算消化率（%）"
            - variable: "start_date"
              type: "string"
              required: true
              label: "開始日（YYYY-MM-DD）"
            - variable: "season"
              type: "string"
              required: false
              label: "季節"
            - variable: "cooking_time_limit"
              type: "number"
              required: false
              default: 0
              label: "調理時間上限（分）"
            - variable: "banned_ingredients"
              type: "string"
              required: false
              label: "禁止食材（カンマ区切り）"
            - variable: "weekday_rules"
              type: "string"
              required: false
              default: "{}"
              label: "曜日ルール（JSON）"
            - variable: "allowed_recipe_ids"
              type: "string"
              required: false
              label: "使用可能レシピID（カンマ区切り）"
            - variable: "recipes"
              type: "string"
              required: true
              label: "レシピマスタ（JSON）"
            - variable: "daily_calorie_target"
              type: "number"
              required: false
              default: 2200
              label: "1日の目標カロリー（kcal）"
            - variable: "daily_protein_target"
              type: "number"
              required: false
              default: 70
              label: "1日の目標タンパク質（g）"
            - variable: "daily_salt_max"
              type: "number"
              required: false
              default: 8
              label: "1日の塩分上限（g）"

      - id: "code_recipe_transform"
        type: "code"
        data:
          title: "レシピマスタ変換"
          code_language: "python3"
          code: |
            import json
            
            def main(recipes: str) -> dict:
                try:
                    recipe_list = json.loads(recipes)
                    formatted_recipes = []
                    for r in recipe_list:
                        formatted_recipes.append({
                            "id": r.get("id", ""),
                            "name": r.get("name", ""),
                            "category": r.get("category", ""),
                            "calories": r.get("calories", 0),
                            "protein": r.get("protein", 0),
                            "salt": r.get("salt", 0),
                            "cost": r.get("costPerServing", 0)
                        })
                    return {
                        "recipe_list": formatted_recipes,
                        "recipe_count": len(formatted_recipes),
                        "recipe_json": json.dumps(formatted_recipes, ensure_ascii=False, indent=2)
                    }
                except Exception as e:
                    return {
                        "recipe_list": [],
                        "recipe_count": 0,
                        "recipe_json": "[]",
                        "error": str(e)
                    }
          variables:
            - variable: "recipes"
              value_selector: ["start", "recipes"]

      - id: "code_prompt_build"
        type: "code"
        data:
          title: "プロンプト構築"
          code_language: "python3"
          code: |
            # （DIFY_WORKFLOW_DESIGN.md のノード3のコードを参照）
            # 長いため省略 - 実際のDSLファイルには全コードを含める
          variables:
            - variable: "crew_count"
              value_selector: ["start", "crew_count"]
            - variable: "days"
              value_selector: ["start", "days"]
            # ... 他の変数も同様

      - id: "llm_gemini"
        type: "llm"
        data:
          title: "Gemini献立生成"
          model:
            provider: "google"
            name: "gemini-2.0-flash-exp"
            mode: "chat"
            completion_params:
              temperature: 0.7
              max_tokens: 4096
          prompt_template:
            - role: "user"
              text: "{{#code_prompt_build.prompt#}}"
          response_format: "json"

      - id: "code_json_extract"
        type: "code"
        data:
          title: "JSON抽出"
          code_language: "python3"
          code: |
            # （DIFY_WORKFLOW_DESIGN.md のノード5のコードを参照）
          variables:
            - variable: "llm_output"
              value_selector: ["llm_gemini", "text"]

      - id: "code_validation"
        type: "code"
        data:
          title: "構造検証"
          code_language: "python3"
          code: |
            # （DIFY_WORKFLOW_DESIGN.md のノード6のコードを参照）
          variables:
            - variable: "menu_data"
              value_selector: ["code_json_extract", "menu_data"]
            - variable: "success"
              value_selector: ["code_json_extract", "success"]
            - variable: "days"
              value_selector: ["start", "days"]

      - id: "end"
        type: "end"
        data:
          outputs:
            - variable: "menu"
              value_selector: ["code_validation", "validated_menu"]
            - variable: "success"
              value_selector: ["code_validation", "valid"]
            - variable: "errors"
              value_selector: ["code_validation", "errors"]
            - variable: "warnings"
              value_selector: ["code_validation", "warnings"]
            - variable: "total_days"
              value_selector: ["code_validation", "total_days"]
            - variable: "total_recipes"
              value_selector: ["code_validation", "total_recipes"]

    edges:
      - source: "start"
        target: "code_recipe_transform"
      - source: "code_recipe_transform"
        target: "code_prompt_build"
      - source: "code_prompt_build"
        target: "llm_gemini"
      - source: "llm_gemini"
        target: "code_json_extract"
      - source: "code_json_extract"
        target: "code_validation"
      - source: "code_validation"
        target: "end"
```

4. **「Import」** をクリック
5. Workflowが自動的に作成される

### オプションB: 手動作成

DIFY_UI_GUIDE.md に従って手動で作成（約15分）

---

## 📋 ステップ2: Gemini APIキーを設定

1. Dify **Settings** → **Model Provider** を開く
2. **「Google」** を選択
3. **API Key** を入力:
   ```
   your_gemini_api_key_here
   ```
4. **「Save」** をクリック

---

## 📋 ステップ3: テスト実行

1. Workflow画面で **「Run」** ボタンをクリック
2. 以下のテストデータを入力:

```json
{
  "crew_count": 20,
  "days": 3,
  "budget_per_person_per_day": 1200,
  "min_budget_usage_percent": 90,
  "start_date": "2026-01-10",
  "season": "winter",
  "cooking_time_limit": 60,
  "banned_ingredients": "",
  "weekday_rules": "{}",
  "allowed_recipe_ids": "",
  "recipes": "[{\"id\":\"rec-teriyaki-chicken\",\"name\":\"鶏の照り焼き\",\"category\":\"main\",\"calories\":620,\"protein\":36,\"salt\":2.2,\"costPerServing\":520},{\"id\":\"rec-miso-salmon\",\"name\":\"サーモンの味噌焼き\",\"category\":\"main\",\"calories\":540,\"protein\":32,\"salt\":2.0,\"costPerServing\":640},{\"id\":\"rec-ginger-pork\",\"name\":\"豚の生姜焼き\",\"category\":\"main\",\"calories\":650,\"protein\":34,\"salt\":2.6,\"costPerServing\":480},{\"id\":\"rec-spinach-ohitashi\",\"name\":\"ほうれん草のおひたし\",\"category\":\"side\",\"calories\":35,\"protein\":3,\"salt\":0.8,\"costPerServing\":120},{\"id\":\"rec-miso-soup\",\"name\":\"味噌汁\",\"category\":\"soup\",\"calories\":40,\"protein\":2,\"salt\":1.2,\"costPerServing\":80}]",
  "daily_calorie_target": 2200,
  "daily_protein_target": 70,
  "daily_salt_max": 8
}
```

3. **「Run」** をクリック
4. 結果を確認:
   - `success: true`
   - `menu.days` に3日分の献立が生成される

---

## 📋 ステップ4: API公開

1. **「Publish」** ボタンをクリック
2. **「API」** タブを開く
3. 以下をコピー:
   - **API Key**: `app-LCsRzuN4tCnH9IrO4JUeywao`
   - **Base URL**: `https://api.dify.ai/v1`
   - **Workflow Endpoint**: `https://api.dify.ai/v1/workflows/run`

---

## 📋 ステップ5: WELLSHIP連携

### 5-1. 環境変数設定

```bash
cd /Users/wataru/WELLSHIP_MVP/SaaS

# .env.local に追加
cat >> .env.local << EOF
# Dify API設定
DIFY_API_KEY=app-xxxxxxxxxxxxxxxxxxxxxx
DIFY_WORKFLOW_URL=https://api.dify.ai/v1/workflows/run

# AI Provider切り替え
WELLSHIP_AI_PROVIDER=dify
EOF
```

### 5-2. サーバー再起動

```bash
npm run dev
```

### 5-3. 動作確認

1. ブラウザで `http://localhost:3000/planning` を開く
2. フォームに入力:
   - 乗員数: `20`
   - 日数: `3`
   - 予算: `1200`
   - ポリシー: `バランス重視`
3. **「献立を生成」** をクリック
4. ログを確認:
   ```
   🤖 Using AI provider: dify
   ✅ Menu generated using Dify Workflow
   ```

---

## 🎉 完了！

Dify統合が完了しました！

### 次のステップ

1. **プロンプトの最適化**: Dify UIで直接プロンプトを編集
2. **新機能の追加**: 新しいノードを追加して機能拡張
3. **A/Bテスト**: 複数のプロンプトパターンをテスト

---

## 🐛 トラブルシューティング

### エラー: `DIFY_API_KEY is not set`

**解決策**:
```bash
echo 'DIFY_API_KEY=app-your-key-here' >> .env.local
npm run dev
```

### エラー: `Dify API error (401)`

**解決策**:
1. Difyダッシュボードで新しいAPIキーを生成
2. `.env.local` を更新

### エラー: `No menu output from Dify workflow`

**解決策**:
1. Dify Workflowの **End** ノードを確認
2. 出力変数名が `menu` になっているか確認

---

## 📚 詳細ドキュメント

- **統合仕様書**: `/Users/wataru/WELLSHIP_MVP/.agent/DIFY_INTEGRATION_SPEC.md`
- **Workflow設計書**: `/Users/wataru/WELLSHIP_MVP/.agent/DIFY_WORKFLOW_DESIGN.md`
- **UI操作ガイド**: `/Users/wataru/WELLSHIP_MVP/.agent/DIFY_UI_GUIDE.md`

---

## 💡 ヒント

### Gemini直接呼び出しに戻す

```bash
# .env.local を編集
WELLSHIP_AI_PROVIDER=gemini
```

### 両方を試す

```bash
# Dify
WELLSHIP_AI_PROVIDER=dify

# Gemini直接
WELLSHIP_AI_PROVIDER=gemini
```

サーバーを再起動すれば、即座に切り替わります！
