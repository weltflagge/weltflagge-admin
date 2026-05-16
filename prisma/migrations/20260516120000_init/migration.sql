-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('WOOCOMMERCE_WELTFLAGGE', 'WOOCOMMERCE_PARTNER', 'EBAY', 'EMAIL');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'PAYMENT_OPEN', 'PRINT_FILES_MISSING', 'PRINT_FILES_REVIEW', 'CUSTOMER_REPLY_NEEDED', 'APPROVAL_MISSING', 'PRODUCTION_READY', 'IN_PRODUCTION', 'READY_TO_SHIP', 'SHIPPED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderPriority" AS ENUM ('NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'OPEN', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PrintFileStatus" AS ENUM ('MISSING', 'RECEIVED', 'APPROVED', 'PROBLEM');

-- CreateEnum
CREATE TYPE "ManufacturerCode" AS ENUM ('OPINION', 'LOGO_PL', 'MPH_MACIEJ');

-- CreateEnum
CREATE TYPE "OrderItemProductionStatus" AS ENUM ('NOT_ROUTED', 'DRAFT', 'SENT', 'CONFIRMED', 'IN_PRODUCTION', 'PRODUCED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "ProductionBatchStatus" AS ENUM ('DRAFT', 'SENT_TO_MANUFACTURER', 'CONFIRMED', 'IN_PRODUCTION', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActivityEntityType" AS ENUM ('ORDER', 'ORDER_ITEM', 'PRODUCTION_BATCH');

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "source" "OrderSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "deadlineAt" TIMESTAMP(3),
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "paymentStatus" "PaymentStatus" NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "priority" "OrderPriority" NOT NULL DEFAULT 'NORMAL',
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "internalNotes" TEXT,
    "rawPayload" JSONB,
    "billingAddressId" TEXT,
    "shippingAddressId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "company" TEXT,
    "name" TEXT,
    "street" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "sku" TEXT,
    "material" TEXT,
    "size" TEXT,
    "quantity" INTEGER NOT NULL,
    "finishing" TEXT,
    "unitAmountCents" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintFile" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "status" "PrintFileStatus" NOT NULL DEFAULT 'MISSING',
    "fileName" TEXT,
    "fileUrl" TEXT,
    "source" TEXT,
    "checkedAt" TIMESTAMP(3),
    "checkedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manufacturer" (
    "id" TEXT NOT NULL,
    "code" "ManufacturerCode" NOT NULL,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT,
    "specialty" TEXT,
    "exportFormat" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manufacturer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManufacturerRoutingRule" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productPattern" TEXT,
    "skuPattern" TEXT,
    "materialPattern" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManufacturerRoutingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemProductionState" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "manufacturerId" TEXT,
    "status" "OrderItemProductionStatus" NOT NULL DEFAULT 'NOT_ROUTED',
    "currentBatchId" TEXT,
    "routingReason" TEXT,
    "manuallyAssigned" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "producedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItemProductionState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionBatch" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "ProductionBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "exportFileName" TEXT,
    "sentAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionBatchItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "exportSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionBatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "entityType" "ActivityEntityType" NOT NULL,
    "message" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "metadata" JSONB,
    "orderId" TEXT,
    "orderItemId" TEXT,
    "productionBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_status_priority_idx" ON "Order"("status", "priority");

-- CreateIndex
CREATE INDEX "Order_receivedAt_idx" ON "Order"("receivedAt");

-- CreateIndex
CREATE INDEX "Order_deadlineAt_idx" ON "Order"("deadlineAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_source_externalId_key" ON "Order"("source", "externalId");

-- CreateIndex
CREATE INDEX "OrderItem_sku_idx" ON "OrderItem"("sku");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_sku_idx" ON "OrderItem"("orderId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_orderId_lineNumber_key" ON "OrderItem"("orderId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PrintFile_orderItemId_key" ON "PrintFile"("orderItemId");

-- CreateIndex
CREATE INDEX "PrintFile_status_idx" ON "PrintFile"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Manufacturer_code_key" ON "Manufacturer"("code");

-- CreateIndex
CREATE INDEX "ManufacturerRoutingRule_active_priority_idx" ON "ManufacturerRoutingRule"("active", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItemProductionState_orderItemId_key" ON "OrderItemProductionState"("orderItemId");

-- CreateIndex
CREATE INDEX "OrderItemProductionState_status_idx" ON "OrderItemProductionState"("status");

-- CreateIndex
CREATE INDEX "OrderItemProductionState_manufacturerId_idx" ON "OrderItemProductionState"("manufacturerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionBatch_batchNumber_key" ON "ProductionBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "ProductionBatch_manufacturerId_status_idx" ON "ProductionBatch"("manufacturerId", "status");

-- CreateIndex
CREATE INDEX "ProductionBatch_date_idx" ON "ProductionBatch"("date");

-- CreateIndex
CREATE INDEX "ProductionBatchItem_orderItemId_idx" ON "ProductionBatchItem"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionBatchItem_batchId_orderItemId_key" ON "ProductionBatchItem"("batchId", "orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionBatchItem_batchId_position_key" ON "ProductionBatchItem"("batchId", "position");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_createdAt_idx" ON "ActivityLog"("entityType", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_orderId_createdAt_idx" ON "ActivityLog"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_orderItemId_createdAt_idx" ON "ActivityLog"("orderItemId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_productionBatchId_createdAt_idx" ON "ActivityLog"("productionBatchId", "createdAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_billingAddressId_fkey" FOREIGN KEY ("billingAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shippingAddressId_fkey" FOREIGN KEY ("shippingAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintFile" ADD CONSTRAINT "PrintFile_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturerRoutingRule" ADD CONSTRAINT "ManufacturerRoutingRule_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemProductionState" ADD CONSTRAINT "OrderItemProductionState_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemProductionState" ADD CONSTRAINT "OrderItemProductionState_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemProductionState" ADD CONSTRAINT "OrderItemProductionState_currentBatchId_fkey" FOREIGN KEY ("currentBatchId") REFERENCES "ProductionBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatchItem" ADD CONSTRAINT "ProductionBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatchItem" ADD CONSTRAINT "ProductionBatchItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_productionBatchId_fkey" FOREIGN KEY ("productionBatchId") REFERENCES "ProductionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
