"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MealType } from "@prisma/client";

export type FeedbackInput = {
  date: string;
  mealType: MealType;
  satisfaction: number; // 1-4
  volumeFeeling: "less" | "just" | "much";
  leftover: "none" | "half" | "almostAll";
  photoUrl?: string | null;
  reasonTags?: string | null; // JSON array string
};

export async function createFeedback(input: FeedbackInput) {
  if (!input.date || !input.mealType || !input.satisfaction || !input.volumeFeeling || !input.leftover) {
    throw new Error("入力が不足しています。すべての項目を選択してください。");
  }

  const supabase = await createSupabaseServerClient();
  const { data: menuPlan, error: menuPlanError } = await supabase
    .from("MenuPlan")
    .select("id")
    .eq("date", input.date)
    .eq("mealType", input.mealType)
    .maybeSingle();

  if (menuPlanError) {
    console.error("Failed to fetch menu plan", menuPlanError);
  }

  const { error } = await supabase.from("MealFeedback").insert({
    date: input.date,
    mealType: input.mealType,
    satisfaction: input.satisfaction,
    volumeFeeling: input.volumeFeeling,
    leftover: input.leftover,
    comment: null,
    photoUrl: input.photoUrl ?? null,
    reasonTags: input.reasonTags ?? null,
    menuPlanId: menuPlan?.id ?? null,
  });

  if (error) {
    console.error("Failed to create feedback", error);
    throw new Error("フィードバックの保存に失敗しました。");
  }

  return { ok: true };
}
