import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { RecipeCategory } from "@prisma/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryParam = searchParams.get("category") as RecipeCategory | null;

  try {
    const recipes = await prisma.recipe.findMany({
      where: categoryParam ? { category: categoryParam } : undefined,
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ recipes });
  } catch (error) {
    console.error("Failed to fetch recipes", error);
    return NextResponse.json({ error: "Failed to fetch recipes" }, { status: 500 });
  }
}
