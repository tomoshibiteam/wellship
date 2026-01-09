# Dify Workflow 完全設計書 - WELLSHIP献立生成

## 🎯 目的

現在のGemini API直接呼び出しから、**Dify経由でGeminiを実行する仕組み**に移行する。

### 移行前（現在）
```
WELLSHIP → Gemini API → JSON → WELLSHIP
```

### 移行後（目標）
```
WELLSHIP → Dify Workflow → Gemini → JSON整形 → WELLSHIP
```

---

## 📋 Dify Workflow 全体構成

### ワークフロー名
`wellship-menu-generator`

### ワークフロータイプ
**Workflow（ワークフロー）** ※Chat Completionではない

### 実行モード
**Blocking（同期実行）** - WELLSHIPは結果を待つ

---

## 🔧 ノード構成（全7ノード）

```
[開始] 
  ↓
[1. 入力変数の受け取り]
  ↓
[2. レシピマスタのJSON変換]
  ↓
[3. プロンプト構築]
  ↓
[4. Gemini LLM呼び出し]
  ↓
[5. JSON抽出・整形]
  ↓
[6. 構造検証]
  ↓
[7. 出力変数の設定]
  ↓
[終了]
```

---

## 📥 ノード1: 入力変数の受け取り（Start）

### ノードタイプ
**Start（開始ノード）**

### 入力変数定義

| 変数名 | 型 | 必須 | デフォルト値 | 説明 |
|--------|-----|------|-------------|------|
| `crew_count` | Number | ✅ | - | 乗員数 |
| `days` | Number | ✅ | - | 献立日数 |
| `budget_per_person_per_day` | Number | ✅ | - | 1人1日あたりの予算（円） |
| `min_budget_usage_percent` | Number | ✅ | 90 | 最低予算消化率（%） |
| `start_date` | String | ✅ | - | 開始日（YYYY-MM-DD） |
| `season` | String | ❌ | "" | 季節（spring/summer/autumn/winter） |
| `cooking_time_limit` | Number | ❌ | 0 | 調理時間上限（分） |
| `banned_ingredients` | String | ❌ | "" | 禁止食材（カンマ区切り） |
| `weekday_rules` | String | ❌ | "{}" | 曜日ルール（JSON文字列） |
| `allowed_recipe_ids` | String | ❌ | "" | 使用可能レシピID（カンマ区切り） |
| `recipes` | String | ✅ | - | レシピマスタ（JSON文字列） |
| `daily_calorie_target` | Number | ❌ | 2200 | 1日の目標カロリー（kcal） |
| `daily_protein_target` | Number | ❌ | 70 | 1日の目標タンパク質（g） |
| `daily_salt_max` | Number | ❌ | 8 | 1日の塩分上限（g） |

### Dify UI設定

1. **Workflow設定 → 入力変数** を開く
2. 上記の変数を1つずつ追加
3. 各変数の「必須」チェックボックスを設定
4. デフォルト値を入力

---

## 🔄 ノード2: レシピマスタのJSON変換（Code）

### ノードタイプ
**Code（コード実行）**

### 目的
文字列として受け取った `recipes` をJSONオブジェクトに変換し、プロンプトで使いやすい形式にする。

### 入力
- `recipes` (String): JSON文字列

### コード（Python）

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

### 出力変数
- `recipe_list` (Array): レシピオブジェクト配列
- `recipe_count` (Number): レシピ数
- `recipe_json` (String): 整形されたJSON文字列

---

## 📝 ノード3: プロンプト構築（Code）

### ノードタイプ
**Code（コード実行）**

### 目的
WELLSHIPの `buildMenuGenerationPrompt()` と同じロジックでプロンプトを構築する。

### 入力
- `crew_count`, `days`, `budget_per_person_per_day`, `min_budget_usage_percent`, `start_date`
- `season`, `cooking_time_limit`, `banned_ingredients`, `weekday_rules`
- `recipe_json` (ノード2の出力)
- `daily_calorie_target`, `daily_protein_target`, `daily_salt_max`

### コード（Python）

