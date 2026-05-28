"use server";

import { revalidatePath } from "next/cache";
import { syncImportSource, type ImportSourceId } from "@/src/lib/import-sync";
import { createOrderFromImport, reopenOrderImport, skipOrderImport, type NormalizedImportOrder } from "@/src/lib/order-imports";

export async function syncWeltflaggeWooOrders() {
  return syncImportedOrdersSource("woocommerce-weltflagge");
}

export async function syncImportedOrdersSource(source: ImportSourceId) {
  const result = await syncImportSource(source);
  revalidatePath("/imports");

  return { ok: result.ok, message: result.message, error: result.ok ? undefined : result.message };
}

export async function approveImportedOrder(importId: string, input: NormalizedImportOrder) {
  const result = await createOrderFromImport(importId, input);

  if (result.ok) {
    revalidatePath("/imports");
    revalidatePath("/orders");
    revalidatePath(`/orders/${result.orderNumber}`);
  }

  return result;
}

export async function skipImportedOrder(importId: string) {
  const result = await skipOrderImport(importId);

  if (result.ok) {
    revalidatePath("/imports");
  }

  return result;
}

export async function reopenImportedOrder(importId: string) {
  const result = await reopenOrderImport(importId);

  if (result.ok) {
    revalidatePath("/imports");
  }

  return result;
}
