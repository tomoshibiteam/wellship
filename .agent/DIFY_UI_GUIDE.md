# Dify UI 操作ガイド - WELLSHIP献立生成ワークフロー

## 🎯 このガイドの目的

Dify UIでの具体的な操作手順を、スクリーンショット付きで解説します。

---

## 📋 事前準備

### 必要なもの
- ✅ Difyアカウント（https://dify.ai/）
- ✅ Gemini APIキー（Google AI Studio: https://aistudio.google.com/）
- ✅ WELLSHIP_WORKFLOW_DESIGN.md（設計書）

---

## 🚀 ステップ1: 新規Workflow作成

### 1-1. Difyダッシュボードにアクセス

1. https://dify.ai/ にアクセス
2. ログイン
3. **「Studio」** タブをクリック

### 1-2. 新規Workflow作成

1. **「Create Blank App」** をクリック
2. アプリタイプ: **「Workflow」** を選択
3. 以下を入力:
   - **Name**: `wellship-menu-generator`
   - **Description**: `WELLSHIP船舶献立生成ワークフロー - Gemini経由で7日間の献立を自動生成`
   - **Icon**: 🍱（お弁当アイコン）
4. **「Create」** をクリック

---

## 🔧 ステップ2: 入力変数の設定

### 2-1. Startノードをクリック

1. キャンバス左側の **「Start」** ノードをクリック
2. 右側のパネルが開く

### 2-2. 入力変数を追加

**「+ Add Variable」** を14回クリックして、以下の変数を追加:

#### 変数1: crew_count
- **Variable Name**: `crew_count`
- **Field Name**: `乗員数`
- **Type**: `Number`
- **Field Type**: 数値入力
- **Required**: ✅ チェック
- **Default Value**: 空欄

#### 変数2: days
- **Variable Name**: `days`
- **Field Name**: `献立日数`
- **Type**: `Number`
- **Field Type**: 数値入力
- **Required**: ✅ チェック
- **Default Value**: 空欄

#### 変数3: budget_per_person_per_day
- **Variable Name**: `budget_per_person_per_day`
- **Field Name**: `1人1日あたりの予算（円）`
- **Type**: `Number`
- **Field Type**: 数値入力
- **Required**: ✅ チェック
- **Default Value**: 空欄

#### 変数4: min_budget_usage_percent
- **Variable Name**: `min_budget_usage_percent`
- **Field Name**: `最低予算消化率（%）`
- **Type**: `Number`
- **Field Type**: 数値入力
- **Required**: ✅ チェック
- **Default Value**: `90`

#### 変数5: start_date
- **Variable Name**: `start_date`
- **Field Name**: `開始日（YYYY-MM-DD）`
- **Type**: `String`
- **Field Type**: 短文（Short Text）
- **Required**: ✅ チェック
- **Default Value**: 空欄
- **説明**: 日付形式は1行で完結するため短文を使用

#### 変数6: season
- **Variable Name**: `season`
- **Field Name**: `季節`
- **Type**: `String`
- **Field Type**: 選択（Select）
- **Required**: ❌ チェックなし
- **Default Value**: 空欄
- **選択肢**: `spring`, `summer`, `autumn`, `winter`
- **説明**: 季節は固定の選択肢から選ぶため選択タイプを使用

#### 変数7: cooking_time_limit
- **Variable Name**: `cooking_time_limit`
- **Field Name**: `調理時間上限（分）`
- **Type**: `Number`
- **Field Type**: 数値入力
- **Required**: ❌ チェックなし
- **Default Value**: `0`

#### 変数8: banned_ingredients
- **Variable Name**: `banned_ingredients`
- **Field Name**: `禁止食材（カンマ区切り）`
- **Type**: `String`
- **Field Type**: 短文（Short Text）
- **Required**: ❌ チェックなし
- **Default Value**: 空欄
- **説明**: カンマ区切りのリストは1行で完結するため短文を使用

