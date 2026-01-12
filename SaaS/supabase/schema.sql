create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

create table if not exists "Company" (
  "id" text primary key default gen_random_uuid()::text,
  "name" text not null,
  "slug" text not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index if not exists "Company_slug_key" on "Company" ("slug");

create table if not exists "Vessel" (
  "id" text primary key default gen_random_uuid()::text,
  "name" text not null,
  "imoNumber" text,
  "minBudgetUsagePercent" integer not null default 90,
  "defaultSeason" text,
  "defaultMaxCookingTime" integer,
  "companyId" text not null references "Company" ("id") on delete cascade,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists "Vessel_companyId_idx" on "Vessel" ("companyId");

create table if not exists "User" (
  "id" text primary key default gen_random_uuid()::text,
  "email" text not null,
  "name" text,
  "passwordHash" text,
  "role" text not null default 'CHEF',
  "authUserId" text unique,
  "companyId" text not null references "Company" ("id") on delete cascade,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index if not exists "User_email_key" on "User" ("email");
create index if not exists "User_companyId_idx" on "User" ("companyId");
create index if not exists "User_role_idx" on "User" ("role");

create table if not exists "UserVesselMembership" (
  "id" text primary key default gen_random_uuid()::text,
  "userId" text not null references "User" ("id") on delete cascade,
  "vesselId" text not null references "Vessel" ("id") on delete cascade,
  "role" text,
  "createdAt" timestamptz not null default now()
);

create unique index if not exists "UserVesselMembership_userId_vesselId_key" on "UserVesselMembership" ("userId", "vesselId");
create index if not exists "UserVesselMembership_vesselId_idx" on "UserVesselMembership" ("vesselId");

create table if not exists "Session" (
  "id" text primary key default gen_random_uuid()::text,
  "sessionToken" text not null,
  "userId" text not null references "User" ("id") on delete cascade,
  "expires" timestamptz not null,
  "vesselId" text,
  "createdAt" timestamptz not null default now()
);

create unique index if not exists "Session_sessionToken_key" on "Session" ("sessionToken");
create index if not exists "Session_userId_idx" on "Session" ("userId");

create table if not exists "Ingredient" (
  "id" text primary key default gen_random_uuid()::text,
  "name" text not null,
  "storageType" text not null,
  "unit" text not null,
  "costPerUnit" double precision not null default 0,
  "companyId" text references "Company" ("id") on delete cascade,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists "Ingredient_companyId_idx" on "Ingredient" ("companyId");

create table if not exists "ProcurementAdjustment" (
  "id" text primary key default gen_random_uuid()::text,
  "ingredientId" text not null references "Ingredient" ("id") on delete cascade,
  "startDate" text not null,
  "endDate" text not null,
  "plannedAmount" double precision not null,
  "orderAmount" double precision not null,
  "inStock" boolean not null default false,
  "unitPrice" double precision not null,
  "vesselId" text references "Vessel" ("id") on delete cascade,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index if not exists "ProcurementAdjustment_ingredientId_startDate_endDate_key"
  on "ProcurementAdjustment" ("ingredientId", "startDate", "endDate");
create index if not exists "ProcurementAdjustment_vesselId_idx" on "ProcurementAdjustment" ("vesselId");

create table if not exists "Recipe" (
  "id" text primary key default gen_random_uuid()::text,
  "name" text,
  "category" text,
  "calories" double precision,
  "protein" double precision,
  "salt" double precision,
  "costPerServing" double precision,
  "source" text not null default 'my',
  "status" text not null default 'published',
  "referenceEnabled" boolean not null default false,
  "originMasterId" text,
  "draftText" text,
  "companyId" text references "Company" ("id") on delete cascade,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists "Recipe_companyId_idx" on "Recipe" ("companyId");
create index if not exists "Recipe_status_idx" on "Recipe" ("status");
create index if not exists "Recipe_source_idx" on "Recipe" ("source");

create table if not exists "RecipeIngredient" (
  "id" text primary key default gen_random_uuid()::text,
  "amount" double precision not null,
  "recipeId" text not null references "Recipe" ("id") on delete cascade,
  "ingredientId" text not null references "Ingredient" ("id") on delete cascade
);

create unique index if not exists "RecipeIngredient_recipeId_ingredientId_key"
  on "RecipeIngredient" ("recipeId", "ingredientId");

create table if not exists "MenuPlan" (
  "id" text primary key default gen_random_uuid()::text,
  "date" text not null,
  "mealType" text not null,
  "healthScore" double precision not null,
  "crewCount" integer not null default 20,
  "budgetPerPerson" integer not null default 1200,
  "isClosed" boolean not null default false,
  "closedAt" timestamptz,
  "vesselId" text references "Vessel" ("id") on delete cascade,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index if not exists "MenuPlan_vesselId_date_mealType_key"
  on "MenuPlan" ("vesselId", "date", "mealType");
create index if not exists "MenuPlan_vesselId_idx" on "MenuPlan" ("vesselId");

create table if not exists "MenuPlanRecipe" (
  "id" text primary key default gen_random_uuid()::text,
  "menuPlanId" text not null references "MenuPlan" ("id") on delete cascade,
  "recipeId" text not null references "Recipe" ("id") on delete cascade
);

create unique index if not exists "MenuPlanRecipe_menuPlanId_recipeId_key"
  on "MenuPlanRecipe" ("menuPlanId", "recipeId");

create table if not exists "CrewMember" (
  "id" text primary key default gen_random_uuid()::text,
  "name" text not null,
  "cardCode" text not null,
  "vesselId" text not null references "Vessel" ("id") on delete cascade,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index if not exists "CrewMember_cardCode_key" on "CrewMember" ("cardCode");
create index if not exists "CrewMember_vesselId_idx" on "CrewMember" ("vesselId");

create table if not exists "MealFeedback" (
  "id" text primary key default gen_random_uuid()::text,
  "date" text not null,
  "mealType" text not null,
  "satisfaction" integer not null,
  "volumeFeeling" text not null,
  "leftover" text not null,
  "comment" text,
  "photoUrl" text,
  "reasonTags" text,
  "menuPlanId" text references "MenuPlan" ("id") on delete cascade,
  "vesselId" text references "Vessel" ("id") on delete cascade,
  "crewMemberId" text references "CrewMember" ("id") on delete set null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists "MealFeedback_vesselId_idx" on "MealFeedback" ("vesselId");
create index if not exists "MealFeedback_date_idx" on "MealFeedback" ("date");
create index if not exists "MealFeedback_crewMemberId_idx" on "MealFeedback" ("crewMemberId");

create table if not exists "RecipeExclusion" (
  "id" text primary key default gen_random_uuid()::text,
  "recipeId" text not null references "Recipe" ("id") on delete cascade,
  "scope" text not null,
  "reason" text not null,
  "userId" text references "User" ("id") on delete cascade,
  "vesselId" text references "Vessel" ("id") on delete cascade,
  "createdAt" timestamptz not null default now()
);

create unique index if not exists "RecipeExclusion_recipeId_userId_scope_key"
  on "RecipeExclusion" ("recipeId", "userId", "scope");
create unique index if not exists "RecipeExclusion_recipeId_vesselId_scope_key"
  on "RecipeExclusion" ("recipeId", "vesselId", "scope");
create index if not exists "RecipeExclusion_userId_idx" on "RecipeExclusion" ("userId");
create index if not exists "RecipeExclusion_vesselId_idx" on "RecipeExclusion" ("vesselId");

-- 司厨セット（恒久参照）: 司厨が「使う/使わない」を決めるベース
create table if not exists "ChefRecipeReference" (
  "id" text primary key default gen_random_uuid()::text,
  "userId" text not null references "User" ("id") on delete cascade,
  "recipeId" text not null references "Recipe" ("id") on delete cascade,
  "enabled" boolean not null default false,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index if not exists "ChefRecipeReference_userId_recipeId_key"
  on "ChefRecipeReference" ("userId", "recipeId");
create index if not exists "ChefRecipeReference_userId_idx" on "ChefRecipeReference" ("userId");
create index if not exists "ChefRecipeReference_recipeId_idx" on "ChefRecipeReference" ("recipeId");

-- 会社による強制（override）: MANAGERのみが設定。存在する場合は最終参照に優先。
create table if not exists "ChefRecipeReferenceOverride" (
  "id" text primary key default gen_random_uuid()::text,
  "userId" text not null references "User" ("id") on delete cascade,
  "recipeId" text not null references "Recipe" ("id") on delete cascade,
  "enabled" boolean not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index if not exists "ChefRecipeReferenceOverride_userId_recipeId_key"
  on "ChefRecipeReferenceOverride" ("userId", "recipeId");
create index if not exists "ChefRecipeReferenceOverride_userId_idx" on "ChefRecipeReferenceOverride" ("userId");
create index if not exists "ChefRecipeReferenceOverride_recipeId_idx" on "ChefRecipeReferenceOverride" ("recipeId");

-- 参照変更履歴（監査）: 理由必須
create table if not exists "ChefRecipeReferenceAudit" (
  "id" text primary key default gen_random_uuid()::text,
  "companyId" text not null references "Company" ("id") on delete cascade,
  "targetUserId" text not null references "User" ("id") on delete cascade,
  "actorUserId" text not null references "User" ("id") on delete cascade,
  "recipeId" text not null references "Recipe" ("id") on delete cascade,
  "layer" text not null, -- 'chef' | 'override'
  "oldValue" boolean,
  "newValue" boolean,
  "reason" text not null,
  "createdAt" timestamptz not null default now()
);

create index if not exists "ChefRecipeReferenceAudit_companyId_idx" on "ChefRecipeReferenceAudit" ("companyId");
create index if not exists "ChefRecipeReferenceAudit_targetUserId_idx" on "ChefRecipeReferenceAudit" ("targetUserId");
create index if not exists "ChefRecipeReferenceAudit_recipeId_idx" on "ChefRecipeReferenceAudit" ("recipeId");
create index if not exists "ChefRecipeReferenceAudit_createdAt_idx" on "ChefRecipeReferenceAudit" ("createdAt");

do $$
begin
  execute 'drop trigger if exists set_updated_at_company on "Company"';
  execute 'drop trigger if exists set_updated_at_vessel on "Vessel"';
  execute 'drop trigger if exists set_updated_at_user on "User"';
  execute 'drop trigger if exists set_updated_at_ingredient on "Ingredient"';
  execute 'drop trigger if exists set_updated_at_procurement on "ProcurementAdjustment"';
  execute 'drop trigger if exists set_updated_at_recipe on "Recipe"';
  execute 'drop trigger if exists set_updated_at_menuplan on "MenuPlan"';
  execute 'drop trigger if exists set_updated_at_feedback on "MealFeedback"';
  execute 'drop trigger if exists set_updated_at_crewmember on "CrewMember"';
  execute 'drop trigger if exists set_updated_at_chef_recipe_reference on "ChefRecipeReference"';
  execute 'drop trigger if exists set_updated_at_chef_recipe_reference_override on "ChefRecipeReferenceOverride"';
end $$;

create trigger set_updated_at_company before update on "Company"
for each row execute procedure public.set_updated_at();
create trigger set_updated_at_vessel before update on "Vessel"
for each row execute procedure public.set_updated_at();
create trigger set_updated_at_user before update on "User"
for each row execute procedure public.set_updated_at();
create trigger set_updated_at_ingredient before update on "Ingredient"
for each row execute procedure public.set_updated_at();
create trigger set_updated_at_procurement before update on "ProcurementAdjustment"
for each row execute procedure public.set_updated_at();
create trigger set_updated_at_recipe before update on "Recipe"
for each row execute procedure public.set_updated_at();
create trigger set_updated_at_menuplan before update on "MenuPlan"
for each row execute procedure public.set_updated_at();
create trigger set_updated_at_feedback before update on "MealFeedback"
for each row execute procedure public.set_updated_at();
create trigger set_updated_at_crewmember before update on "CrewMember"
for each row execute procedure public.set_updated_at();
create trigger set_updated_at_chef_recipe_reference before update on "ChefRecipeReference"
for each row execute procedure public.set_updated_at();
create trigger set_updated_at_chef_recipe_reference_override before update on "ChefRecipeReferenceOverride"
for each row execute procedure public.set_updated_at();

alter table "Company" disable row level security;
alter table "Vessel" disable row level security;
alter table "User" disable row level security;
alter table "UserVesselMembership" disable row level security;
alter table "Session" disable row level security;
alter table "Ingredient" disable row level security;
alter table "ProcurementAdjustment" disable row level security;
alter table "Recipe" disable row level security;
alter table "RecipeIngredient" disable row level security;
alter table "MenuPlan" disable row level security;
alter table "MenuPlanRecipe" disable row level security;
alter table "MealFeedback" disable row level security;
alter table "CrewMember" disable row level security;
alter table "RecipeExclusion" disable row level security;
alter table "ChefRecipeReference" disable row level security;
alter table "ChefRecipeReferenceOverride" disable row level security;
alter table "ChefRecipeReferenceAudit" disable row level security;
