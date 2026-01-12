import { NextResponse } from "next/server";
import { MealType } from "@prisma/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
      return NextResponse.json({ error: "リクエスト内容が不正です" }, { status: 400 });
    }

    const id = `plan-${date}-${mealType}`;
    const supabase = await createSupabaseServerClient();
    await supabase.from("MenuPlan").upsert(
      {
        id,
        date,
        mealType,
        healthScore: 0,
      },
      { onConflict: "id" },
    );
    await supabase
      .from("MenuPlanRecipe")
      .delete()
      .eq("menuPlanId", id)
      .eq("recipeId", oldRecipeId);
    await supabase.from("MenuPlanRecipe").insert({
      menuPlanId: id,
      recipeId: newRecipeId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("swap error", error);
    return NextResponse.json({ error: "献立の入れ替えに失敗しました" }, { status: 500 });
  }
}
