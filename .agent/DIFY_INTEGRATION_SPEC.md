# WELLSHIP × Dify 統合仕様書

## A. 現状調査（ファイルパス付き）

### 1. データベーススキーマ

**ファイル**: `/Users/wataru/WELLSHIP_MVP/SaaS/prisma/schema.prisma`

#### 1.1 在庫（Ingredient）

```prisma
model Ingredient {
  id                String             @id @default(cuid())
  name              String
  storageType       StorageType        // frozen/chilled/room
  unit              String
  costPerUnit       Float              @default(0)
  companyId         String?
  
  recipeIngredients RecipeIngredient[]
  procurementAdjustments ProcurementAdjustment[]
}
```

**サンプルデータ**:
```json
{
  "id": "ing-chicken-thigh",
  "name": "鶏もも肉",
  "storageType": "chilled",
  "unit": "g",
  "costPerUnit": 2.0,
  "companyId": "company-demo"
}
```

**実装位置**:
- **DBテーブル**: `Ingredient`
- **型定義**: `/Users/wataru/WELLSHIP_MVP/SaaS/src/lib/types.ts` (line 9-14)
- **Repository**: `/Users/wataru/WELLSHIP_MVP/SaaS/src/lib/repositories/ingredients.ts`

---

#### 1.2 食材マスタ（RecipeIngredient）

```prisma
model RecipeIngredient {
  id           String     @id @default(cuid())
  amount       Float
  recipeId     String
  ingredientId String
  
  recipe       Recipe     @relation(...)
  ingredient   Ingredient @relation(...)
}
```

**サンプルデータ**:
```json
{
  "id": "cmk5ze9fp0003okmc4rev85id",
  "amount": 180.0,
  "recipeId": "rec-teriyaki-chicken",
  "ingredientId": "ing-chicken-thigh"
}
```

**実装位置**:
- **DBテーブル**: `RecipeIngredient`
- **型定義**: `/Users/wataru/WELLSHIP_MVP/SaaS/src/lib/types.ts` (line 16-20)

---

#### 1.3 レシピ/献立（Recipe）

```prisma
model Recipe {
  id                String             @id @default(cuid())
  name              String
  category          RecipeCategory     // main/side/soup/dessert
  calories          Float
  protein           Float
  salt              Float
  costPerServing    Float
  companyId         String?
  
  ingredients       RecipeIngredient[]
  menuPlans         MenuPlanRecipe[]
  exclusions        RecipeExclusion[]
}
```

**サンプルデータ**:
```json
{
  "id": "rec-teriyaki-chicken",
  "name": "鶏の照り焼き",
  "category": "main",
  "calories": 620.0,
  "protein": 36.0,
  "salt": 2.2,
  "costPerServing": 520.0,
  "companyId": "company-demo"
}
```

**実装位置**:
- **DBテーブル**: `Recipe`
- **型定義**: `/Users/wataru/WELLSHIP_MVP/SaaS/src/lib/types.ts` (line 22-31)
- **Repository**: `/Users/wataru/WELLSHIP_MVP/SaaS/src/lib/repositories/recipes.ts`

---

#### 1.4 献立計画（MenuPlan）

```prisma
model MenuPlan {
  id          String            @id @default(cuid())
  date        String            // YYYY-MM-DD
  mealType    MealType          // breakfast/lunch/dinner
  healthScore Float
  crewCount   Int               @default(20)
  budgetPerPerson Int           @default(1200)
  isClosed    Boolean           @default(false)
  vesselId    String?
  
  recipeLinks MenuPlanRecipe[]
  feedbacks   MealFeedback[]
}
```

**サンプルデータ**:
```json
{
  "id": "plan-2024-12-06-dinner",
  "date": "2024-12-06",
  "mealType": "dinner",
  "healthScore": 82.0,
  "crewCount": 20,
  "budgetPerPerson": 1200,
  "isClosed": false,
  "vesselId": "vessel-sakura"
}
```

**実装位置**:
- **DBテーブル**: `MenuPlan`
- **型定義**: `/Users/wataru/WELLSHIP_MVP/SaaS/src/lib/types.ts` (line 33-39)
- **Repository**: `/Users/wataru/WELLSHIP_MVP/SaaS/src/lib/repositories/menuPlans.ts`

---

