"use server";

import { prisma } from "@/lib/db/prisma";
import { computeHealthScore } from "./health-score";
import { MealType, RecipeCategory, Recipe } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { isGeminiConfigured, generateWithGeminiJSON } from "@/lib/ai/gemini";
import { buildMenuGenerationPrompt, AIGeneratedMenu, validateMenuResponse, fixInvalidRecipeIds } from "@/lib/ai/prompts/menu";
import { getCurrentUser } from "@/lib/auth/session";

export type NutritionPolicy = "バランス重視" | "高たんぱく" | "塩分控えめ" | "ボリューム重視";

export type MenuConstraints = {
  excludeIngredients?: string[];
  season?: 'spring' | 'summer' | 'autumn' | 'winter';
  dailyBudgetMax?: number;
  dayRules?: {
    monday?: string;
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
  };
  maxCookingTimeMinutes?: number;
};

export type GenerateRequest = {
  crewCount: number;
  days: number;
  budget: number;
  policy: NutritionPolicy;
  constraints?: MenuConstraints;
};

export type GeneratedDay = {
  day: number;
  date: string;
  dayLabel: string;
  meals: {
    breakfast: Recipe[];
    lunch: Recipe[];
    dinner: Recipe[];
  };
  totals: {
    calories: number;
    protein: number;
    salt: number;
    cost: number; // 1人1日あたりのコスト（円）
  };
  healthScore: number;
};

const mealOrder: MealType[] = [MealType.breakfast, MealType.lunch, MealType.dinner];

