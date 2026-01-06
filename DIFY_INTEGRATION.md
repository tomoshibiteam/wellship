# Dify統合ガイド - WELLSHIP MVP

このドキュメントでは、WELLSHIPのAI献立生成機能をDifyで実装するための要件とセットアップ手順を説明します。

---

## 概要

- **目的**: AI献立生成をDify Workflowで実装
- **入力**: 乗員数、日数、予算、季節などの制約条件
- **出力**: 日別・食事タイプ別のRecipe ID配列（JSON形式）

---

## Dify側の要件

### 1. エンドポイント設定

Difyで使用するAPIタイプを選択してください:

- **Workflow API** (推奨): 複数ステップの処理を組み合わせる
- **Chat Completion API**: シンプルなプロンプトベースの生成

### 2. 入力パラメータ

Dify Workflowでは、以下の入力変数を受け取る必要があります:

| パラメータ名 | 型 | 説明 | 例 |
|------------|-------|------|-----|
| `crew_count` | Number | 乗員数 | `20` |
| `days` | Number | 献立日数 | `7` |
| `budget_per_person_per_day` | Number | 1人1日あたりの予算（円） | `1200` |
| `min_budget_usage_percent` | Number | 最低予算消化率（%） | `90` |
| `start_date` | String | 開始日（YYYY-MM-DD） | `"2026-01-06"` |
| `season` | String | 季節（任意） | `"winter"` |
| `cooking_time_limit` | Number | 調理時間上限（分）（任意） | `60` |
| `banned_ingredients` | String | 禁止食材（カンマ区切り）（任意） | `"えび,かに"` |
| `weekday_rules` | String | 曜日ルール（JSON文字列）（任意） | `"{\"friday\":\"カレー\"}"` |
| `allowed_recipe_ids` | String | 使用可能レシピID（カンマ区切り）（任意） | `"r1,r2,r3"` |

### 3. 出力フォーマット（必須）

Difyからの出力は**必ずJSON形式**で、以下の構造に従ってください:

```json
{
  "days": [
    {
      "date": "2026-01-06",
      "dayLabel": "月曜日",
      "breakfast": ["recipe-id-1"],
      "lunch": ["recipe-id-2", "recipe-id-3"],
      "dinner": ["recipe-id-4", "recipe-id-5"]
    },
    {
      "date": "2026-01-07",
      "dayLabel": "火曜日",
      "breakfast": ["recipe-id-6"],
      "lunch": ["recipe-id-7", "recipe-id-8"],
      "dinner": ["recipe-id-9", "recipe-id-10"]
    }
  ]
}
```

**重要な注意点**:
- `breakfast`, `lunch`, `dinner`は**Recipe IDの配列**を返す
- 各食事に1〜2品を推奨
- **余計な説明文やマークダウンは含めない**（純粋なJSONのみ）

### 4. Recipe IDの取得方法

Difyで献立を生成する際、以下のいずれかの方法でRecipe IDを解決してください:

#### オプション1: 事前にRecipeマスタをDifyに渡す（推奨）

- Dify起動時にRecipeマスタ（ID、名前、カテゴリ、コスト等）を渡す
- Dify内でRecipe IDを直接選択して返す

#### オプション2: 料理名を返す → サーバー側で解決

- Dify is 料理名（例: `"焼き魚"`）を返す
- WELLSHIP側で料理名→Recipe ID変換を行う
- **注意**: 名前が曖昧だとマッチングに失敗する可能性あり

#### オプション3: 外部APIでRecipe検索

- Dify内でWELLSHIPのRecipe検索APIを呼び出す（要実装）
- Recipe IDを直接取得

---

## WELLSHIP側の設定

### 1. 環境変数

`.env.local`に以下を追加:

```env
# Dify API設定
DIFY_API_KEY=your_dify_api_key_here
DIFY_WORKFLOW_URL=https://api.dify.ai/v1/workflows/run

# Feature Flag
WELLSHIP_AI_PROVIDER=dify
```

### 2. Dify APIキーの取得

1. Difyダッシュボードにログイン
2. ワークフローを作成
3. 「API」セクションからAPIキーを取得
4. ワークフローIDまたはURLを確認

### 3. テスト

以下のコマンドでDify APIが正しく動作するか確認:

```bash
curl -X POST https://api.dify.ai/v1/workflows/run \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "crew_count": 20,
      "days": 3,
      "budget_per_person_per_day": 1200,
      "min_budget_usage_percent": 90,
      "start_date": "2026-01-06",
      "season": "winter"
    },
    "response_mode": "blocking",
    "user": "wellship-test"
  }'
```

---

## 実装例

### Dify Workflowの設計（例）

```
入力
  ↓
【ステップ1】制約条件の解析
  - 予算計算
  - 季節に応じた食材選定
  - 禁止食材の除外
  ↓
【ステップ2】AI献立生成（LLMノード）
  - GPT-4やClaude等でプロンプト実行
  - 日数分のレシピ候補を生成
  ↓
【ステップ3】バリデーション・調整
  - 予算範囲チェック
  - 重複レシピの除外
  ↓
【ステップ4】JSON整形
  - 出力フォーマットに準拠
  ↓
出力
```

### プロンプト例（LLMノード用）

```
あなたは船舶の司厨のためのAI献立プランナーです。
以下の条件に基づいて、{{days}}日分の献立を生成してください。

## 基本条件
- 乗員数: {{crew_count}}名
- 期間: {{days}}日間（{{start_date}}から）
- 1人1日あたりの予算: {{budget_per_person_per_day}}円
- 最低予算消化: {{min_budget_usage_percent}}%以上

## 制約
- 季節: {{season}}
- 禁止食材: {{banned_ingredients}}

## 利用可能レシピ（IDで指定）
{{recipe_master}}

## 出力形式（JSON）
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "dayLabel": "曜日",
      "breakfast": ["recipe-id"],
      "lunch": ["recipe-id", "recipe-id"],
      "dinner": ["recipe-id", "recipe-id"]
    }
  ]
}

JSONのみを出力してください。説明は不要です。
```

---

## トラブルシューティング

### 1. `DIFY_API_KEY is not set` エラー

- `.env.local`にAPIキーが設定されているか確認
- サーバーを再起動（環境変数の再読み込み）

### 2. `Dify API error (401)` エラー

- APIキーが正しいか確認
- Difyダッシュボードで権限を確認

### 3. `No menu output from Dify workflow` エラー

- Difyの出力が`data.outputs.menu`または`outputs.menu`に格納されているか確認
- Workflow設計でOutput変数名が`menu`になっているか確認

### 4. `Dify output is not valid JSON` エラー

- DifyのLLMノードで**JSONのみ**を出力するよう指示
- 「JSONを返して」だけでなく、「説明不要」と明示

### 5. Recipe IDが見つからない

- Dify側でRecipe IDを正しく返しているか確認
- 料理名の場合、WELLSHIP側でマッチング処理が必要

---

## 次のステップ

1. Dify Workflowを設計・実装
2. テストAPIで動作確認
3. WELLSHIP側で環境変数設定
4. `/planning`ページで献立生成をテスト
5. エラーログを確認しながら調整

---

## サポート

問題が発生した場合:
1. サーバーログを確認（`console.log`で詳細出力）
2. Difyダッシュボードのログを確認
3. Feature Flagを`gemini`に切り替えて比較テスト
