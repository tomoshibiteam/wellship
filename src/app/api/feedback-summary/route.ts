import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { RecipeCategory } from "@prisma/client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const startDate = body?.startDate as string | undefined;
    const endDate = body?.endDate as string | undefined;
    if (!startDate || !endDate) {
      return NextResponse.json({ error: "開始日と終了日を指定してください。" }, { status: 400 });
    }

    const feedbacks = await prisma.mealFeedback.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
      include: {
        menuPlan: {
          include: {
            recipeLinks: {
              include: { recipe: true },
            },
          },
        },
      },
    });

    if (!feedbacks.length) {
      return NextResponse.json({
        summary: {
          count: 0,
          startDate,
          endDate,
          avgSatisfaction: 0,
          noLeftoverRatio: 0,
          volumeJustRatio: 0,
        },
      });
    }

    const count = feedbacks.length;
    const avgSatisfaction =
      feedbacks.reduce((sum, f) => sum + f.satisfaction, 0) / count;
    const noLeftoverRatio =
      feedbacks.filter((f) => f.leftover === "none").length / count;
    const volumeJustRatio =
      feedbacks.filter((f) => f.volumeFeeling === "just").length / count;

    // 日付 x 食事区分でグルーピング
    const trendMap = new Map<
      string,
      { date: string; mealType: string; sum: number; count: number; noLeftover: number }
    >();
    for (const f of feedbacks) {
      const key = `${f.date}-${f.mealType}`;
      if (!trendMap.has(key)) {
        trendMap.set(key, { date: f.date, mealType: f.mealType, sum: 0, count: 0, noLeftover: 0 });
      }
      const entry = trendMap.get(key)!;
      entry.sum += f.satisfaction;
      entry.count += 1;
      if (f.leftover === "none") entry.noLeftover += 1;
    }
    const trends = Array.from(trendMap.values()).map((t) => ({
      date: t.date,
      mealType: t.mealType,
      avgSatisfaction: t.sum / t.count,
      noLeftoverRatio: t.noLeftover / t.count,
      count: t.count,
    }));

    // メニュー別ランキング用: MenuPlan に紐づく主菜を特定し集計
    // 主菜の決め方: menuPlan.recipeLinks から category === "main" を優先、無ければ先頭を採用する簡易ルール。
    const recipeMap = new Map<
      string,
      { id: string; name: string; sum: number; count: number; noLeftover: number }
    >();
    for (const fb of feedbacks) {
      const mainRecipe =
        fb.menuPlan?.recipeLinks.find((rl) => rl.recipe.category === RecipeCategory.main)?.recipe ??
        fb.menuPlan?.recipeLinks[0]?.recipe;
      if (!mainRecipe) continue;
      if (!recipeMap.has(mainRecipe.id)) {
        recipeMap.set(mainRecipe.id, {
          id: mainRecipe.id,
          name: mainRecipe.name,
          sum: 0,
          count: 0,
          noLeftover: 0,
        });
      }
      const entry = recipeMap.get(mainRecipe.id)!;
      entry.sum += fb.satisfaction;
      entry.count += 1;
      if (fb.leftover === "none") entry.noLeftover += 1;
    }

    const recipeStats = Array.from(recipeMap.values()).map((r) => ({
      id: r.id,
      name: r.name,
      count: r.count,
      avgSatisfaction: r.sum / r.count,
      noLeftoverRatio: r.noLeftover / r.count,
    }));

    const MIN_COUNT = 3;
    const favorites = recipeStats
      .filter((r) => r.count >= MIN_COUNT)
      .sort((a, b) => {
        if (b.avgSatisfaction !== a.avgSatisfaction) return b.avgSatisfaction - a.avgSatisfaction;
        if (b.noLeftoverRatio !== a.noLeftoverRatio) return b.noLeftoverRatio - a.noLeftoverRatio;
        return b.count - a.count;
      })
      .slice(0, 5);

    const improvables = recipeStats
      .filter((r) => r.count >= MIN_COUNT)
      .sort((a, b) => {
        if (a.avgSatisfaction !== b.avgSatisfaction) return a.avgSatisfaction - b.avgSatisfaction;
        if (a.noLeftoverRatio !== b.noLeftoverRatio) return a.noLeftoverRatio - b.noLeftoverRatio;
        return b.count - a.count;
      })
      .slice(0, 5);

    return NextResponse.json({
      summary: {
        count,
        startDate,
        endDate,
        avgSatisfaction,
        noLeftoverRatio,
        volumeJustRatio,
      },
      trends,
      rankings: {
        favorites,
        improvables,
      },
    });
  } catch (error) {
    console.error("feedback summary error", error);
    return NextResponse.json(
      { error: "集計に失敗しました。時間をおいて再度お試しください。" },
      { status: 500 },
    );
  }
}