#### 変数9: weekday_rules
- **Variable Name**: `weekday_rules`
- **Field Name**: `曜日ルール（JSON）`
- **Type**: `String`
- **Field Type**: 段落（Paragraph）
- **Required**: ❌ チェックなし
- **Default Value**: `{}`
- **説明**: JSON形式のデータは複数行になる可能性があるため段落を使用

#### 変数10: allowed_recipe_ids
- **Variable Name**: `allowed_recipe_ids`
- **Field Name**: `使用可能レシピID（カンマ区切り）`
- **Type**: `String`
- **Field Type**: 段落（Paragraph）
- **Required**: ❌ チェックなし
- **Default Value**: 空欄
- **説明**: レシピIDのリストが長くなる可能性があるため段落を使用

#### 変数11: recipes
- **Variable Name**: `recipes`
- **Field Name**: `レシピマスタ（JSON）`
- **Type**: `String`
- **Field Type**: 段落（Paragraph）
- **Required**: ✅ チェック
- **Default Value**: 空欄
- **説明**: 大量のJSON配列データを入力するため段落を使用

#### 変数12: daily_calorie_target
- **Variable Name**: `daily_calorie_target`
- **Field Name**: `1日の目標カロリー（kcal）`
- **Type**: `Number`
- **Field Type**: 数値入力
- **Required**: ❌ チェックなし
- **Default Value**: `2200`

#### 変数13: daily_protein_target
- **Variable Name**: `daily_protein_target`
- **Field Name**: `1日の目標タンパク質（g）`
- **Type**: `Number`
- **Field Type**: 数値入力
- **Required**: ❌ チェックなし
- **Default Value**: `70`

#### 変数14: daily_salt_max
- **Variable Name**: `daily_salt_max`
- **Field Name**: `1日の塩分上限（g）`
- **Type**: `Number`
- **Field Type**: 数値入力
- **Required**: ❌ チェックなし
- **Default Value**: `8`

---

## 🔄 ステップ3: ノード追加

### 3-1. ノード2: レシピマスタのJSON変換

1. **「+」** ボタンをクリック → **「Code」** を選択
2. ノード名: `レシピマスタ変換`
3. **「Code」** タブを開く
4. 言語: **Python 3**
5. 以下のコードを貼り付け:

```python
import json

def main(recipes: str) -> dict:
    """
    レシピマスタをJSON配列に変換
    """
    try:
        recipe_list = json.loads(recipes)
        
        # レシピ情報を整形
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
```

6. **「Input Variables」** タブを開く
7. **「+ Add Variable」** をクリック
8. 変数を追加:
   - **Variable Name**: `recipes`
   - **Value**: `{{#start.recipes#}}` ※Startノードの `recipes` を参照

9. **「Output Variables」** タブを開く

10. 出力変数を確認:
    - Difyは `return` 文の辞書キーから自動的に出力変数を推測しますが、**自動生成されない場合は手動で追加**します

11. **自動生成されない場合**: **「+ Add Variable」** を4回クリックして以下を追加:

    **出力変数1: recipe_list**
    - **Variable Name**: `recipe_list`
    - **Type**: `Array[Object]`
    
    **出力変数2: recipe_count**
    - **Variable Name**: `recipe_count`
    - **Type**: `Number`
    
    **出力変数3: recipe_json**
    - **Variable Name**: `recipe_json`
    - **Type**: `String`
    
    **出力変数4: error**
    - **Variable Name**: `error`
    - **Type**: `String`

12. **「Save」** をクリック

### 3-2. ノード3: プロンプト構築

1. **「+」** ボタンをクリック → **「Code」** を選択
2. ノード名: `プロンプト構築`
3. **「Code」** タブを開く
4. 言語: **Python 3**
5. DIFY_WORKFLOW_DESIGN.md の「ノード3」のコードを貼り付け（長いので省略）

