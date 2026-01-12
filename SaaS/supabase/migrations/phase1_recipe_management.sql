alter table "Recipe" add column if not exists "source" text not null default 'my';
alter table "Recipe" add column if not exists "status" text not null default 'published';
alter table "Recipe" add column if not exists "referenceEnabled" boolean not null default false;
alter table "Recipe" add column if not exists "originMasterId" text;
alter table "Recipe" add column if not exists "draftText" text;

alter table "Recipe" alter column "name" drop not null;
alter table "Recipe" alter column "category" drop not null;
alter table "Recipe" alter column "calories" drop not null;
alter table "Recipe" alter column "protein" drop not null;
alter table "Recipe" alter column "salt" drop not null;
alter table "Recipe" alter column "costPerServing" drop not null;

create index if not exists "Recipe_status_idx" on "Recipe" ("status");
create index if not exists "Recipe_source_idx" on "Recipe" ("source");

update "Recipe"
set "referenceEnabled" = true
where "companyId" is not null
  and "status" = 'published';
