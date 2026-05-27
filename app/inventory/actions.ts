"use server";

import { revalidatePath } from "next/cache";
import { changeInventoryStock, createInventoryItem, createInventoryReorderDraft, updateInventoryItemSettings, upsertInventoryItems } from "@/src/lib/inventory";
import { hasDatabaseUrl } from "@/src/lib/prisma";

type InventoryActionResult = {
  ok: boolean;
  error?: string;
};

function requireDatabase(): InventoryActionResult | null {
  return hasDatabaseUrl() ? null : { ok: false, error: "DATABASE_URL is not configured yet." };
}

export async function adjustInventoryStock(input: {
  inventoryItemId: string;
  mode: "add" | "reduce" | "correct";
  quantity: number;
  note: string;
}): Promise<InventoryActionResult> {
  const databaseError = requireDatabase();
  if (databaseError) {
    return databaseError;
  }

  try {
    await changeInventoryStock({ ...input, createdBy: "Operator" });
    revalidatePath("/inventory");
    revalidatePath("/orders");
    revalidatePath("/production");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Stock change could not be saved." };
  }
}

export async function addInventoryItem(input: {
  sku: string;
  name: string;
  category: string;
  form: string;
  size: string;
  currentStock: number;
  minimumStock: number;
  reorderNote: string;
}): Promise<InventoryActionResult> {
  const databaseError = requireDatabase();
  if (databaseError) {
    return databaseError;
  }

  try {
    await createInventoryItem(input);
    revalidatePath("/inventory");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Inventory item could not be created." };
  }
}

export async function saveInventoryItemSettings(input: {
  inventoryItemId: string;
  minimumStock: number;
  reorderNote: string;
}): Promise<InventoryActionResult> {
  const databaseError = requireDatabase();
  if (databaseError) {
    return databaseError;
  }

  try {
    await updateInventoryItemSettings(input);
    revalidatePath("/inventory");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Inventory item could not be saved." };
  }
}

export async function createReorderDraft(input: { inventoryItemId: string }): Promise<InventoryActionResult & { orderNumber?: string }> {
  const databaseError = requireDatabase();
  if (databaseError) {
    return databaseError;
  }

  try {
    const orderNumber = await createInventoryReorderDraft(input);
    revalidatePath("/inventory");
    revalidatePath("/orders");
    revalidatePath(`/orders/${orderNumber}`);
    return { ok: true, orderNumber };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Reorder draft could not be created." };
  }
}

export async function importInventoryCsv(input: { csvText: string }): Promise<InventoryActionResult> {
  const databaseError = requireDatabase();
  if (databaseError) {
    return databaseError;
  }

  const rows = input.csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(line.includes("\t") ? "\t" : ",").map((value) => value.trim()))
    .filter((columns) => columns.length >= 5)
    .map(([sku, name, form, size, currentStock, category, reorderNote]) => ({
      sku,
      name,
      form,
      size,
      currentStock: Number.parseInt(currentStock, 10) || 0,
      category: category || "Beachflag",
      reorderNote: reorderNote || "",
    }));

  if (!rows.length) {
    return { ok: false, error: "No import rows found. Use: SKU, name, form, size, current stock, category, reorder note." };
  }

  try {
    await upsertInventoryItems(rows);
    revalidatePath("/inventory");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Inventory import failed." };
  }
}
