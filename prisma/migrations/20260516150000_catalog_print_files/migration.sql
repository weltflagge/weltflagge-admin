-- Add WMD and support multiple print files per order item.

CREATE TYPE "PrintFileSide" AS ENUM ('FRONT', 'BACK', 'GENERAL');

ALTER TYPE "ManufacturerCode" ADD VALUE IF NOT EXISTS 'WMD';

DROP INDEX IF EXISTS "PrintFile_orderItemId_key";

ALTER TABLE "PrintFile"
ADD COLUMN "side" "PrintFileSide" NOT NULL DEFAULT 'FRONT';

CREATE UNIQUE INDEX "PrintFile_orderItemId_side_key" ON "PrintFile"("orderItemId", "side");