function formatDate(base: Date, offsetDays: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function pickByPolicy(list: Recipe[], policy: NutritionPolicy): Recipe[] {
  if (policy === "高たんぱく") return list.filter((r) => r.protein >= 30) || list;
  if (policy === "塩分控えめ") return list.filter((r) => r.salt <= 2.3) || list;
  if (policy === "ボリューム重視") return list.filter((r) => r.calories >= 700) || list;
  return list;
}

function rotatePick(list: Recipe[], index: number, avoidId?: string) {
  if (!list.length) return undefined;
  const filtered = avoidId ? list.filter((r) => r.id !== avoidId) : list;
  const source = filtered.length ? filtered : list;
  return source[index % source.length];
}

// ポリシーを栄養目標値に変換
function policyToTargets(policy: NutritionPolicy) {
  switch (policy) {
    case "高たんぱく":
      return { dailyCalorieTarget: 2400, dailyProteinTarget: 100, dailySaltMax: 8 };
    case "塩分控えめ":
      return { dailyCalorieTarget: 2000, dailyProteinTarget: 65, dailySaltMax: 6 };
    case "ボリューム重視":
      return { dailyCalorieTarget: 2800, dailyProteinTarget: 80, dailySaltMax: 10 };
    default: // バランス重視
      return { dailyCalorieTarget: 2200, dailyProteinTarget: 70, dailySaltMax: 8 };
  }
}

// AIによる献立生成
async function generateMenuWithAI(
  recipes: Recipe[],
  days: number,
  crewCount: number,
  dailyBudget: number,
  minBudgetUsagePercent: number,
  policy: NutritionPolicy,
  startDate: string,
  constraints?: MenuConstraints
): Promise<GeneratedDay[] | null> {
  if (!isGeminiConfigured()) {
    console.log("Gemini API not configured, using fallback");
    return null;
  }

  try {
    const prompt = buildMenuGenerationPrompt({
      recipes: recipes.map(r => ({
        id: r.id,
        name: r.name,
        category: r.category,
        calories: r.calories,
        protein: r.protein,
        salt: r.salt,
        costPerServing: r.costPerServing,
      })),
      days,
      crewCount,
      dailyBudget,
      minBudgetUsagePercent,
      policy: policyToTargets(policy),
      startDate,
      constraints,
    });

    const aiResponse = await generateWithGeminiJSON<AIGeneratedMenu>(prompt);

    // レシピIDの検証
    const validIds = new Set(recipes.map(r => r.id));
    if (!validateMenuResponse(aiResponse, validIds)) {
      console.warn("AI response structure invalid, using fallback");
      return null;
    }

    // 無効なレシピIDを自動修正
    const recipeMap = new Map(recipes.map(r => [r.id, { id: r.id, category: r.category }]));
    const fixedResponse = fixInvalidRecipeIds(aiResponse, validIds, recipeMap);

    // AIレスポンスをGeneratedDay形式に変換
    const fullRecipeMap = new Map(recipes.map(r => [r.id, r]));
    const generated: GeneratedDay[] = fixedResponse.days.map((day, idx) => {
      const meals: GeneratedDay["meals"] = {
        breakfast: day.breakfast.map(id => fullRecipeMap.get(id)!).filter(Boolean),
        lunch: day.lunch.map(id => fullRecipeMap.get(id)!).filter(Boolean),
        dinner: day.dinner.map(id => fullRecipeMap.get(id)!).filter(Boolean),
      };

      const totals = Object.values(meals).flat().reduce(
        (acc, r) => {
          acc.calories += r.calories;
          acc.protein += r.protein;
          acc.salt += r.salt;
          acc.cost += r.costPerServing;
          return acc;
        },
        { calories: 0, protein: 0, salt: 0, cost: 0 }
      );

      const healthScore = computeHealthScore(totals.calories, totals.protein, totals.salt);

      return {
        day: idx + 1,
        date: day.date,
        dayLabel: day.dayLabel,
        meals,
        totals,
        healthScore,
      };
    });

    // 予算オーバーの日を修正 → 期間全体で予算内なら日ごとの変動はOK
    // enforceBudget削除済み - 予算サマリーはUIで表示

    console.log("✅ Menu generated using Gemini AI");
    return generated;
  } catch (error) {
    console.error("Gemini menu generation error:", error);
    return null;
  }
}

// 期間全体の予算を最低〜最大の範囲に収める
function enforceTotalBudget(
  plan: GeneratedDay[],
  allRecipes: Recipe[],
  maxBudget: number,
  minBudgetPercent: number = 90
): GeneratedDay[] {
  const totalCost = plan.reduce((sum, day) => sum + day.totals.cost, 0);
  const minBudget = Math.floor(maxBudget * minBudgetPercent / 100);

  // 範囲内ならそのまま
  if (totalCost >= minBudget && totalCost <= maxBudget) {
    return plan;
  }

  const recipesByCategory = {
    main: allRecipes.filter(r => r.category === RecipeCategory.main).sort((a, b) => a.costPerServing - b.costPerServing),
    side: allRecipes.filter(r => r.category === RecipeCategory.side).sort((a, b) => a.costPerServing - b.costPerServing),
    soup: allRecipes.filter(r => r.category === RecipeCategory.soup).sort((a, b) => a.costPerServing - b.costPerServing),
    dessert: allRecipes.filter(r => r.category === RecipeCategory.dessert).sort((a, b) => a.costPerServing - b.costPerServing),
  };

  // 全日のレシピを集める
  const allMealRecipes: { dayIdx: number; mealKey: 'breakfast' | 'lunch' | 'dinner'; recipeIdx: number; recipe: Recipe }[] = [];
  plan.forEach((day, dayIdx) => {
    (['breakfast', 'lunch', 'dinner'] as const).forEach(mealKey => {
      day.meals[mealKey].forEach((recipe, recipeIdx) => {
        allMealRecipes.push({ dayIdx, mealKey, recipeIdx, recipe });
      });
    });
  });

  // プランをコピー
  const newPlan = plan.map(day => ({
    ...day,
    meals: {
      breakfast: [...day.meals.breakfast],
      lunch: [...day.meals.lunch],
      dinner: [...day.meals.dinner],
    },
  }));

  let currentTotal = totalCost;
  const usedRecipeIds = new Set<string>();
  plan.forEach(day => {
    Object.values(day.meals).flat().forEach(r => usedRecipeIds.add(r.id));
  });

  if (totalCost > maxBudget) {
    // 予算超過 → 高コストレシピを安いものに差し替え
    console.log(`⚠️ 予算超過を修正中: ¥${totalCost} -> ¥${maxBudget}`);
    allMealRecipes.sort((a, b) => b.recipe.costPerServing - a.recipe.costPerServing);

    for (const { dayIdx, mealKey, recipeIdx, recipe } of allMealRecipes) {
      if (currentTotal <= maxBudget) break;

      const category = recipe.category as keyof typeof recipesByCategory;
      const cheaper = recipesByCategory[category]?.find(r =>
        r.costPerServing < recipe.costPerServing &&
        !usedRecipeIds.has(r.id)
      );

      if (cheaper) {
        const savings = recipe.costPerServing - cheaper.costPerServing;
        newPlan[dayIdx].meals[mealKey][recipeIdx] = cheaper;
        usedRecipeIds.add(cheaper.id);
        currentTotal -= savings;
      }
    }
  } else if (totalCost < minBudget) {
    // 予算不足 → 安いレシピを高いものに差し替え
    console.log(`⚠️ 予算不足を修正中: ¥${totalCost} -> ¥${minBudget}`);
    allMealRecipes.sort((a, b) => a.recipe.costPerServing - b.recipe.costPerServing);

    for (const { dayIdx, mealKey, recipeIdx, recipe } of allMealRecipes) {
      if (currentTotal >= minBudget) break;

      const category = recipe.category as keyof typeof recipesByCategory;
      // より高価なレシピを探す（コスト高い順）
      const moreExpensive = [...(recipesByCategory[category] || [])]
        .reverse()
        .find(r =>
          r.costPerServing > recipe.costPerServing &&
          !usedRecipeIds.has(r.id) &&
          (currentTotal + (r.costPerServing - recipe.costPerServing)) <= maxBudget
        );

      if (moreExpensive) {
        const increase = moreExpensive.costPerServing - recipe.costPerServing;
        newPlan[dayIdx].meals[mealKey][recipeIdx] = moreExpensive;
        usedRecipeIds.add(moreExpensive.id);
        currentTotal += increase;
      }
    }
  }

  // totals再計算
  return newPlan.map(day => {
    const newTotals = Object.values(day.meals).flat().reduce(
      (acc, r) => {
        acc.calories += r.calories;
        acc.protein += r.protein;
        acc.salt += r.salt;
        acc.cost += r.costPerServing;
        return acc;
      },
      { calories: 0, protein: 0, salt: 0, cost: 0 }
    );

    return {
      ...day,
      totals: newTotals,
      healthScore: computeHealthScore(newTotals.calories, newTotals.protein, newTotals.salt),
    };
  });
}

// ルールベースのフォールバック生成（予算制約付き）
function generateMenuFallback(
  recipes: Recipe[],
  days: number,
  policy: NutritionPolicy,
  dailyBudget: number = 1200 // 1人1日あたりの予算
): GeneratedDay[] {
  // コストの低い順にソートしたカテゴリ別レシピ
  const mains = recipes.filter((r) => r.category === RecipeCategory.main)
    .sort((a, b) => a.costPerServing - b.costPerServing);
  const sides = recipes.filter((r) => r.category === RecipeCategory.side)
    .sort((a, b) => a.costPerServing - b.costPerServing);
  const soups = recipes.filter((r) => r.category === RecipeCategory.soup)
    .sort((a, b) => a.costPerServing - b.costPerServing);

  const filteredMains = pickByPolicy(mains, policy);
  const generated: GeneratedDay[] = [];
  const baseDate = new Date();
  let lastMainId: string | undefined;

  for (let dayIdx = 0; dayIdx < days; dayIdx += 1) {
    const date = formatDate(baseDate, dayIdx);
    const dayLabel = `${dayIdx + 1}日目`;

    const dayMeals: GeneratedDay["meals"] = {
      breakfast: [],
      lunch: [],
      dinner: [],
    };

    let remainingBudget = dailyBudget;

    // 各食事に予算配分（朝:20%, 昼:35%, 夕:45%）
    const budgetAllocation = {
      [MealType.breakfast]: dailyBudget * 0.20,
      [MealType.lunch]: dailyBudget * 0.35,
      [MealType.dinner]: dailyBudget * 0.45,
    };

    mealOrder.forEach((mealType, mealIdx) => {
      const mealBudget = budgetAllocation[mealType];
      let mealCost = 0;
      const mealRecipes: Recipe[] = [];

      // 主菜を選択（予算内で）
      const affordableMains = filteredMains.filter(r => r.costPerServing <= mealBudget * 0.6 && r.id !== lastMainId);
      const main = affordableMains[dayIdx % affordableMains.length] ?? filteredMains.find(r => r.id !== lastMainId) ?? filteredMains[0];
      if (main) {
        mealRecipes.push(main);
        mealCost += main.costPerServing;
        lastMainId = main.id;
      }

      // 副菜を追加（残り予算内で）
      const sideCount = mealType === MealType.lunch || mealType === MealType.dinner ? 2 : 1;
      for (let i = 0; i < sideCount; i += 1) {
        const remainingMealBudget = mealBudget - mealCost;
        const affordableSides = sides.filter(r => r.costPerServing <= remainingMealBudget && !mealRecipes.includes(r));
        const pick = affordableSides[(dayIdx + mealIdx + i) % affordableSides.length];
        if (pick) {
          mealRecipes.push(pick);
          mealCost += pick.costPerServing;
        }
      }

      // 汁物を追加（残り予算内で）
      const remainingForSoup = mealBudget - mealCost;
      const affordableSoups = soups.filter(r => r.costPerServing <= remainingForSoup);
      const soup = affordableSoups[(dayIdx + mealIdx) % affordableSoups.length] ?? soups[0];
      if (soup && mealCost + soup.costPerServing <= mealBudget + 50) { // 少しの余裕を持たせる
        mealRecipes.push(soup);
      }

      dayMeals[mealType] = mealRecipes;
    });

    const totals = Object.values(dayMeals).flat().reduce(
      (acc, r) => {
        acc.calories += r.calories;
        acc.protein += r.protein;
        acc.salt += r.salt;
        acc.cost += r.costPerServing;
        return acc;
      },
      { calories: 0, protein: 0, salt: 0, cost: 0 }
    );

    const healthScore = computeHealthScore(totals.calories, totals.protein, totals.salt);

    generated.push({
      day: dayIdx + 1,
      date,
      dayLabel,
      meals: dayMeals,
      totals,
      healthScore,
    });
  }

  console.log("⚙️ Menu generated using rule-based fallback");
  return generated;
}

export async function generateMenuPlan(input: GenerateRequest): Promise<GeneratedDay[]> {
  const days = Math.max(1, input.days || 1);
  const user = await getCurrentUser();
  const userId = user?.id;
  const vesselId = user?.vesselIds?.[0]; // 最初の船を対象とする

  // 除外レシピIDを取得 - 一時的に無効化
  const excludeIds: string[] = [];
  // TODO: RecipeExclusionモデルの型エラーを修正後に復活
  // if (userId) {
  //   const exclusions = await prisma.recipeExclusion.findMany({
  //     where: {
  //       OR: [
  //         { userId, scope: ExclusionScope.CHEF },
  //         vesselId ? { vesselId, scope: ExclusionScope.VESSEL } : {},
  //       ].filter(obj => Object.keys(obj).length > 0),
  //     },
  //     select: { recipeId: true },
  //   });
  //   excludeIds = exclusions.map(e => e.recipeId);
  // }

  // レシピと食材情報を取得して食材原価を計算
  const allRecipesRaw = await prisma.recipe.findMany({
    include: {
      ingredients: {
        include: {
          ingredient: true,
        },
      },
    },
  });

  // 食材リンクがあるレシピのみをフィルタリングし、食材原価を計算
  const allRecipes = allRecipesRaw
    .filter(recipe => recipe.ingredients.length > 0) // 食材リンクがないレシピは除外
    .map(recipe => {
      const ingredientCost = recipe.ingredients.reduce((sum, ri) => {
        return sum + (ri.amount * ri.ingredient.costPerUnit);
      }, 0);
      return {
        ...recipe,
        costPerServing: ingredientCost, // 食材原価を使用
        ingredients: undefined, // 不要なデータを除去
      } as Recipe;
    });

  console.log(`📊 食材リンクありのレシピ数: ${allRecipes.length}件（全${allRecipesRaw.length}件）`);

  // 除外対象以外を利用可能にする
  const recipes = excludeIds.length > 0
    ? allRecipes.filter(r => !excludeIds.includes(r.id))
    : allRecipes;

  const mains = recipes.filter((r) => r.category === RecipeCategory.main);
  const sides = recipes.filter((r) => r.category === RecipeCategory.side);
  const soups = recipes.filter((r) => r.category === RecipeCategory.soup);

  if (!mains.length || !sides.length || !soups.length) {
    throw new Error("レシピが不足しています（main/side/soup のデータを確認してください）");
  }

  // 船舶の予算消化率設定を取得（デフォルト90%）
  // Note: minBudgetUsagePercentはDBに追加済みだが、Prisma Clientの再生成が必要
  const minBudgetUsagePercent = 90;

  const baseDate = new Date();
  const startDate = formatDate(baseDate, 0);
  const targetDates = Array.from({ length: days }, (_v, idx) => formatDate(baseDate, idx));

  // 古い献立を削除
  await prisma.menuPlan.deleteMany({
    where: {
      date: { notIn: targetDates },
    },
  });

  // まずAI生成を試み、失敗したらフォールバック
  let generated = await generateMenuWithAI(recipes, days, input.crewCount, input.budget, minBudgetUsagePercent, input.policy, startDate);

  if (!generated) {
    generated = generateMenuFallback(recipes, days, input.policy, input.budget);
  }

  // 期間全体の予算を強制（超過している場合は高コストレシピを差し替え）
  const totalBudget = input.budget * days;
  generated = enforceTotalBudget(generated, recipes, totalBudget);

  // DBに保存
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
            create: recipesForMeal.map((r) => ({ recipeId: r.id })),
          },
        },
        create: {
          id,
          date: day.date,
          mealType,
          healthScore: day.healthScore,
          crewCount: input.crewCount,
          budgetPerPerson: input.budget,
          recipeLinks: {
            create: recipesForMeal.map((r) => ({ recipeId: r.id })),
          },
        },
      });
    }
  }

  return generated;
}