#### 1.5 制約（Constraints）

##### 1.5.1 アレルギー・禁則（RecipeExclusion）

```prisma
model RecipeExclusion {
  id        String         @id @default(cuid())
  recipeId  String
  scope     ExclusionScope // CHEF/VESSEL
  reason    String
  userId    String?        // CHEF scope
  vesselId  String?        // VESSEL scope
}
```

**実装位置**:
- **DBテーブル**: `RecipeExclusion`
- **使用箇所**: `/Users/wataru/WELLSHIP_MVP/SaaS/src/app/(dashboard)/planning/actions.ts` (line 409-423, 現在コメントアウト)

##### 1.5.2 予算制約（Vessel設定）

```prisma
model Vessel {
  id                    String  @id @default(cuid())
  name                  String
  minBudgetUsagePercent Int     @default(90)
  defaultSeason         String? // spring/summer/autumn/winter
  defaultMaxCookingTime Int?    // 分
  companyId             String
}
```

**サンプルデータ**:
```json
{
  "id": "vessel-sakura",
  "name": "桜丸",
  "minBudgetUsagePercent": 90,
  "defaultSeason": null,
  "defaultMaxCookingTime": null,
  "companyId": "company-demo"
}
```

##### 1.5.3 調達制約（ProcurementAdjustment）

```prisma
model ProcurementAdjustment {
  id            String     @id @default(cuid())
  ingredientId  String
  startDate     String     // YYYY-MM-DD
  endDate       String     // YYYY-MM-DD
  plannedAmount Float
  orderAmount   Float
  inStock       Boolean    @default(false)
  unitPrice     Float
  vesselId      String?
}
```

**サンプルデータ**:
```json
{
  "id": "cmk5zfgo80001ok8zrmbjhv0i",
  "ingredientId": "ing-carrot",
  "startDate": "2024-12-06",
  "endDate": "2024-12-08",
  "plannedAmount": 4000.0,
  "orderAmount": 4000.0,
  "inStock": false,
  "unitPrice": 0.9,
  "vesselId": null
}
```

**実装位置**:
- **DBテーブル**: `ProcurementAdjustment`
- **API**: `/Users/wataru/WELLSHIP_MVP/SaaS/src/app/api/procurement/adjustment/route.ts`

##### 1.5.4 港/仕入れ先

**現状**: 未実装（将来的に `Port` または `Supplier` モデルとして追加予定）

---

### 2. AI Provider実装

**ファイル**: `/Users/wataru/WELLSHIP_MVP/SaaS/src/lib/ai/providers/`

#### 2.1 Provider Factory

**ファイル**: `index.ts` (line 18-31)

```typescript
export function getMenuGenerator(): MenuGenerator {
    const provider = features.aiProvider; // 'dify' | 'gemini'
    
    switch (provider) {
        case 'dify':
            return new DifyMenuGenerator();
        case 'gemini':
        default:
            return new GeminiMenuGenerator();
    }
}
```

#### 2.2 Dify実装

**ファイル**: `dify.ts`

- **入力マッピング**: line 35-47
- **出力パース**: line 62-69
- **バリデーション**: line 86-142

#### 2.3 型定義

**ファイル**: `types.ts`

```typescript
export interface MenuGenInput {
    crewCount: number;
    days: number;
    budgetPerPersonPerDay: number;
    minBudgetUsagePercent: number;
    startDate: string; // YYYY-MM-DD
    
    // Optional constraints
    season?: 'spring' | 'summer' | 'autumn' | 'winter';
    cookingTimeLimit?: number;
    bannedIngredients?: string[];
    weekdayRules?: Record<string, string>;
    allowedRecipeIds?: string[];
}

export interface MenuGenOutput {
    days: Array<{
        date: string;
        dayLabel: string;
        breakfast: string[]; // Recipe IDs
        lunch: string[];
        dinner: string[];
    }>;
}
```

---

### 3. 呼び出し口

#### 3.1 API Route

**ファイル**: `/Users/wataru/WELLSHIP_MVP/SaaS/src/app/api/menu/generate/route.ts`

```typescript
export async function POST(request: Request) {
    const body = await request.json();
    const plan = await generateMenuPlan(body);
    return NextResponse.json({ plan });
}
```

#### 3.2 Server Action

