"use server";

import { computeHealthScore } from "./health-score";
import { MealType, RecipeCategory, Recipe } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { isGeminiConfigured, generateWithGeminiJSON } from "@/lib/ai/gemini";
import { buildMenuGenerationPrompt, AIGeneratedMenu, validateMenuResponse, fixInvalidRecipeIds } from "@/lib/ai/prompts/menu";
import { getCurrentUser } from "@/lib/auth/session";
import { features } from "@/lib/config/features";
import { DifyMenuGenerator } from "@/lib/ai/providers/dify";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

function buildRecipeMasterJson(recipes: Recipe[]): string {
  const payload = recipes.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    calories: r.calories,
    protein: r.protein,
    salt: r.salt,
    costPerServing: r.costPerServing,
  }));
  return JSON.stringify(payload, null, 1);
}

function normalizeMenuOutput(menu: AIGeneratedMenu, recipes: Recipe[]): AIGeneratedMenu {
  const validIds = new Set(recipes.map((r) => r.id));
  const nameToId = new Map(recipes.map((r) => [r.name, r.id]));
  const recipeMap = new Map(recipes.map((r) => [r.id, { id: r.id, category: r.category }]));

  if (!validateMenuResponse(menu, validIds)) {
    throw new Error("AI response structure invalid");
  }

  const mapIds = (ids: string[]) =>
    ids.map((raw) => (validIds.has(raw) ? raw : nameToId.get(raw) ?? raw));

  const normalized: AIGeneratedMenu = {
    days: menu.days.map((day) => ({
      date: day.date,
      dayLabel: day.dayLabel,
      breakfast: mapIds(day.breakfast),
      lunch: mapIds(day.lunch),
      dinner: mapIds(day.dinner),
    })),
  };

  return fixInvalidRecipeIds(normalized, validIds, recipeMap);
}

