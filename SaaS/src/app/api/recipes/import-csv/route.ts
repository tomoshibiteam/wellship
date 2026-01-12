import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";

type RecipeInput = {
  name: string;
  category: string | null;
  calories: number | null;
  protein: number | null;
  salt: number | null;
  costPerServing: number | null;
};

type IngredientInput = {
  name: string;
  unit: string;
  storageType: string;
  costPerUnit: number;
};

type RecipeIngredientInput = {
  recipeName: string;
  ingredientName: string;
  amount: number;
  unit?: string;
  storageType?: string;
  costPerUnit?: number;
};

const categoryMap: Record<string, string> = {
  main: "main",
  side: "side",
  soup: "soup",
  dessert: "dessert",
  "主菜": "main",
  "副菜": "side",
  "汁物": "soup",
  "デザート": "dessert",
};

const storageMap: Record<string, string> = {
  frozen: "frozen",
  chilled: "chilled",
  room: "room",
  "冷凍": "frozen",
  "冷蔵": "chilled",
  "常温": "room",
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

function splitCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current.trim());
  return result;
}

function parseNumber(value: string) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseNumberOrZero(value: string) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "CSVファイルが必要です" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line);

    if (lines.length === 0) {
      return NextResponse.json({ error: "CSVが空です" }, { status: 400 });
    }

    const headerRow = splitCsvLine(lines[0]).map(normalizeHeader);
    const hasHeader = headerRow.some((value) =>
      ["レシピ", "recipe", "カテゴリ", "category"].some((token) =>
        value.includes(token.toLowerCase()),
      ),
    );

    const rows = hasHeader ? lines.slice(1) : lines;
    const headers = hasHeader ? headerRow : [];

    const colIndex = (tokens: string[]) => {
      return headers.findIndex((col) =>
        tokens.some((token) => col.includes(token.toLowerCase())),
      );
    };

    const recipeNameIdx = hasHeader ? colIndex(["レシピ", "recipe"]) : 0;
    const categoryIdx = hasHeader ? colIndex(["カテゴリ", "category"]) : 1;
    const caloriesIdx = hasHeader ? colIndex(["カロリー", "kcal", "calories"]) : 2;
    const proteinIdx = hasHeader ? colIndex(["たんぱく", "protein"]) : 3;
    const saltIdx = hasHeader ? colIndex(["塩分", "salt"]) : 4;
    const costIdx = hasHeader ? colIndex(["原価", "cost"]) : 5;
    const ingredientNameIdx = hasHeader ? colIndex(["食材", "ingredient"]) : -1;
    const ingredientAmountIdx = hasHeader ? colIndex(["使用量", "amount", "quantity"]) : -1;
    const ingredientUnitIdx = hasHeader ? colIndex(["単位", "unit"]) : -1;
    const storageIdx = hasHeader ? colIndex(["保管", "storage"]) : -1;
    const unitCostIdx = hasHeader ? colIndex(["単価", "cost_per_unit", "unit_cost"]) : -1;

    const recipeMap = new Map<string, RecipeInput>();
    const ingredientRows: RecipeIngredientInput[] = [];

    for (const line of rows) {
      const cols = splitCsvLine(line);
      const name = (cols[recipeNameIdx] ?? "").trim();
      if (!name) continue;

      const rawCategory = (cols[categoryIdx] ?? "").trim();
      const category =
        categoryMap[rawCategory] ?? categoryMap[rawCategory.toLowerCase()] ?? null;

      const recipeInput: RecipeInput = {
        name,
        category,
        calories: parseNumber(cols[caloriesIdx] ?? ""),
        protein: parseNumber(cols[proteinIdx] ?? ""),
        salt: parseNumber(cols[saltIdx] ?? ""),
        costPerServing: parseNumber(cols[costIdx] ?? ""),
      };

      const existing = recipeMap.get(name);
      if (!existing) {
        recipeMap.set(name, recipeInput);
      } else {
        recipeMap.set(name, {
          ...existing,
          ...recipeInput,
        });
      }

      if (ingredientNameIdx >= 0) {
        const ingredientName = (cols[ingredientNameIdx] ?? "").trim();
        if (ingredientName) {
          ingredientRows.push({
            recipeName: name,
            ingredientName,
            amount: parseNumberOrZero(cols[ingredientAmountIdx] ?? "0"),
            unit: (cols[ingredientUnitIdx] ?? "").trim(),
            storageType: (cols[storageIdx] ?? "").trim(),
            costPerUnit: parseNumberOrZero(cols[unitCostIdx] ?? "0"),
          });
        }
      }
    }

    if (recipeMap.size === 0) {
      return NextResponse.json({ error: "レシピが見つかりませんでした" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const recipeNames = Array.from(recipeMap.keys());

    const { data: existingRecipes, error: recipeFetchError } = await supabase
      .from("Recipe")
      .select("id,name")
      .eq("companyId", user.companyId)
      .eq("source", "draft")
      .eq("status", "draft")
      .in("name", recipeNames);

    if (recipeFetchError) {
      throw recipeFetchError;
    }

    const existingRecipeMap = new Map(
      (existingRecipes ?? []).map((recipe) => [recipe.name, recipe.id]),
    );

    const toInsert: Array<RecipeInput & { companyId: string; source: string; status: string; referenceEnabled: boolean }> = [];
    const toUpdate: Array<{ id: string; data: RecipeInput }> = [];

    recipeMap.forEach((recipe, name) => {
      const existingId = existingRecipeMap.get(name);
      if (existingId) {
        toUpdate.push({ id: existingId, data: recipe });
      } else {
        toInsert.push({
          ...recipe,
          companyId: user.companyId,
          source: "draft",
          status: "draft",
          referenceEnabled: false,
        });
      }
    });

    let createdRecipes = 0;
    let updatedRecipes = 0;

    if (toInsert.length) {
      const { data: inserted, error: insertError } = await supabase
        .from("Recipe")
        .insert(toInsert)
        .select("id,name");
      if (insertError) {
        throw insertError;
      }
      inserted?.forEach((recipe) => {
        existingRecipeMap.set(recipe.name, recipe.id);
      });
      createdRecipes = inserted?.length ?? 0;
    }

    for (const update of toUpdate) {
      const { error: updateError } = await supabase
        .from("Recipe")
        .update(update.data)
        .eq("id", update.id)
        .eq("companyId", user.companyId);
      if (updateError) {
        throw updateError;
      }
      updatedRecipes += 1;
    }

    const ingredientNameSet = new Set(
      ingredientRows.map((row) => row.ingredientName).filter(Boolean),
    );
    const ingredientNames = Array.from(ingredientNameSet);
    const ingredientMap = new Map<string, { id: string; unit?: string; storageType?: string; costPerUnit?: number }>();

    if (ingredientNames.length) {
      const { data: existingIngredients, error: ingredientFetchError } = await supabase
        .from("Ingredient")
        .select("id,name,unit,storageType,costPerUnit")
        .eq("companyId", user.companyId)
        .in("name", ingredientNames);
      if (ingredientFetchError) {
        throw ingredientFetchError;
      }
      existingIngredients?.forEach((ingredient) => {
        ingredientMap.set(ingredient.name, {
          id: ingredient.id,
          unit: ingredient.unit,
          storageType: ingredient.storageType,
          costPerUnit: ingredient.costPerUnit ?? 0,
        });
      });

      const ingredientInserts: Array<IngredientInput & { companyId: string }> = [];
      ingredientNames.forEach((name) => {
        if (ingredientMap.has(name)) return;
        const exampleRow = ingredientRows.find((row) => row.ingredientName === name);
        const storage = storageMap[exampleRow?.storageType ?? ""] ?? "room";
        ingredientInserts.push({
          name,
          unit: exampleRow?.unit || "g",
          storageType: storage,
          costPerUnit: exampleRow?.costPerUnit ?? 0,
          companyId: user.companyId,
        });
      });

      if (ingredientInserts.length) {
        const { data: insertedIngredients, error: ingredientInsertError } =
          await supabase
            .from("Ingredient")
            .insert(ingredientInserts)
            .select("id,name,unit,storageType,costPerUnit");
        if (ingredientInsertError) {
          throw ingredientInsertError;
        }
        insertedIngredients?.forEach((ingredient) => {
          ingredientMap.set(ingredient.name, {
            id: ingredient.id,
            unit: ingredient.unit,
            storageType: ingredient.storageType,
            costPerUnit: ingredient.costPerUnit ?? 0,
          });
        });
      }

      for (const row of ingredientRows) {
        const existing = ingredientMap.get(row.ingredientName);
        if (!existing) continue;
        const updateData: Partial<IngredientInput> = {};
        if (row.unit && row.unit !== existing.unit) updateData.unit = row.unit;
        if (row.storageType) {
          const normalized = storageMap[row.storageType] ?? row.storageType;
          if (normalized && normalized !== existing.storageType) {
            updateData.storageType = normalized;
          }
        }
        if (row.costPerUnit && row.costPerUnit !== existing.costPerUnit) {
          updateData.costPerUnit = row.costPerUnit;
        }
        if (Object.keys(updateData).length) {
          await supabase
            .from("Ingredient")
            .update(updateData)
            .eq("id", existing.id)
            .eq("companyId", user.companyId);
        }
      }
    }

    if (ingredientRows.length) {
      const recipeIds = Array.from(new Set(ingredientRows.map((row) => {
        return existingRecipeMap.get(row.recipeName) ?? "";
      }).filter(Boolean)));

      if (recipeIds.length) {
        await supabase.from("RecipeIngredient").delete().in("recipeId", recipeIds);
      }

      const recipeIngredientMap = new Map<string, { recipeId: string; ingredientId: string; amount: number }>();
      for (const row of ingredientRows) {
        const recipeId = existingRecipeMap.get(row.recipeName);
        const ingredientId = ingredientMap.get(row.ingredientName)?.id;
        if (!recipeId || !ingredientId) continue;
        const key = `${recipeId}:${ingredientId}`;
        const existing = recipeIngredientMap.get(key);
        if (existing) {
          existing.amount += row.amount;
        } else {
          recipeIngredientMap.set(key, { recipeId, ingredientId, amount: row.amount });
        }
      }

      if (recipeIngredientMap.size) {
        const payload = Array.from(recipeIngredientMap.values());
        const { error: recipeIngredientError } = await supabase
          .from("RecipeIngredient")
          .insert(payload);
        if (recipeIngredientError) {
          throw recipeIngredientError;
        }
      }
    }

    return NextResponse.json({
      createdRecipes,
      updatedRecipes,
      recipesProcessed: recipeMap.size,
    });
  } catch (error) {
    console.error("recipes csv import error", error);
    return NextResponse.json({ error: "CSVインポートに失敗しました" }, { status: 500 });
  }
}
