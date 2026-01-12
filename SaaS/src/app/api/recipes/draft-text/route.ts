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
    const draftText = (body?.draftText ?? "").toString().trim();
    const name = body?.name?.toString().trim() || null;

    if (!draftText) {
      return NextResponse.json({ error: "テキストが必要です" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: recipe, error } = await supabase
      .from("Recipe")
      .insert({
        name,
        category: null,
        calories: null,
        protein: null,
        salt: null,
        costPerServing: null,
        source: "draft",
        status: "draft",
        referenceEnabled: false,
        draftText,
        companyId: user.companyId,
      })
      .select(
        "id,name,category,calories,protein,salt,costPerServing,source,status,referenceEnabled,draftText",
      )
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ recipe });
  } catch (error) {
    console.error("Failed to create draft", error);
    return NextResponse.json({ error: "下書きの作成に失敗しました" }, { status: 500 });
  }
}