```python
import json

def get_seasonal_description(season: str) -> str:
    """季節の説明を取得"""
    seasons = {
        "spring": "春（3-5月）: 新鮮な野菜、山菜、タケノコなどを優先",
        "summer": "夏（6-8月）: 冷たい料理、さっぱりした味付け、夏野菜を優先",
        "autumn": "秋（9-11月）: きのこ、さんま、栗、根菜などを優先",
        "winter": "冬（12-2月）: 温かい鍋物、煮込み料理、根菜を優先"
    }
    return seasons.get(season, "")

def get_day_rules_description(weekday_rules_json: str) -> str:
    """曜日ルールの説明を取得"""
    try:
        rules = json.loads(weekday_rules_json)
        if not rules:
            return ""
        
        day_names = {
            "monday": "月曜日",
            "tuesday": "火曜日",
            "wednesday": "水曜日",
            "thursday": "木曜日",
            "friday": "金曜日",
            "saturday": "土曜日",
            "sunday": "日曜日"
        }
        
        lines = []
        for day_en, menu in rules.items():
            day_jp = day_names.get(day_en, day_en)
            lines.append(f"- {day_jp}: {menu}")
        
        return "\n".join(lines) if lines else ""
    except:
        return ""

def main(
    crew_count: int,
    days: int,
    budget_per_person_per_day: float,
    min_budget_usage_percent: int,
    start_date: str,
    recipe_json: str,
    season: str = "",
    cooking_time_limit: int = 0,
    banned_ingredients: str = "",
    weekday_rules: str = "{}",
    daily_calorie_target: int = 2200,
    daily_protein_target: int = 70,
    daily_salt_max: int = 8
) -> dict:
    """
    献立生成プロンプトを構築
    """
    
    # 予算計算
    total_budget = budget_per_person_per_day * days
    min_budget = int(total_budget * min_budget_usage_percent / 100)
    
    # 制約セクション構築
    constraints_sections = ""
    
    # 禁止食材
    if banned_ingredients:
        ingredients_list = [i.strip() for i in banned_ingredients.split(",") if i.strip()]
        if ingredients_list:
            constraints_sections += "\n### 禁止食材（アレルギー等）\n"
            constraints_sections += "以下の食材を含むレシピは**絶対に使用しないでください**：\n"
            for ing in ingredients_list:
                constraints_sections += f"- {ing}\n"
    
    # 季節
    if season:
        season_desc = get_seasonal_description(season)
        if season_desc:
            constraints_sections += f"\n### 季節の考慮\n{season_desc}\n"
    
    # 曜日ルール
    day_rules_desc = get_day_rules_description(weekday_rules)
    if day_rules_desc:
        constraints_sections += f"\n### 曜日ごとの特別ルール\n{day_rules_desc}\n"
    
    # 調理時間
    if cooking_time_limit > 0:
        constraints_sections += f"\n### 調理時間制約\n"
        constraints_sections += f"- 1食あたりの調理時間上限: {cooking_time_limit}分\n"
        constraints_sections += "- 時間のかかる料理は朝食を避け、夕食に回す\n"
    
    # プロンプト構築
    prompt = f"""あなたは船舶の司厨のためのAI献立プランナーです。
以下の条件に基づいて、{days}日分の献立を生成してください。

## 基本条件
- 乗員数: {crew_count}名
- 期間: {days}日間（{start_date}から）
- 1日の目標カロリー: {daily_calorie_target}kcal
- 1日の目標タンパク質: {daily_protein_target}g
- 1日の塩分上限: {daily_salt_max}g

## 📊 予算制約
- **1人1日あたりの平均予算: {budget_per_person_per_day}円**
- **期間合計予算: {total_budget}円**（{days}日間×{budget_per_person_per_day}円）
- **最低予算消化: {min_budget}円**（{min_budget_usage_percent}%以上）
- {days}日間の全レシピcost合計が**{min_budget}円以上〜{total_budget}円以下**になるようにしてください
- 安すぎる献立は船員の満足度が下がるため、予算の{min_budget_usage_percent}%以上は使ってください
- 日によって豪華な日（高コスト）や節約日（低コスト）があっても構いません
{constraints_sections}
## 利用可能なレシピ（cost = 1人前のコスト）
```json
{recipe_json}
```

## 基本ルール
1. 各食事（朝・昼・夕）に1〜2品を選択
2. 同じレシピは連続で使わない（最低2日空ける）
3. カテゴリのバランスを考慮（main, side, soup, rice, dessert）
4. 朝食は軽め、昼・夕食は主菜を含める
5. 栄養バランスを考慮
6. **1日の合計costが{budget_per_person_per_day}円以下になることを最優先**

## 出力形式
以下のJSON形式で出力してください：
```json
{{
  "days": [
    {{
      "date": "YYYY-MM-DD",
      "dayLabel": "曜日",
      "breakfast": ["recipe-id-1"],
      "lunch": ["recipe-id-1", "recipe-id-2"],
      "dinner": ["recipe-id-1", "recipe-id-2"]
    }}
  ]
}}
```

JSONのみを出力し、説明は不要です。"""
    
    return {
        "prompt": prompt,
        "prompt_length": len(prompt),
        "total_budget": total_budget,
        "min_budget": min_budget
    }
```

