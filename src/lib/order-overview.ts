import { sourceLabels } from "@/src/lib/mock-orders";
import type { Order, OrderItem, OrderSource } from "@/src/types/order";

export type OrderNextActionTone = "danger" | "warning" | "ready" | "info" | "done" | "neutral";

export type OrderNextAction = {
  label: string;
  tone: OrderNextActionTone;
};

function getPrintFiles(item: OrderItem) {
  return item.printFiles?.length ? item.printFiles : [item.printFile];
}

export function isProductionItem(item: OrderItem) {
  return (item.itemType ?? "production_item") === "production_item";
}

export function getCompactSourceLabel(source: OrderSource) {
  if (source === "woocommerce-weltflagge" || source === "woocommerce-partner") {
    return "WooCommerce";
  }

  return sourceLabels[source];
}

export function getOrderItemSummary(order: Order) {
  const productionCount = order.items.filter(isProductionItem).length;
  const accessoryCount = order.items.filter((item) => item.itemType === "accessory_item").length;
  const serviceCount = order.items.filter((item) => item.itemType === "service_item").length;
  const shippingCount = order.items.filter((item) => item.itemType === "shipping_item").length;
  const parts: string[] = [];

  if (productionCount) {
    parts.push(`${productionCount} Produktionsartikel`);
  }

  if (accessoryCount) {
    parts.push(`${accessoryCount} Zubehoer`);
  }

  if (serviceCount) {
    parts.push(`${serviceCount} Service`);
  }

  if (shippingCount) {
    parts.push(`${shippingCount} Versand`);
  }

  return parts.join(" + ") || `${order.items.length} Positionen`;
}

export function getShortProductSummary(order: Order) {
  const firstProductionItem = order.items.find(isProductionItem) ?? order.items[0];
  const countSummary = getOrderItemSummary(order);

  if (!firstProductionItem) {
    return countSummary;
  }

  return `${firstProductionItem.name}${order.items.length > 1 ? ` - ${countSummary}` : ""}`;
}

export function getOrderNextAction(order: Order): OrderNextAction {
  const productionItems = order.items.filter(isProductionItem);
  const printFiles = productionItems.flatMap(getPrintFiles);

  if (order.status === "Cancelled") {
    return { label: "Storniert", tone: "done" };
  }

  if (order.status === "Shipped" || order.status === "Completed") {
    return { label: "Abgeschlossen", tone: "done" };
  }

  if (order.paymentStatus === "Open" || order.status === "Payment open") {
    return { label: "Zahlung offen", tone: "danger" };
  }

  if (printFiles.some((file) => !file.fileName || file.status === "missing")) {
    return { label: "Druckdaten fehlen", tone: "warning" };
  }

  if (printFiles.some((file) => file.status === "problem") || order.status === "Customer reply needed") {
    return { label: "Druckdaten klaeren", tone: "danger" };
  }

  if (printFiles.some((file) => file.status === "received") || order.status === "Approval missing" || order.status === "Print files review") {
    return { label: "Druckfreigabe fehlt", tone: "warning" };
  }

  if (order.status === "Production ready") {
    return { label: "Bereit fuer Produktion", tone: "ready" };
  }

  if (
    order.status === "In production" ||
    productionItems.some((item) => item.production.status === "sent" || item.production.status === "confirmed")
  ) {
    return { label: "In Produktion", tone: "info" };
  }

  if (order.status === "Ready to ship" || productionItems.some((item) => item.production.status === "produced")) {
    return { label: "Versand vorbereiten", tone: "ready" };
  }

  return { label: "Pruefen", tone: "neutral" };
}

export function orderNeedsAction(order: Order) {
  const action = getOrderNextAction(order);
  return action.tone === "danger" || action.tone === "warning" || order.priority === "urgent";
}
