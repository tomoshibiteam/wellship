-- Add missing columns to Ingredient table for merchant platform features
ALTER TABLE "Ingredient" 
ADD COLUMN IF NOT EXISTS "price" INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS "isBonus" BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS "supplierId" TEXT;

-- Create index for supplierId
CREATE INDEX IF NOT EXISTS "Ingredient_supplierId_idx" ON "Ingredient"("supplierId");

-- Create index for isBonus
CREATE INDEX IF NOT EXISTS "Ingredient_isBonus_idx" ON "Ingredient"("isBonus");

-- Add foreign key constraint for supplierId (if Supplier table exists)
-- Note: This will fail if Supplier table doesn't exist yet, which is fine
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Supplier') THEN
        ALTER TABLE "Ingredient" 
        ADD CONSTRAINT "Ingredient_supplierId_fkey" 
        FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL;
    END IF;
END $$;
