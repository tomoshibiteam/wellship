import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "MANAGER") {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }
    const body = await request.json();
    const { id } = body ?? {};
    if (!id) {
      return NextResponse.json({ error: "idが必要です" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    const { data: sourceRecipe, error: sourceError } = await supabase
      .from("Recipe")
      .select(
        "id,name,category,calories,protein,salt,costPerServing,source,status,ingredients:RecipeIngredient(amount,ingredient:Ingredient(id,name,unit,storageType,costPerUnit))",
      )
      .eq("id", id)
      .eq("companyId", user.companyId)
      .eq("source", "my")
      .eq("status", "published")
      .maybeSingle();

    if (sourceError || !sourceRecipe) {
      return NextResponse.json({ error: "レシピが見つかりません" }, { status: 404 });
    }

    const { data: existingMaster } = await supabase
      .from("Recipe")
      .select("id")
      .is("companyId", null)
      .eq("source", "master")
      .eq("status", "published")
      .eq("name", sourceRecipe.name)
      .maybeSingle();

    if (existingMaster) {
      return NextResponse.json({ error: "同名のマスターレシピが既に存在します" }, { status: 409 });
    }

    const { data: masterRecipe, error: masterError } = await supabase
      .from("Recipe")
      .insert({
        name: sourceRecipe.name,
        category: sourceRecipe.category,
        calories: sourceRecipe.calories,
        protein: sourceRecipe.protein,
        salt: sourceRecipe.salt,
        costPerServing: sourceRecipe.costPerServing,
        companyId: null,
        source: "master",
        status: "published",
        referenceEnabled: false,
        originMasterId: null,
        draftText: null,
      })
      .select("id,name,category,calories,protein,salt,costPerServing,source,status")
      .single();

    if (masterError || !masterRecipe) {
      throw masterError;
    }

    const sourceIngredients = sourceRecipe.ingredients ?? [];
    const normalizeIngredient = (raw: unknown) =>
      Array.isArray(raw) ? raw[0] : raw;

    if (sourceIngredients.length > 0) {
      const ingredientNames = Array.from(
        new Set(
          sourceIngredients
            .map((ri) => {
              const ingredient = normalizeIngredient(ri.ingredient) as
                | { name?: string | null }
                | null
                | undefined;
              return ingredient?.name;
            })
            .filter((name): name is string => Boolean(name)),
        ),
      );

      const ingredientMap = new Map<
        string,
        { id: string; unit: string | null; storageType: string | null; costPerUnit: number | null }
      >();

      if (ingredientNames.length > 0) {
        const { data: existingIngredients, error: ingredientError } = await supabase
          .from("Ingredient")
          .select("id,name,unit,storageType,costPerUnit")
          .is("companyId", null)
          .in("name", ingredientNames);
        if (ingredientError) {
          throw ingredientError;
        }
        existingIngredients?.forEach((ingredient) => {
          ingredientMap.set(ingredient.name, {
            id: ingredient.id,
            unit: ingredient.unit,
            storageType: ingredient.storageType,
            costPerUnit: ingredient.costPerUnit ?? null,
          });
        });
      }

      const toInsertIngredients: Array<{
        name: string;
        unit: string;
        storageType: string;
        costPerUnit: number;
        companyId: null;
      }> = [];

      ingredientNames.forEach((name) => {
        if (ingredientMap.has(name)) return;
        const sourceRaw = sourceIngredients.find((ri) => {
          const ingredient = normalizeIngredient(ri.ingredient) as
            | { name?: string | null }
            | null
            | undefined;
          return ingredient?.name === name;
        })?.ingredient;
        const source = normalizeIngredient(sourceRaw) as
          | {
              unit?: string | null;
              storageType?: string | null;
              costPerUnit?: number | null;
            }
          | null
          | undefined;
        if (!source) return;
        toInsertIngredients.push({
          name,
          unit: source.unit ?? "g",
          storageType: source.storageType ?? "room",
          costPerUnit: source.costPerUnit ?? 0,
          companyId: null,
        });
      });

      if (toInsertIngredients.length > 0) {
        const { data: inserted, error: insertError } = await supabase
          .from("Ingredient")
          .insert(toInsertIngredients)
          .select("id,name,unit,storageType,costPerUnit");
        if (insertError) {
          throw insertError;
        }
        inserted?.forEach((ingredient) => {
          ingredientMap.set(ingredient.name, {
            id: ingredient.id,
            unit: ingredient.unit,
            storageType: ingredient.storageType,
            costPerUnit: ingredient.costPerUnit ?? null,
          });
        });
      }

      const recipeIngredientMap = new Map<string, { ingredientId: string; amount: number }>();
      sourceIngredients.forEach((ri) => {
        const ingredient = normalizeIngredient(ri.ingredient) as
          | { name?: string | null }
          | null
          | undefined;
        const name = ingredient?.name;
        if (!name) return;
        const target = ingredientMap.get(name);
        if (!target) return;
        const key = `${masterRecipe.id}:${target.id}`;
        const existing = recipeIngredientMap.get(key);
        if (existing) {
          existing.amount += ri.amount;
        } else {
          recipeIngredientMap.set(key, { ingredientId: target.id, amount: ri.amount });
        }
      });

      if (recipeIngredientMap.size > 0) {
        const payload = Array.from(recipeIngredientMap.values()).map((item) => ({
          recipeId: masterRecipe.id,
          ingredientId: item.ingredientId,
          amount: item.amount,
        }));
        const { error: linkError } = await supabase
          .from("RecipeIngredient")
          .insert(payload);
        if (linkError) {
          throw linkError;
        }
      }
    }

    return NextResponse.json({ recipe: masterRecipe });
  } catch (error) {
    console.error("Failed to promote recipe", error);
    return NextResponse.json({ error: "マスター昇格に失敗しました" }, { status: 500 });
  }
}