### 出力変数
- `prompt` (String): 構築されたプロンプト
- `prompt_length` (Number): プロンプトの文字数
- `total_budget` (Number): 期間合計予算
- `min_budget` (Number): 最低予算

---

## 🤖 ノード4: Gemini LLM呼び出し（LLM）

### ノードタイプ
**LLM（大規模言語モデル）**

### モデル設定

#### 推奨モデル
1. **Gemini 2.0 Flash** (最優先)
   - 速度: 高速
   - コスト: 低
   - 精度: 十分

2. **Gemini 1.5 Pro** (フォールバック)
   - 速度: 中速
   - コスト: 中
   - 精度: 高

3. **GPT-4o** (代替案)
   - 速度: 中速
   - コスト: 高
   - 精度: 非常に高

### Dify UI設定

1. **モデル選択**: `gemini-2.0-flash-exp` または `gemini-1.5-pro`
2. **Temperature**: `0.7` (創造性と一貫性のバランス)
3. **Max Tokens**: `4096` (十分な出力長)
4. **System Prompt**: 空欄（プロンプトに含まれている）
5. **User Prompt**: `{{#1733825600.prompt#}}` ※ノード3の出力を参照

### プロンプト設定

#### Context（コンテキスト）
```
{{#1733825600.prompt#}}
```
※ `1733825600` はノード3のノードID（実際のIDに置き換える）

#### Vision（画像入力）
使用しない

#### Response Format（レスポンス形式）
**JSON Mode** を有効化（Geminiの場合は `response_mime_type: application/json` を設定）

---

## 🔍 ノード5: JSON抽出・整形（Code）

### ノードタイプ
**Code（コード実行）**

### 目的
LLMの出力から純粋なJSONを抽出し、余分な説明文やマークダウンを除去する。

### 入力
- `llm_output` (String): ノード4のLLM出力

### コード（Python）

```python
import json
import re

def clean_json(text: str) -> str:
    """
    JSONブロックを抽出
    """
    # パターン1: ```json ... ``` ブロック
    match = re.search(r'```json\s*\n?(.*?)\n?```', text, re.DOTALL)
    if match:
        return match.group(1).strip()
    
    # パターン2: ``` ... ``` ブロック
    match = re.search(r'```\s*\n?(.*?)\n?```', text, re.DOTALL)
    if match:
        return match.group(1).strip()
    
    # パターン3: { ... } のみ抽出
    match = re.search(r'(\{.*\})', text, re.DOTALL)
    if match:
        return match.group(1).strip()
    
    # そのまま返す
    return text.strip()

def main(llm_output: str) -> dict:
    """
    LLM出力からJSONを抽出・整形
    """
    try:
        # JSON抽出
        cleaned = clean_json(llm_output)
        
        # JSONパース
        data = json.loads(cleaned)
        
        # 基本検証
        if not isinstance(data, dict):
            raise ValueError("Output is not a JSON object")
        
        if "days" not in data:
            raise ValueError("Missing 'days' field")
        
        if not isinstance(data["days"], list):
            raise ValueError("'days' is not an array")
        
        return {
            "success": True,
            "menu_data": data,
            "menu_json": json.dumps(data, ensure_ascii=False, indent=2),
            "days_count": len(data.get("days", [])),
            "error": None
        }
    
    except json.JSONDecodeError as e:
        return {
            "success": False,
            "menu_data": None,
            "menu_json": None,
            "days_count": 0,
            "error": f"JSON parse error: {str(e)}"
        }
    
    except Exception as e:
        return {
            "success": False,
            "menu_data": None,
            "menu_json": None,
            "days_count": 0,
            "error": f"Validation error: {str(e)}"
        }
```