**ファイル**: `/Users/wataru/WELLSHIP_MVP/SaaS/src/app/(dashboard)/planning/actions.ts`

**関数**: `generateMenuPlan()` (line 403-525)

**処理フロー**:
1. レシピ取得（line 426-448）
2. AI生成試行（line 481）
3. フォールバック（line 484）
4. 予算調整（line 489）
5. DB保存（line 492-522）

---

## B. Dify入力スキーマ（JSON Schema + サンプル）

### JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": [
    "crew_count",
    "days",
    "budget_per_person_per_day",
    "min_budget_usage_percent",
    "start_date"
  ],
  "properties": {
    "crew_count": {
      "type": "integer",
      "description": "乗員数",
      "minimum": 1,
      "example": 20
    },
    "days": {
      "type": "integer",
      "description": "献立日数",
      "minimum": 1,
      "maximum": 30,
      "example": 7
    },
    "budget_per_person_per_day": {
      "type": "number",
      "description": "1人1日あたりの予算（円）",
      "minimum": 0,
      "example": 1200
    },
    "min_budget_usage_percent": {
      "type": "integer",
      "description": "最低予算消化率（%）",
      "minimum": 0,
      "maximum": 100,
      "default": 90,
      "example": 90
    },
    "start_date": {
      "type": "string",
      "format": "date",
      "description": "開始日（YYYY-MM-DD）",
      "example": "2026-01-10"
    },
    "season": {
      "type": "string",
      "enum": ["spring", "summer", "autumn", "winter"],
      "description": "季節（任意）",
      "example": "winter"
    },
    "cooking_time_limit": {
      "type": "integer",
      "description": "調理時間上限（分）（任意）",
      "minimum": 0,
      "example": 60
    },
    "banned_ingredients": {
      "type": "string",
      "description": "禁止食材（カンマ区切り）（任意）",
      "example": "えび,かに,そば"
    },
    "weekday_rules": {
      "type": "string",
      "description": "曜日ルール（JSON文字列）（任意）",
      "example": "{\"friday\":\"カレー\"}"
    },
    "allowed_recipe_ids": {
      "type": "string",
      "description": "使用可能レシピID（カンマ区切り）（任意）",
      "example": "rec-teriyaki-chicken,rec-miso-salmon,rec-ginger-pork"
    },
    "recipes": {
      "type": "array",
      "description": "利用可能レシピマスタ（Difyに渡す場合）",
      "items": {
        "type": "object",
        "required": ["id", "name", "category", "calories", "protein", "salt", "costPerServing"],
        "properties": {
          "id": {"type": "string"},
          "name": {"type": "string"},
          "category": {"type": "string", "enum": ["main", "side", "soup", "dessert"]},
          "calories": {"type": "number"},
          "protein": {"type": "number"},
          "salt": {"type": "number"},
          "costPerServing": {"type": "number"}
        }
      }
    }
  }
}
```

### サンプルJSON（1件）

```json
{
  "crew_count": 20,
  "days": 7,
  "budget_per_person_per_day": 1200,
  "min_budget_usage_percent": 90,
  "start_date": "2026-01-10",
  "season": "winter",
  "cooking_time_limit": 60,
  "banned_ingredients": "えび,かに",
  "weekday_rules": "{\"friday\":\"カレー\"}",
  "allowed_recipe_ids": "rec-teriyaki-chicken,rec-miso-salmon,rec-ginger-pork,rec-spinach-ohitashi,rec-miso-soup",
  "recipes": [
    {
      "id": "rec-teriyaki-chicken",
      "name": "鶏の照り焼き",
      "category": "main",
      "calories": 620.0,
      "protein": 36.0,
      "salt": 2.2,
      "costPerServing": 520.0
    },
    {
      "id": "rec-miso-salmon",
      "name": "サーモンの味噌焼き",
      "category": "main",
      "calories": 540.0,
      "protein": 32.0,
      "salt": 2.0,
      "costPerServing": 640.0
    }
  ]
}
```

### 入力データの取得元

| パラメータ | 取得元 | 備考 |
|-----------|--------|------|
| `crew_count` | フロント入力 | `/planning` ページのフォーム |
| `days` | フロント入力 | 同上 |
| `budget_per_person_per_day` | フロント入力 | 同上 |
| `min_budget_usage_percent` | DB (`Vessel.minBudgetUsagePercent`) | デフォルト90% |
| `start_date` | 自動生成 | `new Date().toISOString().slice(0, 10)` |
| `season` | DB (`Vessel.defaultSeason`) または フロント入力 | 任意 |
| `cooking_time_limit` | DB (`Vessel.defaultMaxCookingTime`) または フロント入力 | 任意 |
| `banned_ingredients` | DB (`RecipeExclusion`) | 現在コメントアウト |
| `weekday_rules` | フロント入力 | 任意 |
| `allowed_recipe_ids` | DB (`ProcurementAdjustment`) | `WELLSHIP_SOURCING_ENABLED=true` の場合 |
| `recipes` | DB (`Recipe` + `RecipeIngredient`) | `getAllRecipes()` で取得 |

---

## C. Dify出力スキーマ（JSON Schema + サンプル）

### JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["days"],
  "properties": {
    "days": {
      "type": "array",
      "description": "日別献立配列",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["date", "dayLabel", "breakfast", "lunch", "dinner"],
        "properties": {
          "date": {
            "type": "string",
            "format": "date",
            "description": "日付（YYYY-MM-DD）",
            "example": "2026-01-10"
          },
          "dayLabel": {
            "type": "string",
            "description": "曜日ラベル",
            "example": "月曜日"
          },
          "breakfast": {
            "type": "array",
            "description": "朝食のレシピID配列",
            "items": {"type": "string"},
            "example": ["rec-miso-soup", "rec-rice"]
          },
          "lunch": {
            "type": "array",
            "description": "昼食のレシピID配列",
            "items": {"type": "string"},
            "example": ["rec-teriyaki-chicken", "rec-spinach-ohitashi", "rec-miso-soup"]
          },
          "dinner": {
            "type": "array",
            "description": "夕食のレシピID配列",
            "items": {"type": "string"},
            "example": ["rec-miso-salmon", "rec-potato-salad", "rec-miso-soup"]
          }
        }
      }
    }
  }
}
```

