import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { MealType } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, mealType, oldRecipeId, newRecipeId } = body as {
      date: string;
      mealType: MealType;
      oldRecipeId: string;
      newRecipeId: string;
    };

    if (!date || !mealType || !oldRecipeId || !newRecipeId) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const id = `plan-${date}-${mealType}`;
    await prisma.menuPlan.upsert({
      where: { id },
      update: {
        recipeLinks: {
          deleteMany: { recipeId: oldRecipeId },
          create: [{ recipeId: newRecipeId }],
        },
      },
      create: {
        id,
        date,
        mealType,
        healthScore: 0,
        recipeLinks: {
          create: [{ recipeId: newRecipeId }],
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("swap error", error);
    return NextResponse.json({ error: "Failed to swap" }, { status: 500 });
  }
}