function mapMenuToGeneratedDays(menu: AIGeneratedMenu, recipes: Recipe[]): GeneratedDay[] {
  const fullRecipeMap = new Map(recipes.map((r) => [r.id, r]));
  return menu.days.map((day, idx) => {
    const meals: GeneratedDay["meals"] = {
      breakfast: day.breakfast.map((id) => fullRecipeMap.get(id)!).filter(Boolean),
      lunch: day.lunch.map((id) => fullRecipeMap.get(id)!).filter(Boolean),
      dinner: day.dinner.map((id) => fullRecipeMap.get(id)!).filter(Boolean),
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
    const fixedResponse = normalizeMenuOutput(aiResponse, recipes);
    const generated = mapMenuToGeneratedDays(fixedResponse, recipes);

    // 予算オーバーの日を修正 → 期間全体で予算内なら日ごとの変動はOK
    // enforceBudget削除済み - 予算サマリーはUIで表示

    console.log("✅ Menu generated using Gemini AI");
    return generated;
  } catch (error) {
    console.error("Gemini menu generation error:", error);
    return null;
  }
}

// Difyによる献立生成
async function generateMenuWithDify(
  recipes: Recipe[],
  days: number,
  crewCount: number,
  dailyBudget: number,
  minBudgetUsagePercent: number,
  startDate: string,
  constraints?: MenuConstraints
): Promise<GeneratedDay[]> {
  const generator = new DifyMenuGenerator();

  const output = await generator.generate({
    crewCount,
    days,
    budgetPerPersonPerDay: dailyBudget,
    minBudgetUsagePercent,
    startDate,
    season: constraints?.season,
    cookingTimeLimit: constraints?.maxCookingTimeMinutes,
    bannedIngredients: constraints?.excludeIngredients,
    weekdayRules: constraints?.dayRules,
    allowedRecipeIds: [],
    recipes: recipes.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      calories: r.calories,
      protein: r.protein,
      salt: r.salt,
      costPerServing: r.costPerServing,
    })),
  });

  const fixedResponse = normalizeMenuOutput(output as AIGeneratedMenu, recipes);
  return mapMenuToGeneratedDays(fixedResponse, recipes);
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
  const supabase = await createSupabaseServerClient();
  const days = Math.max(1, input.days || 1);
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("認証が必要です。");
  }
  const userId = user?.id;
  const vesselId = user?.vesselIds?.[0]; // 最初の船を対象とする
  if (!vesselId) {
    throw new Error("担当船舶が設定されていません。");
  }

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

  // 会社内レシピ（Published）を取得して、司厨セット（恒久参照） + 会社強制（override）で最終参照を決める
  const { data: allRecipesRaw, error: recipesError } = await supabase
    .from("Recipe")
    .select(
      "id,name,category,calories,protein,salt,costPerServing,source,status,referenceEnabled,ingredients:RecipeIngredient(amount,ingredient:Ingredient(costPerUnit))",
    )
    .eq("companyId", user.companyId)
    .eq("source", "my")
    .eq("status", "published");

  if (recipesError || !allRecipesRaw) {
    throw new Error("レシピの取得に失敗しました。");
  }

  const recipeIds = allRecipesRaw.map((r) => r.id);

  const isMissingTable = (err: unknown) =>
    typeof err === "object" &&
    err !== null &&
    ("code" in err || "message" in err) &&
    // @ts-expect-error - Supabase error shape
    (err.code === "PGRST205" || /Could not find the table/i.test(err.message ?? ""));

  let useLegacyReferenceEnabled = false;

  const { data: chefRefs, error: chefRefError } = await supabase
    .from("ChefRecipeReference")
    .select("recipeId,enabled")
    .eq("userId", user.id)
    .in("recipeId", recipeIds);
  if (chefRefError) {
    if (isMissingTable(chefRefError)) {
      useLegacyReferenceEnabled = true;
    } else {
      throw new Error("司厨セット（参照）の取得に失敗しました。");
    }
  }

  const { data: overrideRefs, error: overrideError } = await supabase
    .from("ChefRecipeReferenceOverride")
    .select("recipeId,enabled")
    .eq("userId", user.id)
    .in("recipeId", recipeIds);
  if (overrideError) {
    if (isMissingTable(overrideError)) {
      useLegacyReferenceEnabled = true;
    } else {
      throw new Error("会社強制（参照）の取得に失敗しました。");
    }
  }

  const chefMap = new Map<string, boolean>(
    (chefRefs ?? []).map((r) => [r.recipeId, Boolean(r.enabled)]),
  );
  const overrideMap = new Map<string, boolean>(
    (overrideRefs ?? []).map((r) => [r.recipeId, Boolean(r.enabled)]),
  );

  // 食材リンクがあるレシピのみをフィルタリングし、食材原価を計算
  const allRecipes = allRecipesRaw
    .filter(recipe => (recipe.ingredients ?? []).length > 0) // 食材リンクがないレシピは除外
    .filter((recipe) => {
      if (useLegacyReferenceEnabled) {
        return Boolean(recipe.referenceEnabled);
      }
      const chefEnabled = chefMap.get(recipe.id) ?? false;
      const overrideEnabled = overrideMap.has(recipe.id)
        ? overrideMap.get(recipe.id) ?? false
        : null;
      const effectiveEnabled =
        overrideEnabled === null ? chefEnabled : overrideEnabled;
      return effectiveEnabled;
    })
    .map((recipe) => {
      if (!recipe.name || !recipe.category) return null;
      const ingredientCost = (recipe.ingredients ?? []).reduce((sum, ri) => {
        const ingredient = Array.isArray(ri.ingredient) ? ri.ingredient[0] : ri.ingredient;
        return sum + (ri.amount * (ingredient?.costPerUnit ?? 0));
      }, 0);
      const now = new Date();
      const mapped: Recipe = {
        id: recipe.id,
        name: recipe.name,
        category: recipe.category as RecipeCategory,
        calories: Number(recipe.calories ?? 0),
        protein: Number(recipe.protein ?? 0),
        salt: Number(recipe.salt ?? 0),
        costPerServing: ingredientCost,
        companyId: user.companyId,
        createdAt: now,
        updatedAt: now,
      };
      return mapped;
    })
    .filter((recipe): recipe is Recipe => Boolean(recipe));

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
  if (targetDates.length > 0) {
    const dateList = targetDates.map((d) => `"${d}"`).join(",");
    await supabase
      .from("MenuPlan")
      .delete()
      .eq("vesselId", vesselId)
      .not("date", "in", `(${dateList})`);
  }

  let generated: GeneratedDay[] | null = null;

  if (features.aiProvider === "dify") {
    try {
      console.log("🚀 Dify献立生成を開始...", { days, crewCount: input.crewCount, budget: input.budget });
      generated = await generateMenuWithDify(
        recipes,
        days,
        input.crewCount,
        input.budget,
        minBudgetUsagePercent,
        startDate,
        input.constraints
      );
      console.log("✅ Dify献立生成完了:", {
        生成日数: generated?.length ?? 0,
        最初の日付: generated?.[0]?.date ?? 'N/A',
        最後の日付: generated?.[generated.length - 1]?.date ?? 'N/A',
      });
    } catch (error) {
      console.error("❌ Dify menu generation error:", error);
      throw new Error("Dify献立生成に失敗しました。");
    }
  } else {
    // まずGemini生成を試み、失敗したらフォールバック
    generated = await generateMenuWithAI(
      recipes,
      days,
      input.crewCount,
      input.budget,
      minBudgetUsagePercent,
      input.policy,
      startDate,
      input.constraints
    );

    if (!generated) {
      generated = generateMenuFallback(recipes, days, input.policy, input.budget);
    }
  }

  if (!generated) {
    throw new Error("献立生成に失敗しました。");
  }

  // 期間全体の予算を強制（超過している場合は高コストレシピを差し替え）
  const totalBudget = input.budget * days;
  generated = enforceTotalBudget(generated, recipes, totalBudget);

  // DBに保存
  for (const day of generated) {
    for (const mealType of mealOrder) {
      const recipesForMeal = day.meals[mealType];
      const id = `plan-${day.date}-${mealType}`;
      await supabase.from("MenuPlan").upsert(
        {
          id,
          date: day.date,
          mealType,
          healthScore: day.healthScore,
          crewCount: input.crewCount,
          budgetPerPerson: input.budget,
          vesselId,
        },
        { onConflict: "id" },
      );

      await supabase.from("MenuPlanRecipe").delete().eq("menuPlanId", id);
      if (recipesForMeal.length > 0) {
        await supabase.from("MenuPlanRecipe").insert(
          recipesForMeal.map((r) => ({
            menuPlanId: id,
            recipeId: r.id,
          })),
        );
      }
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
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("認証が必要です。");
  }
  const vesselId = user.vesselIds?.[0];
  if (!vesselId) {
    throw new Error("担当船舶が設定されていません。");
  }
  const supabase = await createSupabaseServerClient();
  const id = `plan-${params.date}-${params.mealType}`;

  await supabase.from("MenuPlan").upsert(
    {
      id,
      date: params.date,
      mealType: params.mealType,
      healthScore: 0,
      vesselId,
    },
    { onConflict: "id" },
  );

  await supabase
    .from("MenuPlanRecipe")
    .delete()
    .eq("menuPlanId", id)
    .eq("recipeId", params.oldRecipeId);

  await supabase.from("MenuPlanRecipe").insert({
    menuPlanId: id,
    recipeId: params.newRecipeId,
  });

  revalidatePath("/planning");
}

