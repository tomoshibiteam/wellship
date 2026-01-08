"use server";

import { prisma } from "@/lib/db/prisma";
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

  const menuPlan = await prisma.menuPlan.findFirst({
    where: {
      date: input.date,
      mealType: input.mealType,
    },
    select: { id: true },
  });

  await prisma.mealFeedback.create({
    data: {
      date: input.date,
      mealType: input.mealType,
      satisfaction: input.satisfaction,
      volumeFeeling: input.volumeFeeling,
      leftover: input.leftover,
      comment: null,
      photoUrl: input.photoUrl ?? null,
      reasonTags: input.reasonTags ?? null,
      menuPlanId: menuPlan?.id ?? null,
    },
  });

  return { ok: true };
}
