-- ============================================
-- 食材と商品を名前で紐付ける（PoCデモ用）
-- ============================================

-- トマト
UPDATE "SupplierProduct"
SET "ingredientId" = (SELECT id FROM "Ingredient" WHERE name = 'トマト' LIMIT 1)
WHERE "productName" LIKE '%トマト%';

-- 玉ねぎ
UPDATE "SupplierProduct"
SET "ingredientId" = (SELECT id FROM "Ingredient" WHERE name = '玉ねぎ' LIMIT 1)
WHERE "productName" LIKE '%玉ねぎ%';

-- じゃがいも
UPDATE "SupplierProduct"
SET "ingredientId" = (SELECT id FROM "Ingredient" WHERE name = 'じゃがいも' LIMIT 1)
WHERE "productName" LIKE '%じゃがいも%';

-- キャベツ
UPDATE "SupplierProduct"
SET "ingredientId" = (SELECT id FROM "Ingredient" WHERE name = 'キャベツ' LIMIT 1)
WHERE "productName" LIKE '%キャベツ%';

-- 豚バラ肉
UPDATE "SupplierProduct"
SET "ingredientId" = (SELECT id FROM "Ingredient" WHERE name = '豚バラ肉' LIMIT 1)
WHERE "productName" LIKE '%豚バラ肉%';

-- 白米
UPDATE "SupplierProduct"
SET "ingredientId" = (SELECT id FROM "Ingredient" WHERE name = '白米' LIMIT 1)
WHERE "productName" LIKE '%白米%';

-- 醤油
UPDATE "SupplierProduct"
SET "ingredientId" = (SELECT id FROM "Ingredient" WHERE name = '濃口醤油' LIMIT 1)
WHERE "productName" LIKE '%醤油%';

-- みりん
UPDATE "SupplierProduct"
SET "ingredientId" = (SELECT id FROM "Ingredient" WHERE name = '本みりん' LIMIT 1)
WHERE "productName" LIKE '%みりん%';

-- アジ
UPDATE "SupplierProduct"
SET "ingredientId" = (SELECT id FROM "Ingredient" WHERE name = 'アジ' OR name = '鰺' LIMIT 1)
WHERE "productName" LIKE '%アジ%';

-- サバ
UPDATE "SupplierProduct"
SET "ingredientId" = (SELECT id FROM "Ingredient" WHERE name = 'サバ' OR name = '鯖' LIMIT 1)
WHERE "productName" LIKE '%サバ%';
