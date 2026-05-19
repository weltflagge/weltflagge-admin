CREATE TYPE "OrderImportStatus" AS ENUM ('PENDING', 'NEEDS_REVIEW', 'APPROVED', 'SKIPPED', 'ERROR');

CREATE TABLE "OrderImport" (
    "id" TEXT NOT NULL,
    "source" "OrderSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" "OrderImportStatus" NOT NULL DEFAULT 'PENDING',
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "normalizedPayload" JSONB NOT NULL,
    "warnings" JSONB,
    "reviewNotes" TEXT,
    "approvedOrderId" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderImport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderImport_source_externalId_key" ON "OrderImport"("source", "externalId");
CREATE INDEX "OrderImport_status_receivedAt_idx" ON "OrderImport"("status", "receivedAt");
CREATE INDEX "OrderImport_orderNumber_idx" ON "OrderImport"("orderNumber");

ALTER TABLE "OrderImport" ADD CONSTRAINT "OrderImport_approvedOrderId_fkey" FOREIGN KEY ("approvedOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
