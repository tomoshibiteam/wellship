import { NextResponse } from "next/server";
import { RecipeCategory } from "@prisma/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryParam = searchParams.get("category") as RecipeCategory | null;
  const scope = searchParams.get("scope") ?? "my";
  const statusParam = searchParams.get("status");
  const queryParam = searchParams.get("q");
  const referenceParam = searchParams.get("reference");
  const chefUserIdParam = searchParams.get("chefUserId");

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const supabase = await createSupabaseServerClient();
    let targetChefId = user.id;
    if (user.role === "MANAGER" && chefUserIdParam) {
      const { data: targetChef, error: targetChefError } = await supabase
        .from("User")
        .select("id,role")
        .eq("id", chefUserIdParam)
        .eq("companyId", user.companyId)
        .maybeSingle();
      if (targetChefError || !targetChef) {
        return NextResponse.json({ error: "対象の司厨が見つかりません" }, { status: 404 });
      }
      if (targetChef.role !== "CHEF") {
        return NextResponse.json({ error: "対象ユーザーが司厨ではありません" }, { status: 400 });
      }
      targetChefId = targetChef.id;
    }

    let query = supabase
      .from("Recipe")
      .select(
        "id,name,category,calories,protein,salt,costPerServing,source,status,referenceEnabled,draftText,originMasterId,ingredients:RecipeIngredient(id)",
      );

    if (scope === "master") {
      query = query
        .is("companyId", null)
        .eq("source", "master")
        .eq("status", "published");
    } else if (scope === "draft") {
      query = query
        .eq("companyId", user.companyId)
        .eq("source", "draft")
        .eq("status", "draft");
    } else {
      query = query.eq("companyId", user.companyId).eq("source", "my");
      if (statusParam && statusParam !== "all") {
        query = query.eq("status", statusParam);
      } else {
        query = query.eq("status", "published");
      }
    }

    if (categoryParam) {
      query = query.eq("category", categoryParam);
    }
    if (queryParam) {
      query = query.ilike("name", `%${queryParam}%`);
    }

    if (scope === "draft") {
      query = query.order("updatedAt", { ascending: false });
    } else {
      query = query.order("category", { ascending: true }).order("name", { ascending: true });
    }
    const { data: recipes, error } = await query;
    if (error) {
      throw error;
    }
    const normalized =
      recipes?.map((recipe) => ({
        id: recipe.id,
        name: recipe.name,
        category: recipe.category,
        calories: recipe.calories,
        protein: recipe.protein,
        salt: recipe.salt,
        costPerServing: recipe.costPerServing,
        source: recipe.source,
        status: recipe.status,
        referenceEnabled: recipe.referenceEnabled,
        draftText: recipe.draftText,
        originMasterId: recipe.originMasterId,
        ingredientCount: (recipe.ingredients ?? []).length,
      })) ?? [];

    if (scope === "my" && normalized.length > 0) {
      const recipeIds = normalized.map((r) => r.id);

      const isMissingTable = (err: unknown) =>
        typeof err === "object" &&
        err !== null &&
        ("code" in err || "message" in err) &&
        // @ts-expect-error - Supabase error shape
        (err.code === "PGRST205" || /Could not find the table/i.test(err.message ?? ""));

      let useLegacyReferenceEnabled = false;

      const { data: chefRefs, error: chefRefError } = await supabase
        .from("ChefRecipeReference")
        .select("recipeId,enabled")
        .eq("userId", targetChefId)
        .in("recipeId", recipeIds);
      if (chefRefError) {
        if (isMissingTable(chefRefError)) {
          useLegacyReferenceEnabled = true;
        } else {
          throw chefRefError;
        }
      }

      const { data: overrideRefs, error: overrideError } = await supabase
        .from("ChefRecipeReferenceOverride")
        .select("recipeId,enabled")
        .eq("userId", targetChefId)
        .in("recipeId", recipeIds);
      if (overrideError) {
        if (isMissingTable(overrideError)) {
          useLegacyReferenceEnabled = true;
        } else {
          throw overrideError;
        }
      }

      const chefMap = new Map<string, boolean>(
        (chefRefs ?? []).map((r) => [r.recipeId, Boolean(r.enabled)]),
      );
      const overrideMap = new Map<string, boolean>(
        (overrideRefs ?? []).map((r) => [r.recipeId, Boolean(r.enabled)]),
      );

      const withRefs = normalized.map((recipe) => {
        if (useLegacyReferenceEnabled) {
          const effectiveEnabled = Boolean(recipe.referenceEnabled);
          return {
            ...recipe,
            chefReferenceEnabled: effectiveEnabled,
            overrideReferenceEnabled: null,
            effectiveReferenceEnabled: effectiveEnabled,
            referenceEnabled: effectiveEnabled,
          };
        }
        const chefEnabled = chefMap.get(recipe.id) ?? false;
        const overrideEnabled = overrideMap.has(recipe.id)
          ? overrideMap.get(recipe.id) ?? false
          : null;
        const effectiveEnabled =
          overrideEnabled === null ? chefEnabled : overrideEnabled;
        return {
          ...recipe,
          chefReferenceEnabled: chefEnabled,
          overrideReferenceEnabled: overrideEnabled,
          effectiveReferenceEnabled: effectiveEnabled,
          // 既存UI互換: referenceEnabled は最終参照を返す
          referenceEnabled: effectiveEnabled,
        };
      });

      const filtered =
        referenceParam === "on"
          ? withRefs.filter((r) => r.effectiveReferenceEnabled)
          : referenceParam === "off"
            ? withRefs.filter((r) => !r.effectiveReferenceEnabled)
            : withRefs;

      return NextResponse.json({ recipes: filtered });
    }
    return NextResponse.json({ recipes: normalized });
  } catch (error) {
    console.error("Failed to fetch recipes", error);
    return NextResponse.json({ error: "レシピ一覧の取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const body = await request.json();
    const { name, category, calories, protein, salt, costPerServing, draftText } =
      body ?? {};
    const supabase = await createSupabaseServerClient();
    const { data: recipe, error } = await supabase
      .from("Recipe")
      .insert({
        name: name ?? null,
        category: category ?? null,
        calories: Number.isFinite(Number(calories)) ? Number(calories) : null,
        protein: Number.isFinite(Number(protein)) ? Number(protein) : null,
        salt: Number.isFinite(Number(salt)) ? Number(salt) : null,
        costPerServing: Number.isFinite(Number(costPerServing))
          ? Number(costPerServing)
          : null,
        source: "draft",
        status: "draft",
        referenceEnabled: false,
        draftText: draftText ?? null,
        companyId: user.companyId,
      })
      .select(
        "id,name,category,calories,protein,salt,costPerServing,source,status,referenceEnabled,draftText",
      )
      .single();
    if (error) {
      throw error;
    }
    return NextResponse.json({
      recipe: { ...recipe, ingredientCount: 0 },
    });
  } catch (error) {
    console.error("Failed to create recipe", error);
    return NextResponse.json({ error: "レシピの作成に失敗しました" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
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
    const supabase = await createSupabaseServerClient();
    const { data: current, error: currentError } = await supabase
      .from("Recipe")
      .select("id,source,status")
      .eq("id", id)
      .maybeSingle();
    if (currentError || !current) {
      return NextResponse.json({ error: "レシピが見つかりません" }, { status: 404 });
    }
    if (current.source === "master") {
      return NextResponse.json({ error: "マスターは編集できません" }, { status: 400 });
    }

    const { data: recipe, error } = await supabase
      .from("Recipe")
      .update({
        name: name ?? null,
        category: category ?? null,
        calories: Number.isFinite(Number(calories)) ? Number(calories) : null,
        protein: Number.isFinite(Number(protein)) ? Number(protein) : null,
        salt: Number.isFinite(Number(salt)) ? Number(salt) : null,
        costPerServing: Number.isFinite(Number(costPerServing))
          ? Number(costPerServing)
          : null,
        draftText: draftText ?? null,
      })
      .eq("id", id)
      .eq("companyId", user.companyId)
      .select(
        "id,name,category,calories,protein,salt,costPerServing,source,status,referenceEnabled,draftText,ingredients:RecipeIngredient(id)",
      )
      .single();
    if (error) {
      throw error;
    }
    return NextResponse.json({
      recipe: {
        id: recipe.id,
        name: recipe.name,
        category: recipe.category,
        calories: recipe.calories,
        protein: recipe.protein,
        salt: recipe.salt,
        costPerServing: recipe.costPerServing,
        source: recipe.source,
        status: recipe.status,
        referenceEnabled: recipe.referenceEnabled,
        draftText: recipe.draftText,
        ingredientCount: (recipe.ingredients ?? []).length,
      },
    });
  } catch (error) {
    console.error("Failed to update recipe", error);
    return NextResponse.json({ error: "レシピの更新に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "idが必要です" }, { status: 400 });
    }
    const supabase = await createSupabaseServerClient();
    const { data: recipe } = await supabase
      .from("Recipe")
      .select("id,source,status")
      .eq("id", id)
      .eq("companyId", user.companyId)
      .maybeSingle();
    if (!recipe) {
      return NextResponse.json({ error: "レシピが見つかりません" }, { status: 404 });
    }
    if (recipe.source !== "draft" || recipe.status !== "draft") {
      return NextResponse.json({ error: "Draftのみ削除できます" }, { status: 400 });
    }
    await supabase.from("RecipeIngredient").delete().eq("recipeId", id);
    await supabase.from("Recipe").delete().eq("id", id).eq("companyId", user.companyId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete recipe", error);
    return NextResponse.json({ error: "レシピの削除に失敗しました" }, { status: 500 });
  }
}