### サンプルJSON（1件）

```json
{
  "days": [
    {
      "date": "2026-01-10",
      "dayLabel": "月曜日",
      "breakfast": ["rec-miso-soup", "rec-rice"],
      "lunch": ["rec-teriyaki-chicken", "rec-spinach-ohitashi", "rec-miso-soup"],
      "dinner": ["rec-miso-salmon", "rec-potato-salad", "rec-miso-soup"]
    },
    {
      "date": "2026-01-11",
      "dayLabel": "火曜日",
      "breakfast": ["rec-natto", "rec-rice"],
      "lunch": ["rec-ginger-pork", "rec-cabbage-salad", "rec-miso-soup"],
      "dinner": ["rec-saba-shioyaki", "rec-hijiki", "rec-miso-soup"]
    },
    {
      "date": "2026-01-12",
      "dayLabel": "水曜日",
      "breakfast": ["rec-tamagoyaki", "rec-rice"],
      "lunch": ["rec-karaage", "rec-macaroni-salad", "rec-miso-soup"],
      "dinner": ["rec-nikujaga", "rec-spinach-ohitashi", "rec-miso-soup"]
    }
  ]
}
```

### 出力データの保存先

**保存処理**: `/Users/wataru/WELLSHIP_MVP/SaaS/src/app/(dashboard)/planning/actions.ts` (line 492-522)

```typescript
for (const day of generated) {
  for (const mealType of ['breakfast', 'lunch', 'dinner']) {
    await prisma.menuPlan.upsert({
      where: { id: `plan-${day.date}-${mealType}` },
      create: {
        date: day.date,
        mealType: mealType,
        healthScore: day.healthScore,
        crewCount: input.crewCount,
        budgetPerPerson: input.budget,
        recipeLinks: {
          create: recipesForMeal.map(r => ({ recipeId: r.id }))
        }
      }
    });
  }
}
```

**表示箇所**:
- `/planning` ページ: 献立カレンダー表示
- `/daily-menu` ページ: 当日の献立表示

---

## D. 実装手順（WELLSHIP→Dify→WELLSHIP）

### フロー図

