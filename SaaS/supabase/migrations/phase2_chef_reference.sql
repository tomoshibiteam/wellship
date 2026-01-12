-- Phase2: 司厨セット（恒久参照） + 会社強制（override） + 監査ログ

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

create table if not exists "ChefRecipeReferenceAudit" (
  "id" text primary key default gen_random_uuid()::text,
  "companyId" text not null references "Company" ("id") on delete cascade,
  "targetUserId" text not null references "User" ("id") on delete cascade,
  "actorUserId" text not null references "User" ("id") on delete cascade,
  "recipeId" text not null references "Recipe" ("id") on delete cascade,
  "layer" text not null,
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
  execute 'drop trigger if exists set_updated_at_chef_recipe_reference on "ChefRecipeReference"';
  execute 'drop trigger if exists set_updated_at_chef_recipe_reference_override on "ChefRecipeReferenceOverride"';
end $$;

create trigger set_updated_at_chef_recipe_reference before update on "ChefRecipeReference"
for each row execute procedure public.set_updated_at();
create trigger set_updated_at_chef_recipe_reference_override before update on "ChefRecipeReferenceOverride"
for each row execute procedure public.set_updated_at();

alter table "ChefRecipeReference" disable row level security;
alter table "ChefRecipeReferenceOverride" disable row level security;
alter table "ChefRecipeReferenceAudit" disable row level security;

-- 既存の「会社共通 referenceEnabled」を、各司厨の恒久参照へ移行（初期値）
insert into "ChefRecipeReference" ("userId", "recipeId", "enabled")
select u."id", r."id", true
from "User" u
join "Recipe" r
  on r."companyId" = u."companyId"
where u."role" = 'CHEF'
  and r."companyId" is not null
  and r."source" = 'my'
  and r."status" = 'published'
  and r."referenceEnabled" = true
on conflict ("userId", "recipeId") do nothing;

