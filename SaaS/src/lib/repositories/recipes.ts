import { Recipe, RecipeIngredientRef } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAllRecipes(): Promise<Recipe[]> {
  const supabase = await createSupabaseServerClient();
  const { data: recipes, error } = await supabase
    .from("Recipe")
    .select(
      "id,name,category,calories,protein,salt,costPerServing,ingredients:RecipeIngredient(amount,ingredientId,ingredient:Ingredient(*))",
    )
    .order("name", { ascending: true });

  if (error || !recipes) {
    console.error("Failed to load recipes", error);
    return [];
  }

  return recipes.map((recipe) => ({
    id: recipe.id,
    name: recipe.name ?? "",
    category: recipe.category ?? "main",
    calories: recipe.calories ?? 0,
    protein: recipe.protein ?? 0,
    salt: recipe.salt ?? 0,
    costPerServing: recipe.costPerServing ?? 0,
    ingredients: (recipe.ingredients || []).map<RecipeIngredientRef>((ri) => ({
      ingredientId: ri.ingredientId,
      amount: ri.amount,
      ingredient: (() => {
        const ingredient = Array.isArray(ri.ingredient) ? ri.ingredient[0] : ri.ingredient;
        if (!ingredient) return undefined;
        return {
          id: ingredient.id,
          name: ingredient.name,
          storageType: ingredient.storageType,
          unit: ingredient.unit,
        };
      })(),
    })),
  }));
}
