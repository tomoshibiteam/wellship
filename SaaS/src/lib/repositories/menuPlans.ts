import { MenuPlan } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAllMenuPlans(): Promise<MenuPlan[]> {
  const supabase = await createSupabaseServerClient();
  const { data: plans, error } = await supabase
    .from("MenuPlan")
    .select("id,date,mealType,healthScore,recipeLinks:MenuPlanRecipe(recipeId)")
    .order("date", { ascending: true })
    .order("mealType", { ascending: true });

  if (error || !plans) {
    console.error("Failed to load menu plans", error);
    return [];
  }

  return plans.map((plan) => ({
    id: plan.id,
    date: plan.date,
    mealType: plan.mealType,
    healthScore: plan.healthScore,
    recipeIds: (plan.recipeLinks || []).map((link) => link.recipeId),
  }));
}