export async function loadExistingPlan(days: number = 30): Promise<GeneratedDay[] | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const vesselId = user.vesselIds?.[0];
  if (!vesselId) return null;
  const supabase = await createSupabaseServerClient();
  const { data: plans, error } = await supabase
    .from("MenuPlan")
    .select(
      "id,date,mealType,healthScore,recipeLinks:MenuPlanRecipe(recipe:Recipe(id,name,category,calories,protein,salt,costPerServing,ingredients:RecipeIngredient(amount,ingredient:Ingredient(costPerUnit))))",
    )
    .eq("vesselId", vesselId)
    .order("date", { ascending: true })
    .order("mealType", { ascending: true });

  if (error || !plans || plans.length === 0) return null;

  // レシピの食材原価を計算する関数
  const calcIngredientCost = (recipe: any) => {
    const list = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
    return list.reduce((sum: number, ri: any) => {
      const ingredient = Array.isArray(ri?.ingredient) ? ri.ingredient[0] : ri.ingredient;
      const amount = Number(ri?.amount ?? 0);
      const costPerUnit = Number(ingredient?.costPerUnit ?? 0);
      return sum + amount * costPerUnit;
    }, 0);
  };

  const grouped = new Map<string, { date: string; meals: Partial<Record<MealType, Recipe[]>> }>();
  for (const plan of plans) {
    const key = plan.date;
    if (!grouped.has(key)) grouped.set(key, { date: plan.date, meals: {} });
    const entry = grouped.get(key)!;
    const mealType = plan.mealType as MealType;
    // 食材原価を計算してcostPerServingに設定（食材データがなければ既存値を使用）
    const recipeLinks = plan.recipeLinks || [];
    entry.meals[mealType] = recipeLinks
      .map((rl) => rl.recipe)
      .filter(Boolean)
      .map((recipe) => {
        const resolved = Array.isArray(recipe) ? recipe[0] : recipe;
        if (!resolved) return null;
        const ingredientCost = calcIngredientCost(resolved);
        const now = new Date();
        return {
          id: resolved.id,
          name: resolved.name,
          category: resolved.category as RecipeCategory,
          calories: Number(resolved.calories ?? 0),
          protein: Number(resolved.protein ?? 0),
          salt: Number(resolved.salt ?? 0),
          costPerServing: ingredientCost > 0 ? ingredientCost : resolved.costPerServing,
          companyId: null,
          createdAt: now,
          updatedAt: now,
        } as Recipe;
      })
      .filter((r): r is Recipe => Boolean(r));
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
  const user = await getCurrentUser();
  if (!user) return null;
  const vesselId = user.vesselIds?.[0];
  if (!vesselId) return null;
  const supabase = await createSupabaseServerClient();
  const { data: dates, error } = await supabase
    .from("MenuPlan")
    .select("date")
    .eq("vesselId", vesselId)
    .order("date", { ascending: true });

  if (error || !dates) return null;

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
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("認証が必要です。");
  }
  const vesselId = user.vesselIds?.[0];
  if (!vesselId) {
    throw new Error("担当船舶が設定されていません。");
  }
  const range = await getLatestPlanRange();
  if (!range) {
    throw new Error("短縮できる献立が存在しません。まず献立を生成してください。");
  }

  const targetDates = range.dates.slice(0, Math.min(effectiveDays, range.days));
  const supabase = await createSupabaseServerClient();
  const dateList = targetDates.map((d) => `"${d}"`).join(",");
  await supabase
    .from("MenuPlan")
    .delete()
    .eq("vesselId", vesselId)
    .not("date", "in", `(${dateList})`);

  // 削除後の最新状態を再読込して返す
  return loadExistingPlan(targetDates.length);
}
