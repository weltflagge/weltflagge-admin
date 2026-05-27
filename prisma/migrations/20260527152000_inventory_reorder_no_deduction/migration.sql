ALTER TYPE "InventoryMovementReason" ADD VALUE IF NOT EXISTS 'REORDER_RECEIPT';

ALTER TABLE "OrderItem"
ADD COLUMN "inventoryDeductionDisabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE "OrderItem"
SET "inventoryDeductionDisabled" = true,
    "itemType" = 'PRODUCTION_ITEM'
WHERE "orderId" IN (
  SELECT "id" FROM "Order" WHERE "source" = 'LAGER_REORDER'
);
