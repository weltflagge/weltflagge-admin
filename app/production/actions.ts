"use server";

import { revalidatePath } from "next/cache";
import type { ManufacturerId } from "@/src/types/production";
import { getBatchNumber } from "@/src/lib/production-db";
import { getPrisma, hasDatabaseUrl } from "@/src/lib/prisma";

type ActiveManufacturer = Exclude<ManufacturerId, "needs_review">;

type ProductionActionResult = {
  ok: boolean;
  error?: string;
  batchId?: string;
};

const manufacturerDbCodeByUiId: Record<ActiveManufacturer, "OPINION" | "LOGO_PL" | "MPH_MACIEJ"> = {
  opinion: "OPINION",
  logo_pl: "LOGO_PL",
  mph_maciej: "MPH_MACIEJ",
};

async function ensureManufacturer(manufacturer: ActiveManufacturer) {
  const prisma = getPrisma();
  const manufacturerCode = manufacturerDbCodeByUiId[manufacturer];

  return prisma.manufacturer.upsert({
    where: { code: manufacturerCode },
    update: {},
    create: {
      code: manufacturerCode,
      name: manufacturer === "opinion" ? "Opinion" : manufacturer === "logo_pl" ? "Logo.pl" : "MPH - Maciej",
      exportFormat: `${manufacturer}-xlsx`,
    },
  });
}

export async function assignProductionManufacturer(input: {
  rowId: string;
  manufacturer: ActiveManufacturer;
}): Promise<ProductionActionResult> {
  if (!hasDatabaseUrl()) {
    return { ok: false, error: "DATABASE_URL is not configured yet." };
  }

  const prisma = getPrisma();
  const manufacturer = await ensureManufacturer(input.manufacturer);

  const item = await prisma.orderItem.findUnique({
    where: { id: input.rowId },
    include: { order: true },
  });

  if (!item) {
    return { ok: false, error: "Production row was not found in the database." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderItemProductionState.upsert({
      where: { orderItemId: item.id },
      create: {
        orderItemId: item.id,
        manufacturerId: manufacturer.id,
        status: "DRAFT",
        manuallyAssigned: true,
        routingReason: `Manual assignment to ${manufacturer.name}.`,
      },
      update: {
        manufacturerId: manufacturer.id,
        status: "DRAFT",
        manuallyAssigned: true,
        routingReason: `Manual assignment to ${manufacturer.name}.`,
      },
    });

    await tx.activityLog.create({
      data: {
        entityType: "ORDER_ITEM",
        actor: "Operator",
        message: `Production item assigned to ${manufacturer.name}.`,
        orderId: item.orderId,
        orderItemId: item.id,
      },
    });
  });

  revalidatePath("/production");
  revalidatePath(`/orders/${item.order.orderNumber}`);

  return { ok: true };
}

export async function createProductionDraftBatch(input: {
  manufacturer: ActiveManufacturer;
  rowIds: string[];
}): Promise<ProductionActionResult> {
  if (!hasDatabaseUrl()) {
    return { ok: false, error: "DATABASE_URL is not configured yet." };
  }

  const rowIds = [...new Set(input.rowIds)];

  if (!rowIds.length) {
    return { ok: false, error: "No production rows selected for this batch." };
  }

  const prisma = getPrisma();
  const manufacturer = await ensureManufacturer(input.manufacturer);
  const batchNumber = getBatchNumber(input.manufacturer);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const batch = await tx.productionBatch.upsert({
      where: { batchNumber },
      create: {
        batchNumber,
        manufacturerId: manufacturer.id,
        date: now,
        status: "DRAFT",
      },
      update: {
        manufacturerId: manufacturer.id,
        status: "DRAFT",
      },
    });

    await tx.productionBatchItem.deleteMany({
      where: { batchId: batch.id },
    });

    await Promise.all(
      rowIds.map((rowId, index) =>
        tx.productionBatchItem.create({
          data: {
            batchId: batch.id,
            orderItemId: rowId,
            position: index + 1,
          },
        })
      )
    );

    await Promise.all(
      rowIds.map((rowId) =>
        tx.orderItemProductionState.upsert({
          where: { orderItemId: rowId },
          create: {
            orderItemId: rowId,
            manufacturerId: manufacturer.id,
            currentBatchId: batch.id,
            status: "DRAFT",
          },
          update: {
            manufacturerId: manufacturer.id,
            currentBatchId: batch.id,
            status: "DRAFT",
          },
        })
      )
    );
  });

  revalidatePath("/production");

  return { ok: true, batchId: batchNumber };
}

export async function sendProductionBatch(input: {
  manufacturer: ActiveManufacturer;
  rowIds: string[];
}): Promise<ProductionActionResult> {
  if (!hasDatabaseUrl()) {
    return { ok: false, error: "DATABASE_URL is not configured yet." };
  }

  const draftResult = await createProductionDraftBatch(input);

  if (!draftResult.ok) {
    return draftResult;
  }

  const prisma = getPrisma();
  const batchNumber = draftResult.batchId ?? getBatchNumber(input.manufacturer);
  const now = new Date();

  const batch = await prisma.productionBatch.findUnique({
    where: { batchNumber },
    include: { items: true },
  });

  if (!batch) {
    return { ok: false, error: "Batch was not found after draft creation." };
  }

  const rowIds = batch.items.map((item) => item.orderItemId);

  await prisma.$transaction(async (tx) => {
    await tx.productionBatch.update({
      where: { id: batch.id },
      data: {
        status: "SENT_TO_MANUFACTURER",
        sentAt: now,
      },
    });

    await tx.orderItemProductionState.updateMany({
      where: { orderItemId: { in: rowIds } },
      data: {
        status: "SENT",
        currentBatchId: batch.id,
        sentAt: now,
      },
    });

    await tx.activityLog.create({
      data: {
        entityType: "PRODUCTION_BATCH",
        actor: "Operator",
        message: `Production batch ${batchNumber} sent to manufacturer.`,
        productionBatchId: batch.id,
      },
    });
  });

  revalidatePath("/production");
  revalidatePath("/orders");

  return { ok: true, batchId: batchNumber };
}