6. **「Input Variables」** タブを開く
7. 以下の変数を追加:
   - `crew_count`: `{{#start.crew_count#}}`
   - `days`: `{{#start.days#}}`
   - `budget_per_person_per_day`: `{{#start.budget_per_person_per_day#}}`
   - `min_budget_usage_percent`: `{{#start.min_budget_usage_percent#}}`
   - `start_date`: `{{#start.start_date#}}`
   - `recipe_json`: `{{#レシピマスタ変換.recipe_json#}}`
   - `season`: `{{#start.season#}}`
   - `cooking_time_limit`: `{{#start.cooking_time_limit#}}`
   - `banned_ingredients`: `{{#start.banned_ingredients#}}`
   - `weekday_rules`: `{{#start.weekday_rules#}}`
   - `daily_calorie_target`: `{{#start.daily_calorie_target#}}`
   - `daily_protein_target`: `{{#start.daily_protein_target#}}`
   - `daily_salt_max`: `{{#start.daily_salt_max#}}`

### 3-3. ノード4: Gemini LLM呼び出し

1. **「+」** ボタンをクリック → **「LLM」** を選択
2. ノード名: `Gemini献立生成`

#### モデル設定

3. **「Model」** タブを開く
4. **「Select Model」** をクリック
5. **「Google」** → **「Gemini 2.0 Flash Experimental」** を選択
   - もし利用できない場合: **「Gemini 1.5 Pro」** を選択

6. **Model Parameters** を設定:
   - **Temperature**: `0.7`
   - **Max Tokens**: `4096`
   - **Top P**: `0.95`

#### プロンプト設定

7. **「Prompt」** タブを開く
8. **System Prompt**: 空欄のまま
9. **User Prompt**: 以下を入力
   ```
   {{#プロンプト構築.prompt#}}
   ```

#### Response Format設定

10. **「Response Format」** を **JSON** に設定
    - Geminiの場合、自動的に `response_mime_type: application/json` が設定される

### 3-4. ノード5: JSON抽出・整形

1. **「+」** ボタンをクリック → **「Code」** を選択
2. ノード名: `JSON抽出`
3. **「Code」** タブを開く
4. DIFY_WORKFLOW_DESIGN.md の「ノード5」のコードを貼り付け

5. **「Input Variables」** タブを開く
6. 変数を追加:
   - **Variable Name**: `llm_output`
   - **Value**: `{{#Gemini献立生成.text#}}` ※LLMノードの出力

### 3-5. ノード6: 構造検証

1. **「+」** ボタンをクリック → **「Code」** を選択
2. ノード名: `構造検証`
3. **「Code」** タブを開く
4. DIFY_WORKFLOW_DESIGN.md の「ノード6」のコードを貼り付け

5. **「Input Variables」** タブを開く
6. 変数を追加:
   - `menu_data`: `{{#JSON抽出.menu_data#}}`
   - `success`: `{{#JSON抽出.success#}}`
   - `days`: `{{#start.days#}}`

---

## 📤 ステップ4: 出力変数の設定

### 4-1. Endノードをクリック

1. キャンバス右側の **「End」** ノードをクリック
2. 右側のパネルが開く

### 4-2. 出力変数を追加

**「+ Add Variable」** を6回クリックして、以下の変数を追加:

#### 出力1: menu
- **Variable Name**: `menu`
- **Value Type**: `Object`
- **Value**: `{{#構造検証.validated_menu#}}`

#### 出力2: success
- **Variable Name**: `success`
- **Value Type**: `Boolean`
- **Value**: `{{#構造検証.valid#}}`

#### 出力3: errors
- **Variable Name**: `errors`
- **Value Type**: `Array`
- **Value**: `{{#構造検証.errors#}}`

#### 出力4: warnings
- **Variable Name**: `warnings`
- **Value Type**: `Array`
- **Value**: `{{#構造検証.warnings#}}`

#### 出力5: total_days
- **Variable Name**: `total_days`
- **Value Type**: `Number`
- **Value**: `{{#構造検証.total_days#}}`

#### 出力6: total_recipes
- **Variable Name**: `total_recipes`
- **Value Type**: `Number`
- **Value**: `{{#構造検証.total_recipes#}}`

---

## 🧪 ステップ5: テスト実行

### 5-1. テストデータの準備

