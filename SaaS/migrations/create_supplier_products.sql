-- ============================================
-- 1. Supplier テーブルに deliveryPorts カラムを追加
-- ============================================
ALTER TABLE "Supplier" 
ADD COLUMN IF NOT EXISTS "deliveryPorts" TEXT;

-- ============================================
-- 2. SupplierProduct テーブルを作成
-- ============================================
CREATE TABLE IF NOT EXISTS "SupplierProduct" (
  "id" TEXT PRIMARY KEY,
  
  -- サプライヤー
  "supplierId" TEXT NOT NULL REFERENCES "Supplier"("id") ON DELETE CASCADE,
  
  -- 対応する食材（オプション）
  "ingredientId" TEXT REFERENCES "Ingredient"("id") ON DELETE SET NULL,
  
  -- 商品情報
  "productName" TEXT NOT NULL,
  "productCode" TEXT,
  "description" TEXT,
  "category" TEXT,
  
  -- 価格・単位
  "price" INTEGER NOT NULL,
  "unit" TEXT NOT NULL,
  "minOrderQty" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "maxOrderQty" DOUBLE PRECISION,
  
  -- 在庫・可用性
  "isAvailable" BOOLEAN NOT NULL DEFAULT TRUE,
  "stockQty" DOUBLE PRECISION,
  "leadDays" INTEGER NOT NULL DEFAULT 1,
  
  -- 画像
  "imageUrl" TEXT,
  
  -- タイムスタンプ
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- 3. インデックスを作成
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS "SupplierProduct_supplierId_productCode_key" 
  ON "SupplierProduct"("supplierId", "productCode") 
  WHERE "productCode" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "SupplierProduct_supplierId_idx" ON "SupplierProduct"("supplierId");
CREATE INDEX IF NOT EXISTS "SupplierProduct_ingredientId_idx" ON "SupplierProduct"("ingredientId");
CREATE INDEX IF NOT EXISTS "SupplierProduct_category_idx" ON "SupplierProduct"("category");
CREATE INDEX IF NOT EXISTS "SupplierProduct_isAvailable_idx" ON "SupplierProduct"("isAvailable");

-- ============================================
-- 4. updatedAt 自動更新トリガー
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_supplier_product_updated_at ON "SupplierProduct";
CREATE TRIGGER update_supplier_product_updated_at 
  BEFORE UPDATE ON "SupplierProduct"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. サンプルサプライヤーを追加（PoCデモ用）
-- ============================================
INSERT INTO "Supplier" ("id", "name", "code", "email", "phone", "address", "isActive", "deliveryPorts", "createdAt", "updatedAt")
VALUES 
  ('supplier-sasebo-1', '佐世保食品センター', 'SASEBO-001', 'info@sasebo-foods.example.com', '0956-XX-XXXX', '長崎県佐世保市港町1-1', true, '佐世保港,長崎港', NOW(), NOW()),
  ('supplier-fukuoka-1', '九州青果卸売', 'FUKUOKA-001', 'order@kyushu-seika.example.com', '092-XXX-XXXX', '福岡県福岡市中央区市場1-1', true, '博多港,北九州港,佐世保港', NOW(), NOW()),
  ('supplier-nagasaki-1', '長崎海産物', 'NAGASAKI-001', 'sales@nagasaki-kaisan.example.com', '095-XXX-XXXX', '長崎県長崎市港町2-3', true, '長崎港,佐世保港', NOW(), NOW())
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "deliveryPorts" = EXCLUDED."deliveryPorts",
  "updatedAt" = NOW();

-- ============================================
-- 6. サンプル商品を追加（PoCデモ用）
-- ============================================
-- 佐世保食品センターの商品
INSERT INTO "SupplierProduct" ("id", "supplierId", "productName", "productCode", "category", "price", "unit", "minOrderQty", "isAvailable", "leadDays", "createdAt", "updatedAt")
VALUES
  ('prod-sasebo-001', 'supplier-sasebo-1', '熊本産トマト 5kg箱', 'TM-001', '野菜', 2500, 'kg', 5, true, 1, NOW(), NOW()),
  ('prod-sasebo-002', 'supplier-sasebo-1', '九州産玉ねぎ 3kg袋', 'ON-001', '野菜', 900, 'kg', 3, true, 1, NOW(), NOW()),
  ('prod-sasebo-003', 'supplier-sasebo-1', '国産豚バラ肉 2kg', 'PK-001', '肉', 3200, 'kg', 2, true, 1, NOW(), NOW()),
  ('prod-sasebo-004', 'supplier-sasebo-1', '長崎県産じゃがいも 5kg', 'PT-001', '野菜', 1200, 'kg', 5, true, 1, NOW(), NOW()),
  ('prod-sasebo-005', 'supplier-sasebo-1', '九州産キャベツ 1玉', 'CB-001', '野菜', 280, '個', 1, true, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 九州青果卸売の商品
INSERT INTO "SupplierProduct" ("id", "supplierId", "productName", "productCode", "category", "price", "unit", "minOrderQty", "isAvailable", "leadDays", "createdAt", "updatedAt")
VALUES
  ('prod-fukuoka-001', 'supplier-fukuoka-1', '福岡産トマト 10kg箱', 'FK-TM-001', '野菜', 4200, 'kg', 10, true, 2, NOW(), NOW()),
  ('prod-fukuoka-002', 'supplier-fukuoka-1', '熊本産玉ねぎ 10kg箱', 'FK-ON-001', '野菜', 2800, 'kg', 10, true, 2, NOW(), NOW()),
  ('prod-fukuoka-003', 'supplier-fukuoka-1', '九州産にんじん 5kg', 'FK-CR-001', '野菜', 1500, 'kg', 5, true, 2, NOW(), NOW()),
  ('prod-fukuoka-004', 'supplier-fukuoka-1', '大根 3本セット', 'FK-RD-001', '野菜', 600, 'セット', 1, true, 2, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 長崎海産物の商品
INSERT INTO "SupplierProduct" ("id", "supplierId", "productName", "productCode", "category", "price", "unit", "minOrderQty", "isAvailable", "leadDays", "createdAt", "updatedAt")
VALUES
  ('prod-nagasaki-001', 'supplier-nagasaki-1', '長崎産アジ 2kg', 'NG-AJ-001', '魚', 2400, 'kg', 2, true, 1, NOW(), NOW()),
  ('prod-nagasaki-002', 'supplier-nagasaki-1', '五島産サバ 3kg', 'NG-SB-001', '魚', 3600, 'kg', 3, true, 1, NOW(), NOW()),
  ('prod-nagasaki-003', 'supplier-nagasaki-1', '対馬産イカ 2kg', 'NG-IK-001', '魚', 2800, 'kg', 2, true, 1, NOW(), NOW()),
  ('prod-nagasaki-004', 'supplier-nagasaki-1', '長崎産エビ 1kg', 'NG-EB-001', '魚', 3200, 'kg', 1, true, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;