### 出力変数
- `success` (Boolean): 成功フラグ
- `menu_data` (Object): パースされたJSONオブジェクト
- `menu_json` (String): 整形されたJSON文字列
- `days_count` (Number): 生成された日数
- `error` (String): エラーメッセージ（成功時はnull）

---

## ✅ ノード6: 構造検証（Code）

### ノードタイプ
**Code（コード実行）**

### 目的
生成された献立データの構造を詳細に検証する。

### 入力
- `menu_data` (Object): ノード5の出力
- `success` (Boolean): ノード5の成功フラグ
- `days` (Number): 期待される日数

### コード（Python）

```python
import json
from datetime import datetime, timedelta

def validate_date_format(date_str: str) -> bool:
    """日付形式を検証（YYYY-MM-DD）"""
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
        return True
    except:
        return False

def validate_day_structure(day: dict, day_index: int) -> list:
    """1日分の献立構造を検証"""
    errors = []
    
    # 必須フィールド
    required_fields = ["date", "dayLabel", "breakfast", "lunch", "dinner"]
    for field in required_fields:
        if field not in day:
            errors.append(f"Day {day_index + 1}: Missing field '{field}'")
    
    # 日付形式
    if "date" in day and not validate_date_format(day["date"]):
        errors.append(f"Day {day_index + 1}: Invalid date format '{day['date']}'")
    
    # 食事配列
    for meal in ["breakfast", "lunch", "dinner"]:
        if meal in day:
            if not isinstance(day[meal], list):
                errors.append(f"Day {day_index + 1}: '{meal}' is not an array")
            elif len(day[meal]) == 0:
                errors.append(f"Day {day_index + 1}: '{meal}' is empty")
            else:
                # レシピIDの検証
                for recipe_id in day[meal]:
                    if not isinstance(recipe_id, str) or not recipe_id:
                        errors.append(f"Day {day_index + 1}: Invalid recipe ID in '{meal}'")
    
    return errors

def main(menu_data: dict, success: bool, days: int) -> dict:
    """
    献立データの構造を検証
    """
    if not success or not menu_data:
        return {
            "valid": False,
            "errors": ["Previous step failed"],
            "warnings": [],
            "validated_menu": None
        }
    
    errors = []
    warnings = []
    
    # days配列の存在確認
    if "days" not in menu_data:
        errors.append("Missing 'days' field")
        return {
            "valid": False,
            "errors": errors,
            "warnings": warnings,
            "validated_menu": None
        }
    
    days_array = menu_data["days"]
    
    # 日数チェック
    if len(days_array) != days:
        warnings.append(f"Expected {days} days, got {len(days_array)} days")
    
    # 各日の検証
    for i, day in enumerate(days_array):
        day_errors = validate_day_structure(day, i)
        errors.extend(day_errors)
    
    # 検証結果
    is_valid = len(errors) == 0
    
    return {
        "valid": is_valid,
        "errors": errors,
        "warnings": warnings,
        "validated_menu": menu_data if is_valid else None,
        "total_days": len(days_array),
        "total_recipes": sum(
            len(day.get("breakfast", [])) + 
            len(day.get("lunch", [])) + 
            len(day.get("dinner", []))
            for day in days_array
        )
    }
```

### 出力変数
- `valid` (Boolean): 検証成功フラグ
- `errors` (Array): エラーリスト
- `warnings` (Array): 警告リスト
- `validated_menu` (Object): 検証済み献立データ
- `total_days` (Number): 総日数
- `total_recipes` (Number): 総レシピ数

---

## 📤 ノード7: 出力変数の設定（End）

### ノードタイプ
**End（終了ノード）**

### 出力変数定義

| 変数名 | 型 | 参照元 | 説明 |
|--------|-----|--------|------|
| `menu` | Object | ノード6 `validated_menu` | 検証済み献立データ |
| `success` | Boolean | ノード6 `valid` | 成功フラグ |
| `errors` | Array | ノード6 `errors` | エラーリスト |
| `warnings` | Array | ノード6 `warnings` | 警告リスト |
| `total_days` | Number | ノード6 `total_days` | 生成日数 |
| `total_recipes` | Number | ノード6 `total_recipes` | 総レシピ数 |

