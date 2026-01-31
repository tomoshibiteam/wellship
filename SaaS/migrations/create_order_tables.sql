-- Create Order table
CREATE TABLE IF NOT EXISTS "Order" (
  "id" TEXT PRIMARY KEY,
  "orderNumber" TEXT UNIQUE NOT NULL,
  "vesselId" TEXT NOT NULL REFERENCES "Vessel"("id") ON DELETE CASCADE,
  "totalAmount" INTEGER DEFAULT 0 NOT NULL,
  "itemCount" INTEGER DEFAULT 0 NOT NULL,
  "status" TEXT DEFAULT 'DRAFT' NOT NULL,
  "deliveryDate" TIMESTAMP,
  "deliveredAt" TIMESTAMP,
  "shippingNote" TEXT,
  "confirmedAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for Order table
CREATE INDEX IF NOT EXISTS "Order_vesselId_idx" ON "Order"("vesselId");
CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order"("status");
CREATE INDEX IF NOT EXISTS "Order_deliveryDate_idx" ON "Order"("deliveryDate");

-- Create OrderItem table
CREATE TABLE IF NOT EXISTS "OrderItem" (
  "id" TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
  "ingredientId" TEXT NOT NULL REFERENCES "Ingredient"("id"),
  "quantity" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL,
  "snapshotPrice" INTEGER NOT NULL,
  "subtotal" INTEGER NOT NULL,
  "isBonus" BOOLEAN DEFAULT FALSE NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create unique constraint and indexes for OrderItem table
CREATE UNIQUE INDEX IF NOT EXISTS "OrderItem_orderId_ingredientId_key" ON "OrderItem"("orderId", "ingredientId");
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_ingredientId_idx" ON "OrderItem"("ingredientId");

-- Create trigger to update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_order_updated_at BEFORE UPDATE ON "Order"
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
