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
    const { masterId } = body ?? {};
    if (!masterId) {
      return NextResponse.json({ error: "masterIdが必要です" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: masterRecipe, error: masterError } = await supabase
      .from("Recipe")
      .select(
        "id,name,category,calories,protein,salt,costPerServing,ingredients:RecipeIngredient(amount,ingredient:Ingredient(id,name,unit,storageType,costPerUnit))",
      )
      .eq("id", masterId)
      .eq("source", "master")
      .eq("status", "published")
      .maybeSingle();

    if (masterError || !masterRecipe) {
      return NextResponse.json({ error: "マスターレシピが見つかりません" }, { status: 404 });
    }

    const { data: created, error: createError } = await supabase
      .from("Recipe")
      .insert({
        name: masterRecipe.name,
        category: masterRecipe.category,
        calories: masterRecipe.calories,
        protein: masterRecipe.protein,
        salt: masterRecipe.salt,
        costPerServing: masterRecipe.costPerServing,
        source: "my",
        status: "published",
        referenceEnabled: false,
        originMasterId: masterRecipe.id,
        companyId: user.companyId,
      })
      .select(
        "id,name,category,calories,protein,salt,costPerServing,source,status,referenceEnabled",
      )
      .single();

    if (createError || !created) {
      throw createError;
    }

    const masterIngredients = masterRecipe.ingredients ?? [];
    const normalizeIngredient = (raw: unknown) =>
      Array.isArray(raw) ? raw[0] : raw;

    if (masterIngredients.length > 0) {
      const ingredientNames = Array.from(
        new Set(
          masterIngredients
            .map((ri) => {
              const ingredient = normalizeIngredient(ri.ingredient) as
                | {
                    name?: string | null;
                  }
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
          .eq("companyId", user.companyId)
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
        companyId: string;
      }> = [];

      ingredientNames.forEach((name) => {
        if (ingredientMap.has(name)) return;
        const sourceRaw = masterIngredients.find((ri) => {
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
          companyId: user.companyId,
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
      masterIngredients.forEach((ri) => {
        const ingredient = normalizeIngredient(ri.ingredient) as
          | { name?: string | null }
          | null
          | undefined;
        const name = ingredient?.name;
        if (!name) return;
        const target = ingredientMap.get(name);
        if (!target) return;
        const key = `${created.id}:${target.id}`;
        const existing = recipeIngredientMap.get(key);
        if (existing) {
          existing.amount += ri.amount;
        } else {
          recipeIngredientMap.set(key, { ingredientId: target.id, amount: ri.amount });
        }
      });

      if (recipeIngredientMap.size > 0) {
        const payload = Array.from(recipeIngredientMap.values()).map((item) => ({
          recipeId: created.id,
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

    return NextResponse.json({ recipe: created });
  } catch (error) {
    console.error("Failed to copy recipe", error);
    return NextResponse.json({ error: "コピーに失敗しました" }, { status: 500 });
  }
}
