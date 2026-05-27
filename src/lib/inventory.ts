import { getPrisma, hasDatabaseUrl } from "./prisma";

export type InventoryStatus = "out_of_stock" | "low_stock" | "ok";
export type InventoryMovementReason =
  | "INITIAL_STOCK"
  | "MANUAL_CORRECTION"
  | "ORDER_DEDUCTION"
  | "SUPPLIER_DELIVERY"
  | "STOCK_RESET"
  | "MANUAL_REDUCTION";

export type InventoryItemView = {
  id: string;
  sku: string;
  name: string;
  category: string;
  form: string;
  size: string;
  currentStock: number;
  minimumStock: number;
  status: InventoryStatus;
  reorderNote: string;
  lastStockChangeAt: string;
};

export type InventoryMovementView = {
  id: string;
  inventoryItemId: string;
  itemName: string;
  changeAmount: number;
  previousStock: number;
  newStock: number;
  reason: InventoryMovementReason;
  note: string;
  orderNumber?: string;
  orderItemName?: string;
  createdAt: string;
  createdBy: string;
};

export type InventoryDashboard = {
  items: InventoryItemView[];
  movements: InventoryMovementView[];
  reorderItems: InventoryItemView[];
  forms: string[];
  sizes: string[];
  source: "database" | "empty";
};

const beachflagForms = ["Quill", "Feather", "Square"];
type InventoryLookupClient = Pick<ReturnType<typeof getPrisma>, "inventoryItem">;

function formatTimestamp(date: Date | null | undefined) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function getInventoryStatus(currentStock: number): InventoryStatus {
  if (currentStock <= 0) {
    return "out_of_stock";
  }

  if (currentStock <= 3) {
    return "low_stock";
  }

  return "ok";
}

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeSize(value: string | null | undefined) {
  const normalized = normalize(value);
  const size = normalized.match(/\b(xs|s|m|l|xl|xxl)\b/);
  return size?.[1]?.toUpperCase() ?? normalized.toUpperCase();
}

function inferBeachflagForm(productName: string | null | undefined, material: string | null | undefined) {
  const haystack = normalize(`${productName ?? ""} ${material ?? ""}`);
  return beachflagForms.find((form) => haystack.includes(form.toLowerCase()));
}

function isBeachflagSystem(item: { productName: string; sku: string | null; material: string | null; size: string | null }) {
  const haystack = normalize(`${item.productName} ${item.sku ?? ""} ${item.material ?? ""}`);
  return haystack.includes("beachflag") || haystack.includes("beach flag") || haystack.includes("bf ");
}

function mapInventoryItem(item: {
  id: string;
  sku: string;
  name: string;
  category: string;
  form: string;
  size: string;
  currentStock: number;
  minimumStock: number;
  reorderNote: string | null;
  lastStockChangeAt: Date | null;
}): InventoryItemView {
  return {
    id: item.id,
    sku: item.sku,
    name: item.name,
    category: item.category,
    form: item.form,
    size: item.size,
    currentStock: item.currentStock,
    minimumStock: item.minimumStock,
    status: getInventoryStatus(item.currentStock),
    reorderNote: item.reorderNote ?? "",
    lastStockChangeAt: formatTimestamp(item.lastStockChangeAt),
  };
}

export async function getInventoryDashboard(): Promise<InventoryDashboard> {
  if (!hasDatabaseUrl()) {
    return { items: [], movements: [], reorderItems: [], forms: [], sizes: [], source: "empty" };
  }

  const prisma = getPrisma();
  const [items, movements] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { category: "Beachflag" },
      orderBy: [{ form: "asc" }, { size: "asc" }, { sku: "asc" }],
    }),
    prisma.inventoryMovement.findMany({
      include: {
        inventoryItem: true,
        order: true,
        orderItem: true,
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
  ]);

  const mappedItems = items.map(mapInventoryItem);

  return {
    items: mappedItems,
    movements: movements.map((movement) => ({
      id: movement.id,
      inventoryItemId: movement.inventoryItemId,
      itemName: movement.inventoryItem.name,
      changeAmount: movement.changeAmount,
      previousStock: movement.previousStock,
      newStock: movement.newStock,
      reason: movement.reason as InventoryMovementReason,
      note: movement.note ?? "",
      orderNumber: movement.order?.orderNumber,
      orderItemName: movement.orderItem?.productName,
      createdAt: formatTimestamp(movement.createdAt),
      createdBy: movement.createdBy ?? "-",
    })),
    reorderItems: mappedItems.filter((item) => item.currentStock <= item.minimumStock),
    forms: [...new Set(mappedItems.map((item) => item.form))],
    sizes: [...new Set(mappedItems.map((item) => item.size))],
    source: "database",
  };
}

