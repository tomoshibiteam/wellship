import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const body = await request.json();
    const { id, name, category, calories, protein, salt, costPerServing, draftText } =
      body ?? {};

    if (!id) {
      return NextResponse.json({ error: "idが必要です" }, { status: 400 });
    }

    const nextName = name?.toString().trim();
    const nextCategory = category?.toString().trim();
    const nextCost = Number(costPerServing);

    if (!nextName || !nextCategory || !Number.isFinite(nextCost) || nextCost <= 0) {
      return NextResponse.json(
        { error: "公開にはレシピ名・カテゴリ・原価が必要です" },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: current, error: currentError } = await supabase
      .from("Recipe")
      .select("id,source,status")
      .eq("id", id)
      .eq("companyId", user.companyId)
      .maybeSingle();

    if (currentError || !current) {
      return NextResponse.json({ error: "レシピが見つかりません" }, { status: 404 });
    }
    if (current.source !== "draft" || current.status !== "draft") {
      return NextResponse.json({ error: "Draftのみ公開できます" }, { status: 400 });
    }

    const { data: recipe, error } = await supabase
      .from("Recipe")
      .update({
        name: nextName,
        category: nextCategory,
        calories: Number.isFinite(Number(calories)) ? Number(calories) : null,
        protein: Number.isFinite(Number(protein)) ? Number(protein) : null,
        salt: Number.isFinite(Number(salt)) ? Number(salt) : null,
        costPerServing: nextCost,
        draftText: draftText ?? null,
        source: "my",
        status: "published",
        referenceEnabled: false,
      })
      .eq("id", id)
      .eq("companyId", user.companyId)
      .select(
        "id,name,category,calories,protein,salt,costPerServing,source,status,referenceEnabled,draftText",
      )
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ recipe });
  } catch (error) {
    console.error("Failed to publish recipe", error);
    return NextResponse.json({ error: "公開に失敗しました" }, { status: 500 });
  }
}