### Dify UI設定

1. **Workflow設定 → 出力変数** を開く
2. 上記の変数を追加
3. 各変数の参照元ノードを設定

---

## 🔗 ノード間の接続

```
Start (ノード1)
  ↓ recipes
Code: レシピ変換 (ノード2)
  ↓ recipe_json
Code: プロンプト構築 (ノード3)
  ↓ prompt
LLM: Gemini (ノード4)
  ↓ text (LLM出力)
Code: JSON抽出 (ノード5)
  ↓ menu_data, success
Code: 構造検証 (ノード6)
  ↓ validated_menu, valid, errors, warnings
End (ノード7)
```

---

## 🧪 テストケース

### テストケース1: 基本的な3日間献立

**入力**:
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
  "recipes": "[{\"id\":\"rec-teriyaki-chicken\",\"name\":\"鶏の照り焼き\",\"category\":\"main\",\"calories\":620,\"protein\":36,\"salt\":2.2,\"costPerServing\":520}]",
  "daily_calorie_target": 2200,
  "daily_protein_target": 70,
  "daily_salt_max": 8
}
```

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
        "dinner": ["rec-miso-salmon", "rec-potato-salad"]
      },
      {
        "date": "2026-01-11",
        "dayLabel": "土曜日",
        "breakfast": ["rec-natto"],
        "lunch": ["rec-ginger-pork", "rec-cabbage-salad"],
        "dinner": ["rec-saba-shioyaki", "rec-hijiki"]
      },
      {
        "date": "2026-01-12",
        "dayLabel": "日曜日",
        "breakfast": ["rec-tamagoyaki"],
        "lunch": ["rec-karaage", "rec-macaroni-salad"],
        "dinner": ["rec-nikujaga", "rec-spinach-ohitashi"]
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

### テストケース2: 禁止食材あり

**入力**:
```json
{
  "crew_count": 20,
  "days": 2,
  "budget_per_person_per_day": 1000,
  "min_budget_usage_percent": 85,
  "start_date": "2026-01-15",
  "season": "winter",
  "cooking_time_limit": 45,
  "banned_ingredients": "えび,かに",
  "weekday_rules": "{\"friday\":\"カレー\"}",
  "allowed_recipe_ids": "",
  "recipes": "[...]",
  "daily_calorie_target": 2000,
  "daily_protein_target": 65,
  "daily_salt_max": 7
}
```

**期待される動作**:
- えび・かにを含むレシピは除外される
- 金曜日の献立にカレーが含まれる

---

## 🚀 Dify Workflowの作成手順

### ステップ1: 新規Workflow作成

1. Difyダッシュボードにログイン
2. **「Studio」** → **「Workflow」** → **「新規作成」**
3. ワークフロー名: `wellship-menu-generator`
4. 説明: `WELLSHIP船舶献立生成ワークフロー`

### ステップ2: 入力変数設定

1. **Start** ノードをクリック
2. **「入力変数」** タブを開く
3. 上記の14個の変数を追加（ノード1参照）

### ステップ3: ノード追加

1. **Code** ノードを追加 → ノード2のコードを貼り付け
2. **Code** ノードを追加 → ノード3のコードを貼り付け
3. **LLM** ノードを追加 → Gemini設定（ノード4参照）
4. **Code** ノードを追加 → ノード5のコードを貼り付け
5. **Code** ノードを追加 → ノード6のコードを貼り付け

### ステップ4: ノード接続

1. Start → Code(レシピ変換)
2. Code(レシピ変換) → Code(プロンプト構築)
3. Code(プロンプト構築) → LLM(Gemini)
4. LLM(Gemini) → Code(JSON抽出)
5. Code(JSON抽出) → Code(構造検証)
6. Code(構造検証) → End

### ステップ5: 出力変数設定

1. **End** ノードをクリック
2. **「出力変数」** タブを開く
3. 上記の6個の変数を追加（ノード7参照）

### ステップ6: テスト実行

1. **「実行」** ボタンをクリック
2. テストケース1の入力を貼り付け
3. 実行結果を確認

### ステップ7: API公開

1. **「公開」** ボタンをクリック
2. **「API」** タブを開く
3. **API Key** をコピー
4. **Workflow URL** をコピー

---

## 🔧 WELLSHIP側の設定

### 環境変数設定

`.env.local` に追加:

```env
# Dify API設定
DIFY_API_KEY=app-xxxxxxxxxxxxxxxxxxxxxx
DIFY_WORKFLOW_URL=https://api.dify.ai/v1/workflows/run

