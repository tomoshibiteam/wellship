import { prisma } from "@/lib/db/prisma";
import { Recipe, RecipeIngredientRef } from "@/lib/types";

export async function getAllRecipes(): Promise<Recipe[]> {
  const recipes = await prisma.recipe.findMany({
    include: {
      ingredients: {
        include: {
          ingredient: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return recipes.map((recipe) => ({
    id: recipe.id,
    name: recipe.name,
    category: recipe.category,
    calories: recipe.calories,
    protein: recipe.protein,
    salt: recipe.salt,
    costPerServing: recipe.costPerServing,
    ingredients: recipe.ingredients.map<RecipeIngredientRef>((ri) => ({
      ingredientId: ri.ingredientId,
      amount: ri.amount,
      ingredient: ri.ingredient,
    })),
  }));
}
