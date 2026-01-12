import { MealFeedback } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAllMealFeedback(): Promise<MealFeedback[]> {
  const supabase = await createSupabaseServerClient();
  const { data: feedbacks, error } = await supabase
    .from("MealFeedback")
    .select("id,date,mealType,menuPlanId,satisfaction,volumeFeeling,leftover,comment")
    .order("date", { ascending: false })
    .order("mealType", { ascending: false });

  if (error || !feedbacks) {
    console.error("Failed to load feedbacks", error);
    return [];
  }

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
