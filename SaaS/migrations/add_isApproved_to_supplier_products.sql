-- ============================================
-- SupplierProduct テーブルに isApproved カラムを追加
-- ============================================

-- 既存のテーブルに isApproved カラムを追加
ALTER TABLE "SupplierProduct" 
ADD COLUMN IF NOT EXISTS "isApproved" BOOLEAN DEFAULT FALSE NOT NULL;

-- インデックスを作成
CREATE INDEX IF NOT EXISTS "SupplierProduct_isApproved_idx" ON "SupplierProduct"("isApproved");

-- 既存のサンプルデータを承認済みに更新
UPDATE "SupplierProduct" 
SET "isApproved" = TRUE 
WHERE "supplierId" IN ('supplier-sasebo-1', 'supplier-fukuoka-1', 'supplier-nagasaki-1');