1. **「Run」** ボタン（右上）をクリック
2. テスト入力画面が開く

### 5-2. テストデータ入力

以下のJSONを入力:

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

### 5-3. 実行

1. **「Run」** ボタンをクリック
2. 実行ログを確認
3. 各ノードの出力を確認

### 5-4. 結果確認

**期待される出力**:

```json
{
  "menu": {
    "days": [
      {
        "date": "2026-01-10",
        "dayLabel": "金曜日",
        "breakfast": ["rec-miso-soup"],
        "lunch": ["rec-teriyaki-chicken", "rec-spinach-ohitashi"],
        "dinner": ["rec-miso-salmon", "rec-spinach-ohitashi"]
      },
      {
        "date": "2026-01-11",
        "dayLabel": "土曜日",
        "breakfast": ["rec-miso-soup"],
        "lunch": ["rec-ginger-pork", "rec-spinach-ohitashi"],
        "dinner": ["rec-teriyaki-chicken", "rec-miso-soup"]
      },
      {
        "date": "2026-01-12",
        "dayLabel": "日曜日",
        "breakfast": ["rec-miso-soup"],
        "lunch": ["rec-miso-salmon", "rec-spinach-ohitashi"],
        "dinner": ["rec-ginger-pork", "rec-miso-soup"]
      }
    ]
  },
  "success": true,
  "errors": [],
  "warnings": [],
  "total_days": 3,
  "total_recipes": 15
}
```

---

## 🌐 ステップ6: API公開

### 6-1. Workflowを公開

1. **「Publish」** ボタン（右上）をクリック
2. 変更内容を確認
3. **「Publish」** をクリック

### 6-2. API情報の取得

1. **「API」** タブをクリック
2. **API Access** セクションを確認

#### API Key
```
app-xxxxxxxxxxxxxxxxxxxxxx
```
→ これを `.env.local` の `DIFY_API_KEY` に設定

#### API Endpoint
```
https://api.dify.ai/v1/workflows/run
```
→ これを `.env.local` の `DIFY_WORKFLOW_URL` に設定

### 6-3. cURLでテスト

```bash
curl -X POST 'https://api.dify.ai/v1/workflows/run' \
  -H 'Authorization: Bearer app-xxxxxxxxxxxxxxxxxxxxxx' \
  -H 'Content-Type: application/json' \
  -d '{
    "inputs": {
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
      "recipes": "[{\"id\":\"rec-teriyaki-chicken\",\"name\":\"鶏の照り焼き\",\"category\":\"main\",\"calories\":620,\"protein\":36,\"salt\":2.2,\"costPerServing\":520}]",
      "daily_calorie_target": 2200,
      "daily_protein_target": 70,
      "daily_salt_max": 8
    },
    "response_mode": "blocking",
    "user": "wellship-test"
  }'
```

---

## 🔧 ステップ7: WELLSHIP連携

### 7-1. 環境変数設定

```bash
cd /Users/wataru/WELLSHIP_MVP/SaaS
echo 'DIFY_API_KEY=app-xxxxxxxxxxxxxxxxxxxxxx' >> .env.local
echo 'DIFY_WORKFLOW_URL=https://api.dify.ai/v1/workflows/run' >> .env.local
echo 'WELLSHIP_AI_PROVIDER=dify' >> .env.local
```

### 7-2. サーバー再起動

```bash
npm run dev
```

### 7-3. 動作確認

1. ブラウザで `http://localhost:3000/planning` を開く
2. フォームに入力
3. **「献立を生成」** をクリック
4. ログを確認:
   ```
   🤖 Using AI provider: dify
   🤖 Dify API Request: ...
   ✅ Dify API Response: ...
   ✅ Menu generated using Dify Workflow
   ```

---

## 🐛 トラブルシューティング

### エラー1: ノードが接続できない

**症状**: ノード間の線が引けない

**原因**: 出力変数の型が一致していない

**解決策**:
1. 前のノードの **Output Variables** を確認
2. 次のノードの **Input Variables** の型を合わせる