export async function findInventoryItemForOrderItem(
  item: { productName: string; sku: string | null; material: string | null; size: string | null; inventoryItemId?: string | null },
  tx: InventoryLookupClient = getPrisma()
) {
  if (item.inventoryItemId) {
    return tx.inventoryItem.findUnique({ where: { id: item.inventoryItemId } });
  }

  if (!isBeachflagSystem(item)) {
    return null;
  }

  if (item.sku) {
    const skuMatch = await tx.inventoryItem.findUnique({ where: { sku: item.sku } });
    if (skuMatch) {
      return skuMatch;
    }
  }

  const form = inferBeachflagForm(item.productName, item.material);
  const size = normalizeSize(item.size);

  if (form && size) {
    const formSizeMatch = await tx.inventoryItem.findFirst({
      where: {
        category: "Beachflag",
        form: { equals: form, mode: "insensitive" },
        size: { equals: size, mode: "insensitive" },
      },
    });

    if (formSizeMatch) {
      return formSizeMatch;
    }
  }

  if (!form || !size) {
    return null;
  }

  return tx.inventoryItem.findFirst({
    where: {
      category: "Beachflag",
      name: { contains: form, mode: "insensitive" },
      size: { equals: size, mode: "insensitive" },
    },
  });
}

export async function changeInventoryStock(input: {
  inventoryItemId: string;
  mode: "add" | "reduce" | "correct";
  quantity: number;
  note: string;
  createdBy?: string;
}) {
  const prisma = getPrisma();
  const quantity = Math.max(0, Math.trunc(input.quantity));

  if (!quantity && input.mode !== "correct") {
    throw new Error("Quantity must be greater than 0.");
  }

  return prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUnique({ where: { id: input.inventoryItemId } });

    if (!item) {
      throw new Error("Inventory item was not found.");
    }

    const previousStock = item.currentStock;
    const newStock =
      input.mode === "add" ? previousStock + quantity : input.mode === "reduce" ? previousStock - quantity : quantity;
    const changeAmount = newStock - previousStock;
    const reason: InventoryMovementReason =
      input.mode === "add" ? "SUPPLIER_DELIVERY" : input.mode === "reduce" ? "MANUAL_REDUCTION" : "MANUAL_CORRECTION";
    const now = new Date();

    await tx.inventoryItem.update({
      where: { id: item.id },
      data: {
        currentStock: newStock,
        lastStockChangeAt: now,
      },
    });

    return tx.inventoryMovement.create({
      data: {
        inventoryItemId: item.id,
        changeAmount,
        previousStock,
        newStock,
        reason,
        note: input.note.trim() || (input.mode === "correct" ? "Manual correction" : input.mode === "add" ? "Supplier delivery" : "Manual reduction"),
        createdBy: input.createdBy ?? "Operator",
        createdAt: now,
      },
    });
  });
}

export async function createInventoryItem(input: {
  sku: string;
  name: string;
  category: string;
  form: string;
  size: string;
  currentStock: number;
  minimumStock: number;
  reorderNote: string;
}) {
  const prisma = getPrisma();
  const sku = input.sku.trim();
  const name = input.name.trim();
  const form = input.form.trim();
  const size = input.size.trim().toUpperCase();
  const currentStock = Math.trunc(input.currentStock);
  const minimumStock = Math.max(0, Math.trunc(input.minimumStock));
  const now = new Date();

  if (!sku || !name || !form || !size) {
    throw new Error("SKU, name, form and size are required.");
  }

  return prisma.inventoryItem.create({
    data: {
      sku,
      name,
      category: input.category.trim() || "Beachflag",
      form,
      size,
      currentStock,
      minimumStock,
      reorderNote: input.reorderNote.trim() || null,
      lastStockChangeAt: now,
      movements: {
        create: {
          changeAmount: currentStock,
          previousStock: 0,
          newStock: currentStock,
          reason: "INITIAL_STOCK",
          note: "Initial stock",
          createdBy: "Operator",
          createdAt: now,
        },
      },
    },
  });
}

export async function updateInventoryItemSettings(input: {
  inventoryItemId: string;
  minimumStock: number;
  reorderNote: string;
}) {
  const prisma = getPrisma();
  return prisma.inventoryItem.update({
    where: { id: input.inventoryItemId },
    data: {
      minimumStock: Math.max(0, Math.trunc(input.minimumStock)),
      reorderNote: input.reorderNote.trim() || null,
    },
  });
}

export async function upsertInventoryItems(rows: Array<{
  sku: string;
  name: string;
  form: string;
  size: string;
  currentStock: number;
  category?: string;
  reorderNote?: string;
}>) {
  const prisma = getPrisma();
  const now = new Date();

  for (const row of rows) {
    const sku = row.sku.trim();
    if (!sku) {
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const existingItem = await tx.inventoryItem.findUnique({ where: { sku } });
      const nextStock = Math.trunc(row.currentStock);
      const itemData = {
        name: row.name.trim() || sku,
        category: row.category?.trim() || "Beachflag",
        form: row.form.trim(),
        size: row.size.trim().toUpperCase(),
        reorderNote: row.reorderNote?.trim() || null,
      };

      if (!existingItem) {
        await tx.inventoryItem.create({
          data: {
            sku,
            ...itemData,
            currentStock: nextStock,
            lastStockChangeAt: now,
            movements: {
              create: {
                changeAmount: nextStock,
                previousStock: 0,
                newStock: nextStock,
            reason: "INITIAL_STOCK",
            note: "Initial inventory import",
                createdBy: "Import",
                createdAt: now,
              },
            },
          },
        });
        return;
      }

      await tx.inventoryItem.update({
        where: { id: existingItem.id },
        data: {
          ...itemData,
          currentStock: nextStock,
          lastStockChangeAt: existingItem.currentStock === nextStock ? existingItem.lastStockChangeAt : now,
        },
      });

      if (existingItem.currentStock !== nextStock) {
        await tx.inventoryMovement.create({
          data: {
            inventoryItemId: existingItem.id,
            changeAmount: nextStock - existingItem.currentStock,
            previousStock: existingItem.currentStock,
            newStock: nextStock,
            reason: "STOCK_RESET",
            note: "Inventory import stock reset",
            createdBy: "Import",
            createdAt: now,
          },
        });
      }
    });
  }
}

