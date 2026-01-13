"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  DefaultStartDate,
  ProcurementItem,
  ProcurementRequest,
  ProcurementResult,
} from "./types";

type IngredientRow = {
  id: string;
  name: string;
  unit: string;
  storageType: string;
  costPerUnit?: number | null;
};

type LatestPlanRange =
  | {
    startDate: string;
    endDate: string;
    days: number;
    dates: string[];
  }
  | null;

// 最新の献立プラン期間を特定する。
// モデル追加なしの「B案」として MenuPlan の日付と updatedAt を利用する。
// generateMenuPlan 時に古い日付を削除しているため、DB に存在する MenuPlan 群が「最新バッチ」とみなせる前提。
async function getLatestPlanRange(): Promise<LatestPlanRange> {
  const supabase = await createSupabaseServerClient();
  const { data: plans, error } = await supabase
    .from("MenuPlan")
    .select("date")
    .order("updatedAt", { ascending: false });
  if (error || !plans) {
    console.error("Failed to load menu plans", {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });
    return null;
  }
  if (!plans.length) return null;
  const dates = Array.from(new Set(plans.map((p) => p.date))).sort();
  return {
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    days: dates.length,
    dates,
  };
}

export async function loadDefaultStartDate(): Promise<DefaultStartDate> {
  const range = await getLatestPlanRange();
  return {
    startDate: range?.startDate ?? null,
    hasPlans: Boolean(range?.startDate),
    plannedDays: range?.days ?? 0,
  };
}

function formatDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function generateProcurementList(
  input: ProcurementRequest,
): Promise<ProcurementResult> {
  if (!input.startDate || input.startDate.length < 8) {
    return {
      items: [],
      totalCost: 0,
      coverage: {
        requestedDays: 0,
        effectiveDays: 0,
        matchedDays: 0,
        matchedDates: [],
        startDate: null,
        endDate: null,
        crewCount: 20,
        budgetPerPerson: 1200,
      },
    };
  }
  const requestedDays = input.days && input.days > 0 ? input.days : 1;
  const effectiveDays =
    input.effectiveDays && input.effectiveDays > 0
      ? Math.min(input.effectiveDays, requestedDays)
      : requestedDays;

  const start = new Date(input.startDate);
  const end = new Date(start);
  end.setDate(start.getDate() + effectiveDays - 1);

  const startStr = formatDateString(start);
  const endStr = formatDateString(end);

  // Fetch MenuPlans in range with recipes and ingredients
  const supabase = await createSupabaseServerClient();
  const { data: plans, error: plansError } = await supabase
    .from("MenuPlan")
    .select(
      "date,crewCount,budgetPerPerson,recipeLinks:MenuPlanRecipe(recipe:Recipe(ingredients:RecipeIngredient(amount,ingredient:Ingredient(id,name,unit,storageType,costPerUnit))))",
    )
    .gte("date", startStr)
    .lte("date", endStr);
  if (plansError) {
    console.error("Failed to load menu plans", plansError);
    throw plansError;
  }

  // 献立がなければ空リストを返して UI 側でメッセージ表示
  if (!plans.length) {
    return {
      items: [],
      totalCost: 0,
      coverage: {
        requestedDays,
        effectiveDays,
        matchedDays: 0,
        matchedDates: [],
        startDate: input.startDate,
        endDate: endStr,
        crewCount: 20,
        budgetPerPerson: 1200,
      },
    };
  }

  // Aggregate flow:
  // MenuPlan -> Recipe (via recipeLinks) -> Recipe.ingredients -> Ingredient
  // Sum ingredient.amount * crewCount per ingredientId across all recipes in the range.
  const map = new Map<
    string,
    { ingredient: IngredientRow; plannedAmount: number }
  >();

  for (const plan of plans) {
    const crewCount = plan.crewCount || 20; // フォールバック: 20人
    const links = plan.recipeLinks ?? [];
    for (const link of links) {
      const rawRecipe = link.recipe as any;
      const recipe = Array.isArray(rawRecipe) ? rawRecipe[0] : rawRecipe;
      const ingredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
      if (!ingredients.length) continue;
      for (const ri of ingredients) {
        const rawIng = ri.ingredient;
        const ing = Array.isArray(rawIng) ? rawIng[0] : rawIng;
        if (!ing) continue;
        const amountForCrew = ri.amount * crewCount; // 乗船人数を掛ける
        const existing = map.get(ing.id);
        if (existing) {
          existing.plannedAmount += amountForCrew;
        } else {
          map.set(ing.id, { ingredient: ing, plannedAmount: amountForCrew });
        }
      }
    }
  }

  const { data: adjustments, error: adjustmentError } = await supabase
    .from("ProcurementAdjustment")
    .select("*")
    .eq("startDate", startStr)
    .eq("endDate", endStr);
  if (adjustmentError) {
    console.error("Failed to load procurement adjustments", adjustmentError);
    throw adjustmentError;
  }
  const adjustmentMap = new Map<string, typeof adjustments[number]>();
  adjustments?.forEach((adj) => adjustmentMap.set(adj.ingredientId, adj));

  // Remove stale adjustments for ingredients no longer in plan
  const idsInPlan = Array.from(map.keys());
  if (idsInPlan.length === 0) {
    await supabase
      .from("ProcurementAdjustment")
      .delete()
      .eq("startDate", startStr)
      .eq("endDate", endStr);
  } else {
    const notInFilter = `(${idsInPlan.map((id) => `"${id}"`).join(",")})`;
    await supabase
      .from("ProcurementAdjustment")
      .delete()
      .eq("startDate", startStr)
      .eq("endDate", endStr)
      .not("ingredientId", "in", notInFilter);
  }

  // Upsert adjustments for current plan ingredients, updating plannedAmount,
  // and if the user未調整 (orderAmount == previous planned) なら新しい planned に追従。
  const upserts: Array<{
    ingredientId: string;
    startDate: string;
    endDate: string;
    plannedAmount: number;
    orderAmount: number;
    inStock: boolean;
    unitPrice: number;
  }> = [];
  for (const { ingredient, plannedAmount } of map.values()) {
    const existing = adjustmentMap.get(ingredient.id);
    const unitCost = existing?.unitPrice ?? ingredient.costPerUnit ?? 0;
    const orderAmount =
      existing && !existing.inStock && existing.orderAmount !== undefined
        ? existing.orderAmount === existing.plannedAmount
          ? plannedAmount
          : existing.orderAmount
        : plannedAmount;
    const inStock = existing?.inStock ?? false;

    upserts.push({
      ingredientId: ingredient.id,
      startDate: startStr,
      endDate: endStr,
      plannedAmount,
      orderAmount,
      inStock,
      unitPrice: unitCost,
    });
  }

  if (upserts.length > 0) {
    const { error: upsertError } = await supabase
      .from("ProcurementAdjustment")
      .upsert(upserts, { onConflict: "ingredientId,startDate,endDate" });
    if (upsertError) {
      console.error("Failed to upsert procurement adjustments", upsertError);
      throw upsertError;
    }
  }

  const { data: latestAdjustments, error: latestError } = await supabase
    .from("ProcurementAdjustment")
    .select("*")
    .eq("startDate", startStr)
    .eq("endDate", endStr);
  if (latestError) {
    console.error("Failed to load updated procurement adjustments", latestError);
    throw latestError;
  }
  const latestMap = new Map<string, typeof latestAdjustments[number]>();
  latestAdjustments?.forEach((adj) => latestMap.set(adj.ingredientId, adj));

  const items: ProcurementItem[] = [];
  for (const { ingredient } of map.values()) {
    const adj = latestMap.get(ingredient.id)!;
    const subtotal = adj.inStock || adj.orderAmount <= 0 ? 0 : adj.orderAmount * adj.unitPrice;
    items.push({
      ingredientId: ingredient.id,
      name: ingredient.name,
      unit: ingredient.unit,
      storageType: ingredient.storageType as ProcurementItem["storageType"],
      plannedAmount: adj.plannedAmount,
      orderAmount: adj.orderAmount,
      inStock: adj.inStock,
      unitCost: adj.unitPrice,
      subtotal,
    });
  }

  items.sort((a, b) => {
    if (a.storageType === b.storageType) {
      return a.name.localeCompare(b.name, "ja");
    }
    return a.storageType.localeCompare(b.storageType);
  });

  const totalCost = items.reduce((sum, item) => sum + item.subtotal, 0);

  const matchedDates = Array.from(new Set(plans.map((p) => p.date))).sort();

  // 最初のMenuPlanからcrewCountとbudgetPerPersonを取得
  const firstPlan = plans[0];
  const crewCount = firstPlan?.crewCount ?? 20;
  const budgetPerPerson = firstPlan?.budgetPerPerson ?? 1200;

  return {
    items,
    totalCost,
    coverage: {
      requestedDays,
      effectiveDays,
      matchedDays: matchedDates.length,
      matchedDates,
      startDate: startStr,
      endDate: endStr,
      crewCount,
      budgetPerPerson,
    },
  };
}

export async function generateProcurementFromLatest(
  effectiveDays?: number,
): Promise<ProcurementResult> {
  const range = await getLatestPlanRange();
  if (!range) {
    return {
      items: [],
      totalCost: 0,
      coverage: {
        requestedDays: 0,
        effectiveDays: 0,
        matchedDays: 0,
        matchedDates: [],
        startDate: null,
        endDate: null,
        crewCount: 20,
        budgetPerPerson: 1200,
      },
    };
  }
  // 「最新バッチ」期間の MenuPlan を対象に再計算する。
  // effectiveDays が指定されていれば先頭からその日数分だけを集計する。
  return generateProcurementList({
    startDate: range.startDate,
    days: range.days,
    effectiveDays,
  });
}