### エラー2: LLMノードでエラー

**症状**: `Model not found` エラー

**原因**: Gemini APIキーが設定されていない

**解決策**:
1. Dify **Settings** → **Model Provider** を開く
2. **Google** を選択
3. **API Key** を入力（Google AI Studioで取得）
4. **Save** をクリック

### エラー3: JSON抽出エラー

**症状**: `JSON parse error`

**原因**: LLMがJSON以外の文字列を返している

**解決策**:
1. LLMノードの **Response Format** を確認
2. **JSON** に設定されているか確認
3. プロンプトの最後に「JSONのみを出力し、説明は不要です。」が含まれているか確認

### エラー4: 出力変数が見つからない

**症状**: `{{#ノード名.変数名#}}` が赤くなる

**原因**: ノード名または変数名が間違っている

**解決策**:
1. ノード名を確認（日本語の場合、完全一致が必要）
2. 変数名を確認（大文字小文字を区別）
3. ノードを再接続

### エラー5: Codeノードの出力変数が自動生成されない

**症状**: Codeノードで `return` した辞書のキーが **Output Variables** に表示されない

**原因**: Difyが自動推測できない、またはコードにエラーがある

**解決策**:
1. **コードを保存**: まず **「Save」** をクリック
2. **テスト実行**: ノードを単体でテスト実行してエラーがないか確認
3. **手動で追加**: **Output Variables** タブで **「+ Add Variable」** をクリックして手動で追加
   - Variable Name: `return` 文の辞書キーと完全一致させる
   - Type: データ型を正しく選択（String, Number, Array, Object など）
4. **再保存**: すべての出力変数を追加したら再度 **「Save」** をクリック

**例**: ノード2の場合
```python
return {
    "recipe_list": formatted_recipes,    # → Type: Array[Object]
    "recipe_count": len(formatted_recipes),  # → Type: Number
    "recipe_json": json.dumps(...),      # → Type: String
    "error": str(e)                      # → Type: String
}
```

---

## 📊 監視とログ

### Dify側のログ確認

1. **「Logs」** タブをクリック
2. 実行履歴を確認
3. 各ノードの入出力を確認

### WELLSHIP側のログ確認

```bash
# サーバーログ
tail -f /Users/wataru/WELLSHIP_MVP/SaaS/.next/server.log

# ブラウザコンソール
# F12 → Console タブ
```

---

## 🎓 次のステップ

### 1. プロンプトの最適化

Dify UIで直接プロンプトを編集して、献立の質を向上:

- 季節の食材をより重視
- 栄養バランスの微調整
- 予算配分の最適化

### 2. 新機能の追加

新しいノードを追加して機能拡張:

- **予算最適化ノード**: 予算超過時の自動調整
- **栄養バランスチェックノード**: カロリー・タンパク質・塩分の検証
- **レシピ推薦ノード**: 過去のフィードバックを基にした推薦

### 3. A/Bテスト

複数のプロンプトパターンをテスト:

- パターンA: 予算重視
- パターンB: 栄養バランス重視
- パターンC: 季節感重視

---

## 📚 参考リンク

- **Dify公式ドキュメント**: https://docs.dify.ai/
- **Gemini API**: https://ai.google.dev/
- **WELLSHIP統合仕様書**: `/Users/wataru/WELLSHIP_MVP/.agent/DIFY_INTEGRATION_SPEC.md`
- **Workflow設計書**: `/Users/wataru/WELLSHIP_MVP/.agent/DIFY_WORKFLOW_DESIGN.md`

---

## ✅ チェックリスト

Workflow作成完了前に確認:

- [ ] 入力変数14個すべて設定済み
- [ ] ノード5個すべて追加済み
- [ ] ノード間の接続完了
- [ ] 出力変数6個すべて設定済み
- [ ] テスト実行成功
- [ ] API公開完了
- [ ] APIキー取得済み
- [ ] WELLSHIP `.env.local` 設定済み
- [ ] WELLSHIP動作確認済み

すべてチェックが入ったら、Dify統合完了です！🎉