# AI Provider切り替え
WELLSHIP_AI_PROVIDER=dify
```

### コード修正（不要）

**既存の実装で動作します！**

`/Users/wataru/WELLSHIP_MVP/SaaS/src/lib/ai/providers/dify.ts` は既に実装済みなので、環境変数を設定するだけでOKです。

---

## 📊 動作確認

### 確認手順

1. **環境変数設定**
   ```bash
   cd /Users/wataru/WELLSHIP_MVP/SaaS
   echo 'DIFY_API_KEY=app-your-key-here' >> .env.local
   echo 'DIFY_WORKFLOW_URL=https://api.dify.ai/v1/workflows/run' >> .env.local
   echo 'WELLSHIP_AI_PROVIDER=dify' >> .env.local
   ```

2. **サーバー起動**
   ```bash
   npm run dev
   ```

3. **献立生成テスト**
   - ブラウザで `http://localhost:3000/planning` を開く
   - フォームに入力:
     - 乗員数: 20
     - 日数: 3
     - 予算: 1200円
     - ポリシー: バランス重視
   - **「献立を生成」** ボタンをクリック

4. **ログ確認**
   ```
   🤖 Using AI provider: dify
   🤖 Dify API Request: { crew_count: 20, days: 3, ... }
   ✅ Dify API Response: { days_generated: 3, ... }
   ✅ Menu generated using Dify Workflow
   ```

---

## 🐛 トラブルシューティング

### エラー1: `DIFY_API_KEY is not set`

**原因**: 環境変数が設定されていない

**解決策**:
```bash
echo 'DIFY_API_KEY=app-your-key-here' >> .env.local
```

### エラー2: `Dify API error (401)`

**原因**: APIキーが無効

**解決策**:
1. Difyダッシュボードで新しいAPIキーを生成
2. `.env.local` を更新

### エラー3: `No menu output from Dify workflow`

**原因**: 出力変数名が `menu` でない

**解決策**:
1. Dify Workflowの **End** ノードを確認
2. 出力変数名を `menu` に変更

### エラー4: `Dify output is not valid JSON`

**原因**: LLMがJSON以外の文字列を返している

**解決策**:
1. ノード5（JSON抽出）のコードを確認
2. LLMノードの **Response Format** を **JSON Mode** に設定

---

## 📈 パフォーマンス最適化

### 1. レシピマスタの圧縮

現在、全レシピをJSON文字列として送信していますが、大量のレシピがある場合は以下を検討:

```python
# ノード2で不要なフィールドを削除
formatted_recipes.append({
    "id": r["id"],
    "name": r["name"],
    "category": r["category"],
    "cost": r["costPerServing"]
    # calories, protein, salt は削除（プロンプトで使わない場合）
})
```

### 2. キャッシュ活用

同じレシピマスタで複数回実行する場合、Difyの **Variable Cache** を活用:

```python
# ノード2の出力をキャッシュ
return {
    "recipe_json": json.dumps(formatted_recipes),
    "_cache_key": f"recipes_{len(formatted_recipes)}"
}
```

### 3. 並列実行

複数の献立パターンを生成する場合、Difyの **Parallel** ノードを活用。

---

## 🎓 まとめ

このDify Workflowにより、以下が実現されます:

✅ **完全な互換性**: 既存のWELLSHIP実装と100%互換  
✅ **柔軟性**: プロンプトをDify側で管理・調整可能  
✅ **可視性**: Dify UIで実行ログを確認可能  
✅ **拡張性**: 新しいノード（予算最適化、栄養バランス調整など）を追加可能  
✅ **フォールバック**: Dify失敗時は自動的にGemini直接呼び出しに切り替え  

次のステップ:
1. Dify Workflowを作成
2. APIキーを取得
3. `.env.local` に設定
4. `/planning` ページでテスト実行
