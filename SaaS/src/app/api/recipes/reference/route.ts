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
    const { id, enabled, mode, targetUserId, reason } = body ?? {};
    const isOverride = mode === "override";
    const isChefLayer = mode === "chef" || !mode;

    if (!id) {
      return NextResponse.json({ error: "idが必要です" }, { status: 400 });
    }
    if (isOverride) {
      if (
        enabled !== null &&
        enabled !== undefined &&
        typeof enabled !== "boolean"
      ) {
        return NextResponse.json(
          { error: "会社強制の更新は enabled（boolean）または null（解除）が必要です" },
          { status: 400 },
        );
      }
    } else {
      if (typeof enabled !== "boolean") {
        return NextResponse.json({ error: "司厨の参照更新は enabled（boolean）が必要です" }, { status: 400 });
      }
    }

    const targetId: string =
      (user.role === "MANAGER" && targetUserId ? String(targetUserId) : user.id);

    if (user.role === "MANAGER" && (!reason || !String(reason).trim())) {
      return NextResponse.json({ error: "変更理由（短文）が必要です" }, { status: 400 });
    }
    if (isOverride && user.role !== "MANAGER") {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const supabase = await createSupabaseServerClient();

    const isMissingTable = (err: unknown) =>
      typeof err === "object" &&
      err !== null &&
      ("code" in err || "message" in err) &&
      // @ts-expect-error - Supabase error shape
      (err.code === "PGRST205" || /Could not find the table/i.test(err.message ?? ""));

    // 参照設定テーブルが未作成の場合は、先に明確なエラーを返す（マイグレーション未適用対策）
    {
      const { error: checkError } = await supabase
        .from("ChefRecipeReference")
        .select("recipeId")
        .limit(1);
      if (checkError && isMissingTable(checkError)) {
        return NextResponse.json(
          {
            error:
              "参照設定用テーブルが未作成です。Supabaseに `SaaS/supabase/migrations/phase2_chef_reference.sql` を適用してください。",
          },
          { status: 500 },
        );
      }
    }
    const { data: targetChef, error: targetChefError } = await supabase
      .from("User")
      .select("id,companyId,role")
      .eq("id", targetId)
      .eq("companyId", user.companyId)
      .maybeSingle();

    if (targetChefError || !targetChef) {
      return NextResponse.json({ error: "対象の司厨が見つかりません" }, { status: 404 });
    }
    if (user.role === "MANAGER" && targetChef.role !== "CHEF") {
      return NextResponse.json({ error: "対象ユーザーが司厨ではありません" }, { status: 400 });
    }

    const { data: recipe, error: recipeError } = await supabase
      .from("Recipe")
      .select("id,source,status,name,category,costPerServing")
      .eq("id", id)
      .eq("companyId", user.companyId)
      .maybeSingle();

    if (recipeError || !recipe) {
      return NextResponse.json({ error: "レシピが見つかりません" }, { status: 404 });
    }
    if (recipe.source !== "my" || recipe.status !== "published") {
      return NextResponse.json(
        { error: "公開済みの自社レシピのみ参照ON/OFFできます" },
        { status: 400 },
      );
    }
    if (
      enabled === true &&
      (!recipe.name || !recipe.category || recipe.costPerServing === null)
    ) {
      return NextResponse.json(
        { error: "参照ONにはレシピ名・カテゴリ・原価が必要です" },
        { status: 400 },
      );
    }

    const layer = isOverride ? "override" : "chef";
    const { data: oldChefRef } = await supabase
      .from("ChefRecipeReference")
      .select("enabled")
      .eq("userId", targetId)
      .eq("recipeId", id)
      .maybeSingle();
    const { data: oldOverrideRef } = await supabase
      .from("ChefRecipeReferenceOverride")
      .select("enabled")
      .eq("userId", targetId)
      .eq("recipeId", id)
      .maybeSingle();

    const oldValue = isOverride ? oldOverrideRef?.enabled ?? null : oldChefRef?.enabled ?? null;
    const newValue = enabled === undefined ? null : enabled;

    if (isOverride) {
      if (enabled === null || enabled === undefined) {
        const { error: delError } = await supabase
          .from("ChefRecipeReferenceOverride")
          .delete()
          .eq("userId", targetId)
          .eq("recipeId", id);
        if (delError) throw delError;
      } else {
        const { error: upsertError } = await supabase
          .from("ChefRecipeReferenceOverride")
          .upsert(
            {
              userId: targetId,
              recipeId: id,
              enabled,
            },
            { onConflict: "userId,recipeId" },
          );
        if (upsertError) throw upsertError;
      }
    } else {
      const { error: upsertError } = await supabase
        .from("ChefRecipeReference")
        .upsert(
          {
            userId: targetId,
            recipeId: id,
            enabled,
          },
          { onConflict: "userId,recipeId" },
        );
      if (upsertError) throw upsertError;
    }

    const auditReason =
      user.role === "MANAGER" ? String(reason).trim() : String(reason ?? "司厨変更").trim();
    const { error: auditError } = await supabase.from("ChefRecipeReferenceAudit").insert({
      companyId: user.companyId,
      targetUserId: targetId,
      actorUserId: user.id,
      recipeId: id,
      layer,
      oldValue: oldValue === null ? null : Boolean(oldValue),
      newValue: newValue === null ? null : Boolean(newValue),
      reason: auditReason,
    });
    if (auditError) {
      throw auditError;
    }

    const { data: nextChefRef } = await supabase
      .from("ChefRecipeReference")
      .select("enabled")
      .eq("userId", targetId)
      .eq("recipeId", id)
      .maybeSingle();
    const { data: nextOverrideRef } = await supabase
      .from("ChefRecipeReferenceOverride")
      .select("enabled")
      .eq("userId", targetId)
      .eq("recipeId", id)
      .maybeSingle();

    const chefEnabled = nextChefRef?.enabled ?? false;
    const overrideEnabled = nextOverrideRef?.enabled ?? null;
    const effectiveEnabled = overrideEnabled === null ? chefEnabled : overrideEnabled;

    return NextResponse.json({
      recipe: {
        ...recipe,
        chefReferenceEnabled: chefEnabled,
        overrideReferenceEnabled: overrideEnabled,
        effectiveReferenceEnabled: effectiveEnabled,
      },
    });
  } catch (error) {
    console.error("Failed to toggle reference", error);
    return NextResponse.json({ error: "参照切替に失敗しました" }, { status: 500 });
  }
}