export async function swapMenuRecipe(params: {
  date: string;
  mealType: MealType;
  oldRecipeId: string;
  newRecipeId: string;
}) {
  const id = `plan-${params.date}-${params.mealType}`;

  await prisma.menuPlan.upsert({
    where: { id },
    update: {
      date: params.date,
      mealType: params.mealType,
      recipeLinks: {
        deleteMany: { recipeId: params.oldRecipeId },
        create: [{ recipeId: params.newRecipeId }],
      },
    },
    create: {
      id,
      date: params.date,
      mealType: params.mealType,
      healthScore: 0,
      recipeLinks: {
        create: [{ recipeId: params.newRecipeId }],
      },
    },
  });

  revalidatePath("/planning");
}

export async function loadExistingPlan(days: number = 30): Promise<GeneratedDay[] | null> {
  const plans = await prisma.menuPlan.findMany({
    include: {
      recipeLinks: {
        include: {
          recipe: {
            include: {
              ingredients: {
                include: {
                  ingredient: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ date: "asc" }, { mealType: "asc" }],
  });

  if (!plans.length) return null;

  // レシピの食材原価を計算する関数
  const calcIngredientCost = (recipe: { ingredients: { amount: number; ingredient: { costPerUnit: number } }[] }) => {
    return recipe.ingredients.reduce((sum, ri) => sum + (ri.amount * ri.ingredient.costPerUnit), 0);
  };

  const grouped = new Map<string, { date: string; meals: Partial<Record<MealType, Recipe[]>> }>();
  for (const plan of plans) {
    const key = plan.date;
    if (!grouped.has(key)) grouped.set(key, { date: plan.date, meals: {} });
    const entry = grouped.get(key)!;
    // 食材原価を計算してcostPerServingに設定（食材データがなければ既存値を使用）
    entry.meals[plan.mealType] = plan.recipeLinks.map((rl) => {
      const ingredientCost = calcIngredientCost(rl.recipe);
      return {
        ...rl.recipe,
        costPerServing: ingredientCost > 0 ? ingredientCost : rl.recipe.costPerServing,
        ingredients: undefined, // 不要なデータを除去
      } as Recipe;
    });
  }

  const sortedDates = Array.from(grouped.keys()).sort();
  const completeDates: string[] = [];
  for (const date of sortedDates) {
    const entry = grouped.get(date)!;
    const hasAllMeals =
      entry.meals[MealType.breakfast]?.length &&
      entry.meals[MealType.lunch]?.length &&
      entry.meals[MealType.dinner]?.length;
    if (hasAllMeals) completeDates.push(date);
  }

  if (!completeDates.length) return null;

  const selectedDates = completeDates.slice(0, days);

  const generated: GeneratedDay[] = selectedDates.map((date, idx) => {
    const data = grouped.get(date)!;
    const meals: GeneratedDay["meals"] = {
      breakfast: data.meals[MealType.breakfast] ?? [],
      lunch: data.meals[MealType.lunch] ?? [],
      dinner: data.meals[MealType.dinner] ?? [],
    };
    const totals = Object.values(meals).flat().reduce(
      (acc, r) => {
        acc.calories += r.calories;
        acc.protein += r.protein;
        acc.salt += r.salt;
        acc.cost += r.costPerServing;
        return acc;
      },
      { calories: 0, protein: 0, salt: 0, cost: 0 }
    );
    const healthScore = computeHealthScore(totals.calories, totals.protein, totals.salt);
    return {
      day: idx + 1,
      date,
      dayLabel: `${idx + 1}日目`,
      meals,
      totals,
      healthScore,
    };
  });

  return generated.length ? generated : null;
}

// 最新の献立日付範囲を取得するユーティリティ。
export async function getLatestPlanRange() {
  const dates = await prisma.menuPlan.findMany({
    select: { date: true },
    orderBy: { date: "asc" },
  });
  const uniqueDates = Array.from(new Set(dates.map((d) => d.date))).sort();
  if (!uniqueDates.length) return null;
  return {
    dates: uniqueDates,
    startDate: uniqueDates[0],
    endDate: uniqueDates[uniqueDates.length - 1],
    days: uniqueDates.length,
  };
}

// 献立の内容はそのままに「日数だけ短縮」する。
// 先頭の日付から effectiveDays 日分だけ残し、それ以降の MenuPlan は削除する。
export async function trimMenuPlanDays(effectiveDays: number): Promise<GeneratedDay[] | null> {
  if (!effectiveDays || effectiveDays < 1) {
    throw new Error("日数は1以上を指定してください。");
  }
  const range = await getLatestPlanRange();
  if (!range) {
    throw new Error("短縮できる献立が存在しません。まず献立を生成してください。");
  }

  const targetDates = range.dates.slice(0, Math.min(effectiveDays, range.days));
  await prisma.menuPlan.deleteMany({
    where: {
      date: { notIn: targetDates },
    },
  });

  // 削除後の最新状態を再読込して返す
  return loadExistingPlan(targetDates.length);
}
