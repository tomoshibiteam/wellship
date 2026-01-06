import { prisma } from "@/lib/db/prisma";
import { Ingredient } from "@/lib/types";

export async function getAllIngredients(): Promise<Ingredient[]> {
  const ingredients = await prisma.ingredient.findMany({
    orderBy: { name: "asc" },
  });
  return ingredients;
}