```
[フロント: /planning]
    ↓ (1) フォーム送信
[API: /api/menu/generate]
    ↓ (2) Server Action呼び出し
[actions.ts: generateMenuPlan()]
    ↓ (3) DB からレシピ・制約取得
    ↓ (4) MenuGenInput 構築
[providers/index.ts: getMenuGenerator()]
    ↓ (5) Feature Flag 確認
[providers/dify.ts: DifyMenuGenerator.generate()]
    ↓ (6) Dify API 呼び出し
[Dify Workflow]
    ↓ (7) LLM 献立生成
    ↓ (8) JSON 整形
[providers/dify.ts]
    ↓ (9) レスポンス検証
    ↓ (10) MenuGenOutput 返却
[actions.ts]
    ↓ (11) 予算調整
    ↓ (12) DB 保存
    ↓ (13) フロントに返却
[フロント]
    ↓ (14) 献立表示
```

### 詳細手順

#### ステップ1: フロント → API

**ファイル**: `/Users/wataru/WELLSHIP_MVP/SaaS/src/app/(dashboard)/planning/page.tsx` (推定)

```typescript
const response = await fetch('/api/menu/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    crewCount: 20,
    days: 7,
    budget: 1200,
    policy: 'バランス重視'
  })
});
```

#### ステップ2: API → Server Action

**ファイル**: `/Users/wataru/WELLSHIP_MVP/SaaS/src/app/api/menu/generate/route.ts`

```typescript
export async function POST(request: Request) {
  const body = await request.json();
  const plan = await generateMenuPlan(body);
  return NextResponse.json({ plan });
}
```

#### ステップ3: レシピ・制約取得

**ファイル**: `/Users/wataru/WELLSHIP_MVP/SaaS/src/app/(dashboard)/planning/actions.ts` (line 426-456)

```typescript
// レシピ取得
const allRecipes = await prisma.recipe.findMany({
  include: { ingredients: { include: { ingredient: true } } }
});

// 除外レシピ取得（現在コメントアウト）
// const exclusions = await prisma.recipeExclusion.findMany(...);

// 船舶設定取得
const vessel = await prisma.vessel.findUnique({ where: { id: vesselId } });
const minBudgetUsagePercent = vessel?.minBudgetUsagePercent ?? 90;
```

#### ステップ4: Dify呼び出し

**ファイル**: `/Users/wataru/WELLSHIP_MVP/SaaS/src/lib/ai/providers/dify.ts` (line 25-81)

```typescript
const response = await fetch(this.workflowUrl, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${this.apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    inputs: {
      crew_count: input.crewCount,
      days: input.days,
      budget_per_person_per_day: input.budgetPerPersonPerDay,
      min_budget_usage_percent: input.minBudgetUsagePercent,
      start_date: input.startDate,
      season: input.season || '',
      cooking_time_limit: input.cookingTimeLimit || 0,
      banned_ingredients: input.bannedIngredients?.join(',') || '',
      weekday_rules: JSON.stringify(input.weekdayRules || {}),
      allowed_recipe_ids: input.allowedRecipeIds?.join(',') || '',
    },
    response_mode: 'blocking',
    user: 'wellship-server',
  }),
});
```

#### ステップ5: レスポンス検証

**ファイル**: `/Users/wataru/WELLSHIP_MVP/SaaS/src/lib/ai/providers/dify.ts` (line 86-142)

```typescript
// JSON パース
let data = typeof output === 'string' ? JSON.parse(output) : output;

// 構造検証
if (!Array.isArray(data.days)) {
  throw new MenuValidationError('Dify output missing "days" array');
}

// 各日の検証
for (const day of data.days) {
  if (!day.date || !day.breakfast || !day.lunch || !day.dinner) {
    throw new MenuValidationError('Invalid day structure');
  }
}
```

#### ステップ6: DB保存

**ファイル**: `/Users/wataru/WELLSHIP_MVP/SaaS/src/app/(dashboard)/planning/actions.ts` (line 492-522)

```typescript
for (const day of generated) {
  for (const mealType of mealOrder) {
    const recipesForMeal = day.meals[mealType];
    const id = `plan-${day.date}-${mealType}`;
    
    await prisma.menuPlan.upsert({
      where: { id },
      update: {
        date: day.date,
        mealType,
        healthScore: day.healthScore,
        crewCount: input.crewCount,
        budgetPerPerson: input.budget,
        recipeLinks: {
          deleteMany: {},
          create: recipesForMeal.map(r => ({ recipeId: r.id })),
        },
      },
      create: { /* 同上 */ },
    });
  }
}
```

