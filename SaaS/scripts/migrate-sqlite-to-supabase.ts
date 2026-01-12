#!/usr/bin/env tsx
/**
 * Migrate data from local SQLite (prisma/dev.db) to Supabase (via supabase-js).
 *
 * Prerequisites:
 * - Run: npx prisma generate --schema prisma/schema.sqlite.prisma
 * - Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * Optional:
 * - RESET_SUPABASE_DB=true to wipe Supabase tables before import
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient as SqliteClient } from "../prisma/generated/sqlite-client";

function loadEnvFile(filename: string) {
  const filePath = path.join(process.cwd(), filename);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase env vars are not set (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).",
  );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const sqlite = new SqliteClient();

const CHUNK_SIZE = 500;

function normalizeRow<T extends Record<string, unknown>>(row: T): T {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString() : value,
    ]),
  ) as T;
}

async function upsertAll<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  onConflict: string,
) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE).map(normalizeRow);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) {
      throw new Error(`Failed to upsert ${table}: ${error.message}`);
    }
  }
}

async function deleteAll(table: string) {
  const { error } = await supabase.from(table).delete().neq("id", "");
  if (error) {
    throw new Error(`Failed to delete ${table}: ${error.message}`);
  }
}

async function resetSupabase() {
  await deleteAll("MealFeedback");
  await deleteAll("RecipeExclusion");
  await deleteAll("CrewMember");
  await deleteAll("ProcurementAdjustment");
  await deleteAll("MenuPlanRecipe");
  await deleteAll("MenuPlan");
  await deleteAll("RecipeIngredient");
  await deleteAll("Recipe");
  await deleteAll("Ingredient");
  await deleteAll("UserVesselMembership");
  await deleteAll("Session");
  await deleteAll("User");
  await deleteAll("Vessel");
  await deleteAll("Company");
}

async function main() {
  if (process.env.RESET_SUPABASE_DB === "true") {
    console.log("⚠️  RESET_SUPABASE_DB=true -> wiping Supabase data");
    await resetSupabase();
  }

  const companies = await sqlite.company.findMany();
  const vessels = await sqlite.vessel.findMany();
  const users = await sqlite.user.findMany();
  const sessions = await sqlite.session.findMany();
  const memberships = await sqlite.userVesselMembership.findMany();
  const ingredients = await sqlite.ingredient.findMany();
  const recipes = await sqlite.recipe.findMany();
  const recipeIngredients = await sqlite.recipeIngredient.findMany();
  const menuPlans = await sqlite.menuPlan.findMany();
  const menuPlanRecipes = await sqlite.menuPlanRecipe.findMany();
  const procurementAdjustments = await sqlite.procurementAdjustment.findMany();
  const crewMembers = await sqlite.crewMember.findMany();
  const recipeExclusions = await sqlite.recipeExclusion.findMany();
  const mealFeedbacks = await sqlite.mealFeedback.findMany();

  await upsertAll("Company", companies, "id");
  await upsertAll("Vessel", vessels, "id");
  await upsertAll(
    "User",
    users.map((u) => ({ ...u, authUserId: null })),
    "id",
  );
  await upsertAll("Session", sessions, "id");
  await upsertAll("UserVesselMembership", memberships, "id");
  await upsertAll("Ingredient", ingredients, "id");
  await upsertAll(
    "Recipe",
    recipes.map((recipe) => ({
      ...recipe,
      source: "my",
      status: "published",
      referenceEnabled: true,
      originMasterId: null,
      draftText: null,
    })),
    "id",
  );
  await upsertAll("RecipeIngredient", recipeIngredients, "id");
  await upsertAll("MenuPlan", menuPlans, "id");
  await upsertAll("MenuPlanRecipe", menuPlanRecipes, "id");
  await upsertAll(
    "ProcurementAdjustment",
    procurementAdjustments,
    "ingredientId,startDate,endDate",
  );
  await upsertAll("CrewMember", crewMembers, "id");
  await upsertAll("RecipeExclusion", recipeExclusions, "id");
  await upsertAll("MealFeedback", mealFeedbacks, "id");

  console.log("✅ SQLite -> Supabase migration completed.");
}

main()
  .then(async () => {
    await sqlite.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await sqlite.$disconnect();
    process.exit(1);
  });
