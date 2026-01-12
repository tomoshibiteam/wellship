import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function loadEnv(filePath: string) {
  const content = fs.readFileSync(filePath, "utf8");
  const env: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function main() {
  const seedPath =
    process.env.MASTER_SEED_PATH ||
    path.join(process.cwd(), "supabase", "seed", "master-recipes.csv");

  if (!fs.existsSync(seedPath)) {
    throw new Error(`Seed CSVが見つかりません: ${seedPath}`);
  }

  const envPath = path.join(process.cwd(), ".env.local");
  const env = loadEnv(envPath);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabaseの環境変数が不足しています");
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const text = fs.readFileSync(seedPath, "utf8");
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line);

  if (lines.length === 0) {
    throw new Error("Seed CSVが空です");
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
    throw new Error("Seed CSVにレシピがありません");
  }

  const recipeNames = Array.from(recipeMap.keys());

  const existingRecipeMap = new Map<string, string>();
  for (const chunk of chunkArray(recipeNames, 50)) {
    if (chunk.length === 0) continue;
    const { data: existingRecipes, error: recipeFetchError } = await supabase
      .from("Recipe")
      .select("id,name")
      .is("companyId", null)
      .eq("source", "master")
      .eq("status", "published")
      .in("name", chunk);

    if (recipeFetchError) {
      throw recipeFetchError;
    }

    (existingRecipes ?? []).forEach((recipe) => {
      existingRecipeMap.set(recipe.name, recipe.id);
    });
  }

  const toInsert: Array<RecipeInput & {
    companyId: string | null;
    source: string;
    status: string;
    referenceEnabled: boolean;
  }> = [];

  recipeMap.forEach((recipe, name) => {
    if (existingRecipeMap.has(name)) return;
    toInsert.push({
      ...recipe,
      companyId: null,
      source: "master",
      status: "published",
      referenceEnabled: false,
    });
  });

  let createdRecipes = 0;
  if (toInsert.length) {
    for (const chunk of chunkArray(toInsert, 50)) {
      if (chunk.length === 0) continue;
      const { error: insertError } = await supabase.from("Recipe").insert(chunk);
      if (insertError) {
        throw insertError;
      }
      createdRecipes += chunk.length;
    }
    for (const chunk of chunkArray(toInsert.map((item) => item.name), 50)) {
      if (chunk.length === 0) continue;
      const { data: inserted, error: fetchError } = await supabase
        .from("Recipe")
        .select("id,name")
        .is("companyId", null)
        .eq("source", "master")
        .eq("status", "published")
        .in("name", chunk);
      if (fetchError) {
        throw fetchError;
      }
      inserted?.forEach((recipe) => {
        existingRecipeMap.set(recipe.name, recipe.id);
      });
    }
  }

  const ingredientNameSet = new Set(
    ingredientRows.map((row) => row.ingredientName).filter(Boolean),
  );
  const ingredientNames = Array.from(ingredientNameSet);
  const ingredientMap = new Map<string, IngredientInput & { id: string }>();

  for (const chunk of chunkArray(ingredientNames, 50)) {
    if (chunk.length === 0) continue;
    const { data: existingIngredients, error: ingredientFetchError } = await supabase
      .from("Ingredient")
      .select("id,name,unit,storageType,costPerUnit")
      .is("companyId", null)
      .in("name", chunk);
    if (ingredientFetchError) {
      throw ingredientFetchError;
    }
    existingIngredients?.forEach((ingredient) => {
      ingredientMap.set(ingredient.name, {
        id: ingredient.id,
        name: ingredient.name,
        unit: ingredient.unit ?? "g",
        storageType: ingredient.storageType ?? "room",
        costPerUnit: ingredient.costPerUnit ?? 0,
      });
    });
  }

  const toInsertIngredients: IngredientInput[] = [];
  const firstIngredientRowByName = new Map<string, RecipeIngredientInput>();
  ingredientRows.forEach((row) => {
    if (!firstIngredientRowByName.has(row.ingredientName)) {
      firstIngredientRowByName.set(row.ingredientName, row);
    }
  });

  ingredientNames.forEach((name) => {
    if (ingredientMap.has(name)) return;
    const row = firstIngredientRowByName.get(name);
    const unit = row?.unit?.trim() || "g";
    const storageType = storageMap[row?.storageType ?? ""] || "room";
    const costPerUnit = row?.costPerUnit ?? 0;
    toInsertIngredients.push({
      name,
      unit,
      storageType,
      costPerUnit,
    });
  });

  if (toInsertIngredients.length) {
    for (const chunk of chunkArray(toInsertIngredients, 50)) {
      if (chunk.length === 0) continue;
      const { error: insertError } = await supabase.from("Ingredient").insert(
        chunk.map((item) => ({
          ...item,
          companyId: null,
        })),
      );
      if (insertError) {
        throw insertError;
      }
    }
    for (const chunk of chunkArray(toInsertIngredients.map((item) => item.name), 50)) {
      if (chunk.length === 0) continue;
      const { data: inserted, error: fetchError } = await supabase
        .from("Ingredient")
        .select("id,name,unit,storageType,costPerUnit")
        .is("companyId", null)
        .in("name", chunk);
      if (fetchError) {
        throw fetchError;
      }
      inserted?.forEach((ingredient) => {
        ingredientMap.set(ingredient.name, {
          id: ingredient.id,
          name: ingredient.name,
          unit: ingredient.unit ?? "g",
          storageType: ingredient.storageType ?? "room",
          costPerUnit: ingredient.costPerUnit ?? 0,
        });
      });
    }
  }

  const insertedRecipeIds = new Set<string>();
  if (createdRecipes > 0) {
    toInsert.forEach((recipe) => {
      const recipeId = existingRecipeMap.get(recipe.name);
      if (recipeId) insertedRecipeIds.add(recipeId);
    });
  }

  const recipeIngredientMap = new Map<string, { recipeId: string; ingredientId: string; amount: number }>();
  ingredientRows.forEach((row) => {
    const recipeId = existingRecipeMap.get(row.recipeName);
    if (!recipeId || !insertedRecipeIds.has(recipeId)) return;
    const ingredient = ingredientMap.get(row.ingredientName);
    if (!ingredient) return;
    const key = `${recipeId}:${ingredient.id}`;
    const existing = recipeIngredientMap.get(key);
    if (existing) {
      existing.amount += row.amount;
    } else {
      recipeIngredientMap.set(key, {
        recipeId,
        ingredientId: ingredient.id,
        amount: row.amount,
      });
    }
  });

  let createdRecipeIngredients = 0;
  if (recipeIngredientMap.size) {
    const payload = Array.from(recipeIngredientMap.values());
    for (const chunk of chunkArray(payload, 100)) {
      if (chunk.length === 0) continue;
      const { error: linkError } = await supabase.from("RecipeIngredient").insert(chunk);
      if (linkError) {
        throw linkError;
      }
      createdRecipeIngredients += chunk.length;
    }
  }

  console.log("マスター用シードパックを投入しました。");
  console.log(
    JSON.stringify(
      {
        recipesInCsv: recipeMap.size,
        createdRecipes,
        createdRecipeIngredients,
        skippedExisting: recipeMap.size - createdRecipes,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
