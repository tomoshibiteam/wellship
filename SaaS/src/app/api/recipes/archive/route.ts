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
    const { id } = body ?? {};
    if (!id) {
      return NextResponse.json({ error: "idが必要です" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: current, error: currentError } = await supabase
      .from("Recipe")
      .select("id,source")
      .eq("id", id)
      .eq("companyId", user.companyId)
      .maybeSingle();
    if (currentError || !current) {
      return NextResponse.json({ error: "レシピが見つかりません" }, { status: 404 });
    }
    if (current.source !== "my") {
      return NextResponse.json({ error: "Myレシピのみアーカイブできます" }, { status: 400 });
    }

    const { data: recipe, error } = await supabase
      .from("Recipe")
      .update({ status: "archived", referenceEnabled: false })
      .eq("id", id)
      .eq("companyId", user.companyId)
      .select(
        "id,name,category,calories,protein,salt,costPerServing,source,status,referenceEnabled",
      )
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ recipe });
  } catch (error) {
    console.error("Failed to archive recipe", error);
    return NextResponse.json({ error: "アーカイブに失敗しました" }, { status: 500 });
  }
}