export async function deductInventoryForOrderItems(input: {
  orderNumber?: string;
  orderItemIds?: string[];
  trigger: "ready_to_ship" | "sent_to_manufacturer";
}) {
  const prisma = getPrisma();
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const items = await tx.orderItem.findMany({
      where: {
        inventoryDeductedAt: null,
        ...(input.orderItemIds ? { id: { in: input.orderItemIds } } : {}),
        ...(input.orderNumber ? { order: { orderNumber: input.orderNumber } } : {}),
      },
      include: { order: true },
    });

    let deductedCount = 0;

    for (const item of items) {
      const inventoryItem = await findInventoryItemForOrderItem(item, tx);

      if (!inventoryItem) {
        continue;
      }

      const previousStock = inventoryItem.currentStock;
      const changeAmount = -item.quantity;
      const newStock = previousStock + changeAmount;
      const note = `Order ${item.order.orderNumber}`;

      await tx.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: {
          currentStock: newStock,
          lastStockChangeAt: now,
        },
      });

      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          inventoryItemId: inventoryItem.id,
          inventoryDeductedQuantity: item.quantity,
          inventoryDeductedAt: now,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          inventoryItemId: inventoryItem.id,
          changeAmount,
          previousStock,
          newStock,
          reason: "ORDER_DEDUCTION",
          note,
          orderId: item.orderId,
          orderItemId: item.id,
          createdBy: "System",
          createdAt: now,
        },
      });

      await tx.activityLog.create({
        data: {
          entityType: "ORDER_ITEM",
          actor: "System",
          message: `Lagerbestand abgezogen (${item.quantity}x ${inventoryItem.name}) via ${input.trigger}.`,
          orderId: item.orderId,
          orderItemId: item.id,
          createdAt: now,
        },
      });

      deductedCount += 1;
    }

    return deductedCount;
  });
}

export async function createInventoryReorderDraft(input: { inventoryItemId: string }) {
  const prisma = getPrisma();
  const item = await prisma.inventoryItem.findUnique({
    where: { id: input.inventoryItemId },
  });

  if (!item) {
    throw new Error("Inventory item was not found.");
  }

  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const orderNumber = `LR-${datePart}-${item.sku.replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase()}`;
  const suggestedQuantity = Math.max(item.minimumStock * 2 - item.currentStock, item.minimumStock, 1);

  const order = await prisma.order.upsert({
    where: { orderNumber },
    update: {
      internalNotes: `Lager Nachbestellung fuer ${item.name} (${item.sku}). Aktueller Bestand: ${item.currentStock}, Mindestbestand: ${item.minimumStock}.`,
    },
    create: {
      orderNumber,
      source: "LAGER_REORDER",
      externalId: `lager-reorder-${item.id}-${datePart}`,
      receivedAt: now,
      customerName: "Lager Nachbestellung",
      customerEmail: "lager@weltflagge.de",
      amountCents: 0,
      paymentStatus: "OPEN",
      status: "NEW",
      priority: item.currentStock <= 0 ? "HIGH" : "NORMAL",
      internalNotes: `Lager Nachbestellung fuer ${item.name} (${item.sku}). Aktueller Bestand: ${item.currentStock}, Mindestbestand: ${item.minimumStock}. Vorgeschlagene Menge: ${suggestedQuantity}.`,
      billingAddress: {
        create: {
          company: "Weltflagge Lager",
          name: "Lager Nachbestellung",
          country: "Germany",
        },
      },
      shippingAddress: {
        create: {
          company: "Weltflagge Lager",
          name: "Lager Nachbestellung",
          country: "Germany",
        },
      },
      items: {
        create: {
          lineNumber: 1,
          productName: item.name,
          sku: item.sku,
          material: `Beachflag ${item.form}`,
          size: item.size,
          quantity: suggestedQuantity,
          itemType: "ACCESSORY_ITEM",
          notes: `Reorder draft for inventory item ${item.id}. Current stock ${item.currentStock}, minimum stock ${item.minimumStock}.`,
          inventoryItemId: item.id,
        },
      },
      activityLogs: {
        create: {
          entityType: "ORDER",
          actor: "Operator",
          message: `Lager Nachbestellung fuer ${item.name} erstellt.`,
        },
      },
    },
  });

  return order.orderNumber;
}