---

### リトライ/タイムアウト/ログ方針

#### リトライ戦略

**実装場所**: `/Users/wataru/WELLSHIP_MVP/SaaS/src/lib/ai/providers/dify.ts` (新規追加推奨)

```typescript
async generate(input: MenuGenInput): Promise<MenuGenOutput> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(this.workflowUrl, { /* ... */ });
      
      if (!response.ok) {
        if (response.status >= 500 && attempt < MAX_RETRIES) {
          console.warn(`⚠️ Dify API error (${response.status}), retrying... (${attempt}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
          continue;
        }
        throw new Error(`Dify API error (${response.status})`);
      }
      
      return this.parseAndValidate(data);
    } catch (error) {
      if (attempt === MAX_RETRIES) throw error;
      console.warn(`⚠️ Dify request failed, retrying... (${attempt}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
  }
}
```

#### タイムアウト設定

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒

try {
  const response = await fetch(this.workflowUrl, {
    signal: controller.signal,
    // ...
  });
} finally {
  clearTimeout(timeoutId);
}
```

#### ログ方針

**実装場所**: `/Users/wataru/WELLSHIP_MVP/SaaS/src/lib/ai/providers/dify.ts`

```typescript
// リクエストログ
console.log('🤖 Dify API Request:', {
  crew_count: input.crewCount,
  days: input.days,
  budget: input.budgetPerPersonPerDay,
  timestamp: new Date().toISOString(),
});

// レスポンスログ
console.log('✅ Dify API Response:', {
  days_generated: output.days.length,
  total_recipes: output.days.reduce((sum, d) => 
    sum + d.breakfast.length + d.lunch.length + d.dinner.length, 0),
  timestamp: new Date().toISOString(),
});

// エラーログ
console.error('❌ Dify API Error:', {
  error: error.message,
  stack: error.stack,
  input: JSON.stringify(input),
  timestamp: new Date().toISOString(),
});
```

---

## E. 環境変数一覧

### 既存のAI関連

**ファイル**: `/Users/wataru/WELLSHIP_MVP/SaaS/ENV_GUIDE.md`

```env
# Google Gemini API（フォールバック用）
GEMINI_API_KEY=your_gemini_api_key_here
```

**使用箇所**: `/Users/wataru/WELLSHIP_MVP/SaaS/src/lib/ai/gemini.ts`

---

### 追加が必要な環境変数

#### Dify関連

```env
# Dify API認証
DIFY_API_KEY=app-xxxxxxxxxxxxxxxxxxxxxx

# Dify Workflow URL（どちらか必須）
DIFY_WORKFLOW_URL=https://api.dify.ai/v1/workflows/run
# または
DIFY_APP_ID=your_dify_app_id_here
```

**使用箇所**: `/Users/wataru/WELLSHIP_MVP/SaaS/src/lib/ai/providers/dify.ts` (line 14-22)

#### Feature Flags

```env
# AI Provider選択（'dify' | 'gemini'）
WELLSHIP_AI_PROVIDER=dify

# 写真フィードバック機能（MVP: false）
WELLSHIP_PHOTO_FEEDBACK_ENABLED=false

# 調達制約機能（MVP: false）
WELLSHIP_SOURCING_ENABLED=false
```

**使用箇所**: `/Users/wataru/WELLSHIP_MVP/SaaS/src/lib/config/features.ts`

---

### 環境別設定

#### Development

```env
# .env.local
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_dev_secret_here

GEMINI_API_KEY=your_gemini_api_key_here

DIFY_API_KEY=app-dev-xxxxxxxxxxxxxx
DIFY_WORKFLOW_URL=https://api.dify.ai/v1/workflows/run

WELLSHIP_AI_PROVIDER=dify
WELLSHIP_PHOTO_FEEDBACK_ENABLED=false
WELLSHIP_SOURCING_ENABLED=false
```

#### Staging

```env
# .env.staging
NEXTAUTH_URL=https://staging.wellship.example.com
NEXTAUTH_SECRET=your_staging_secret_here

GEMINI_API_KEY=your_gemini_api_key_here

DIFY_API_KEY=app-staging-xxxxxxxxxxxxxx
DIFY_WORKFLOW_URL=https://api.dify.ai/v1/workflows/run

WELLSHIP_AI_PROVIDER=dify
WELLSHIP_PHOTO_FEEDBACK_ENABLED=false
WELLSHIP_SOURCING_ENABLED=false
```

#### Production

```env
# .env.production
NEXTAUTH_URL=https://app.wellship.example.com
NEXTAUTH_SECRET=your_production_secret_here_use_strong_random_string

GEMINI_API_KEY=your_gemini_api_key_here

DIFY_API_KEY=app-prod-xxxxxxxxxxxxxx
DIFY_WORKFLOW_URL=https://api.dify.ai/v1/workflows/run

WELLSHIP_AI_PROVIDER=dify
WELLSHIP_PHOTO_FEEDBACK_ENABLED=false
WELLSHIP_SOURCING_ENABLED=true  # 本番環境では調達制約を有効化
```

---

### 環境変数検証

**実装場所**: `/Users/wataru/WELLSHIP_MVP/SaaS/src/lib/config/features.ts` (line 65-88)

```typescript
export function validateFeatureFlags(): void {
  const warnings: string[] = [];
  
  if (features.aiProvider === 'dify') {
    if (!process.env.DIFY_API_KEY) {
      warnings.push('DIFY_API_KEY is not set but aiProvider is "dify"');
    }
    if (!process.env.DIFY_WORKFLOW_URL && !process.env.DIFY_APP_ID) {
      warnings.push('Neither DIFY_WORKFLOW_URL nor DIFY_APP_ID is set');
    }
  }
  
  if (features.aiProvider === 'gemini') {
    if (!process.env.GEMINI_API_KEY) {
      warnings.push('GEMINI_API_KEY is not set but aiProvider is "gemini"');
    }
  }
  
  if (warnings.length > 0) {
    console.warn('⚠️  Feature Flag Configuration Warnings:');
    warnings.forEach(w => console.warn(`   - ${w}`));
  }
}
```

**呼び出し**: サーバー起動時に `validateFeatureFlags()` を実行（推奨）

---

## 補足: Dify Workflow設計例

### 推奨構成

```
[Start: 入力受付]
  ↓
[Node 1: 制約条件解析]
  - 予算計算
  - 季節・禁止食材の確認
  ↓
[Node 2: LLMノード（献立生成）]
  - Model: GPT-4 / Claude 3.5 Sonnet
  - Prompt: menu.ts の buildMenuGenerationPrompt() を参考
  - Output: JSON形式
  ↓
[Node 3: コード実行ノード（JSON整形）]
  - 余分な説明文を除去
  - 構造検証
  - レシピID存在チェック
  ↓
[Node 4: 出力変数設定]
  - 変数名: "menu"
  - 型: JSON Object
  ↓
[End: 出力]
```

### LLMノードのプロンプト例

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
- 調理時間上限: {{cooking_time_limit}}分

## 利用可能レシピ
{{recipes}}

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

### コード実行ノード（JSON整形）

```python
import json
import re

def clean_json(text):
    # JSONブロックを抽出
    match = re.search(r'```json\n?(.*?)\n?```', text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return text.strip()

def main(llm_output):
    cleaned = clean_json(llm_output)
    data = json.loads(cleaned)
    
    # 構造検証
    if 'days' not in data or not isinstance(data['days'], list):
        raise ValueError('Invalid output structure')
    
    for day in data['days']:
        required = ['date', 'dayLabel', 'breakfast', 'lunch', 'dinner']
        if not all(k in day for k in required):
            raise ValueError(f'Missing required fields in day: {day}')
    
    return {'menu': data}
```

---

## まとめ

この仕様書により、以下が確定しました:

1. **現状のデータ構造**: 在庫、レシピ、献立、制約の全てのテーブル構造とサンプルデータ
2. **Dify入力スキーマ**: 必須/任意パラメータ、型、デフォルト値、取得元
3. **Dify出力スキーマ**: レシピID配列形式、保存先、表示箇所
4. **実装手順**: フロント→API→Dify→DB保存の全フロー
5. **環境変数**: 開発/ステージング/本番の全環境設定

次のステップ:
- Dify Workflowの実装
- リトライ/タイムアウトロジックの追加
- 環境変数の設定
- `/planning` ページでのテスト実行
