import { prisma } from "@/lib/db/prisma";
import { MealFeedback } from "@/lib/types";

export async function getAllMealFeedback(): Promise<MealFeedback[]> {
  const feedbacks = await prisma.mealFeedback.findMany({
    orderBy: [
      { date: "desc" },
      { mealType: "desc" },
    ],
  });

  return feedbacks.map((fb) => ({
    id: fb.id,
    date: fb.date,
    mealType: fb.mealType,
    menuPlanId: fb.menuPlanId,
    satisfaction: fb.satisfaction as MealFeedback["satisfaction"],
    volumeFeeling: fb.volumeFeeling,
    leftover: fb.leftover,
    comment: fb.comment ?? undefined,
  }));
}
