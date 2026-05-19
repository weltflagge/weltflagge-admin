"use server";

import { revalidatePath } from "next/cache";
import { createOrderFromImport, type NormalizedImportOrder, upsertOrderImport } from "@/src/lib/order-imports";
import { fetchWeltflaggeWooOrders } from "@/src/lib/woocommerce";

export async function syncWeltflaggeWooOrders() {
  try {
    const orders = await fetchWeltflaggeWooOrders();

    for (const order of orders) {
      await upsertOrderImport(order);
    }

    revalidatePath("/imports");

    return { ok: true, message: `${orders.length} WooCommerce rendelés szinkronizálva.` };
  } catch (error) {
    console.error("WooCommerce sync failed.", error);
    return { ok: false, error: error instanceof Error ? error.message : "WooCommerce sync sikertelen." };
  }
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
