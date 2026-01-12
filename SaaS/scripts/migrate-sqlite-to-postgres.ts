#!/usr/bin/env tsx
/**
 * Migrate data from local SQLite (prisma/dev.db) to Supabase Postgres.
 *
 * Prerequisites:
 * - Prisma schema is set to Postgres and migrated to Supabase.
 * - Run: npx prisma generate --schema prisma/schema.sqlite.prisma
 * - Set DATABASE_URL to Supabase Postgres connection string.
 *
 * Optional:
 * - SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - SUPABASE_DEFAULT_PASSWORD (for auth user creation)
 * - RESET_TARGET_DB=true to wipe Postgres before import
 */

import { PrismaClient } from '@prisma/client';
import { PrismaClient as SqliteClient } from '../prisma/generated/sqlite-client';
import { createClient } from '@supabase/supabase-js';

const postgresUrl = process.env.DATABASE_URL;
if (!postgresUrl) {
  throw new Error('DATABASE_URL is not set.');
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const defaultPassword = process.env.SUPABASE_DEFAULT_PASSWORD;

const pg = new PrismaClient();
const sqlite = new SqliteClient();

async function resetTargetDb() {
  await pg.mealFeedback.deleteMany();
  await pg.menuPlanRecipe.deleteMany();
  await pg.menuPlan.deleteMany();
  await pg.procurementAdjustment.deleteMany();
  await pg.recipeIngredient.deleteMany();
  await pg.recipeExclusion.deleteMany();
  await pg.recipe.deleteMany();
  await pg.ingredient.deleteMany();
  await pg.userVesselMembership.deleteMany();
  await pg.session.deleteMany();
  await pg.user.deleteMany();
  await pg.crewMember.deleteMany();
  await pg.vessel.deleteMany();
  await pg.company.deleteMany();
}

async function migrateAuthUsers(users: Array<{ email: string; name: string | null; role: string; companyId: string }>) {
  if (!supabaseUrl || !supabaseServiceKey || !defaultPassword) {
    console.log('ℹ️  Supabase Auth user creation skipped (missing env).');
    return new Map<string, string>();
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const map = new Map<string, string>();

  for (const user of users) {
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: { name: user.name },
        app_metadata: { role: user.role, companyId: user.companyId },
      });

      if (error) {
        console.warn(`⚠️  Auth user skipped: ${user.email} (${error.message})`);
        continue;
      }

      if (data?.user?.id) {
        map.set(user.email, data.user.id);
      }
    } catch (err) {
      console.warn(`⚠️  Auth user failed: ${user.email}`, err);
    }
  }

  return map;
}

async function main() {
  const shouldReset = process.env.RESET_TARGET_DB === 'true';
  if (shouldReset) {
    console.log('⚠️  RESET_TARGET_DB=true -> wiping Postgres data');
    await resetTargetDb();
  }

  const companies = await sqlite.company.findMany();
  const vessels = await sqlite.vessel.findMany();
  const users = await sqlite.user.findMany();
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

  const authUserMap = await migrateAuthUsers(
    users.map((u) => ({
      email: u.email,
      name: u.name,
      role: u.role,
      companyId: u.companyId,
    }))
  );

  await pg.company.createMany({ data: companies, skipDuplicates: true });
  await pg.vessel.createMany({ data: vessels, skipDuplicates: true });

  await pg.user.createMany({
    data: users.map((u) => ({
      ...u,
      authUserId: authUserMap.get(u.email) ?? null,
    })),
    skipDuplicates: true,
  });

  await pg.userVesselMembership.createMany({
    data: memberships,
    skipDuplicates: true,
  });

  await pg.ingredient.createMany({ data: ingredients, skipDuplicates: true });
  await pg.recipe.createMany({ data: recipes, skipDuplicates: true });
  await pg.recipeIngredient.createMany({
    data: recipeIngredients,
    skipDuplicates: true,
  });

  await pg.menuPlan.createMany({ data: menuPlans, skipDuplicates: true });
  await pg.menuPlanRecipe.createMany({
    data: menuPlanRecipes,
    skipDuplicates: true,
  });

  await pg.procurementAdjustment.createMany({
    data: procurementAdjustments,
    skipDuplicates: true,
  });

  await pg.crewMember.createMany({ data: crewMembers, skipDuplicates: true });
  await pg.recipeExclusion.createMany({
    data: recipeExclusions,
    skipDuplicates: true,
  });
  await pg.mealFeedback.createMany({
    data: mealFeedbacks,
    skipDuplicates: true,
  });

  console.log('✅ Migration completed.');
}

main()
  .then(async () => {
    await sqlite.$disconnect();
    await pg.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await sqlite.$disconnect();
    await pg.$disconnect();
    process.exit(1);
  });
