import { prisma } from "@/lib/db/prisma";
import { MenuPlan } from "@/lib/types";

export async function getAllMenuPlans(): Promise<MenuPlan[]> {
  const plans = await prisma.menuPlan.findMany({
    include: {
      recipeLinks: true,
    },
    orderBy: [
      { date: "asc" },
      { mealType: "asc" },
    ],
  });

  return plans.map((plan) => ({
    id: plan.id,
    date: plan.date,
    mealType: plan.mealType,
    healthScore: plan.healthScore,
    recipeIds: plan.recipeLinks.map((link) => link.recipeId),
  }));
}
