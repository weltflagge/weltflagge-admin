import type { Order, OrderItemProduction, OrderItemProductionStatus, OrderSource, OrderStatus, PrintFileStatus } from "@/src/types/order";
import { mockOrders } from "./mock-orders";
import { getPrisma, hasDatabaseUrl } from "./prisma";

const sourceMap: Record<string, OrderSource> = {
  WOOCOMMERCE_WELTFLAGGE: "woocommerce-weltflagge",
  WOOCOMMERCE_PARTNER: "woocommerce-partner",
  EBAY: "ebay",
  EMAIL: "email",
};

const statusMap: Record<string, OrderStatus> = {
  NEW: "New",
  PAYMENT_OPEN: "Payment open",
  PRINT_FILES_MISSING: "Print files missing",
  PRINT_FILES_REVIEW: "Print files review",
  CUSTOMER_REPLY_NEEDED: "Customer reply needed",
  APPROVAL_MISSING: "Approval missing",
  PRODUCTION_READY: "Production ready",
  IN_PRODUCTION: "In production",
  READY_TO_SHIP: "Ready to ship",
  SHIPPED: "Shipped",
  COMPLETED: "Shipped",
  CANCELLED: "Customer reply needed",
};

const printFileStatusMap: Record<string, PrintFileStatus> = {
  MISSING: "missing",
  RECEIVED: "received",
  APPROVED: "approved",
  PROBLEM: "problem",
};

const productionStatusMap: Record<string, OrderItemProductionStatus> = {
  NOT_ROUTED: "not_routed",
  DRAFT: "draft",
  SENT: "sent",
  CONFIRMED: "confirmed",
  IN_PRODUCTION: "confirmed",
  PRODUCED: "produced",
  DELIVERED: "produced",
};

const manufacturerMap: Record<string, OrderItemProduction["manufacturer"]> = {
  OPINION: "opinion",
  LOGO_PL: "logo_pl",
  MPH_MACIEJ: "mph_maciej",
  WMD: "wmd",
};

const printFileSideMap: Record<string, "front" | "back" | "general"> = {
  FRONT: "front",
  BACK: "back",
  GENERAL: "general",
};

function inferManufacturer(row: {
  productName: string;
  sku: string | null;
  material: string | null;
}): OrderItemProduction["manufacturer"] {
  const haystack = `${row.productName} ${row.sku ?? ""} ${row.material ?? ""}`.toLowerCase();

  if (haystack.includes("155") || haystack.includes("premium") || haystack.includes("satin") || haystack.includes("zimmer")) {
    return "logo_pl";
  }

  if (haystack.includes("beachflag") || haystack.includes("beach flag") || haystack.includes("bf-")) {
    return "mph_maciej";
  }

  if (haystack.includes("roll-up") || haystack.includes("rollup") || haystack.includes("x-banner") || haystack.includes("xbanner")) {
    return "wmd";
  }

  if (haystack.includes("fahne") || haystack.includes("flag") || haystack.includes("banner") || haystack.includes("mesh")) {
    return "opinion";
  }

  return undefined;
}

function formatDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "-";
}

function formatTimestamp(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatAmount(amountCents: number, currency: string) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

function mapAddress(address: {
  company: string | null;
  name: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
} | null) {
  return {
    company: address?.company ?? "-",
    name: address?.name ?? "-",
    street: address?.street ?? "-",
    postalCode: address?.postalCode ?? "",
    city: address?.city ?? "-",
    country: address?.country ?? "-",
  };
}

function mapPrintFile(printFile: {
  status: string;
  fileName: string | null;
  fileUrl: string | null;
  side: string;
}) {
  return {
    status: printFileStatusMap[printFile.status] ?? "missing",
    fileName: printFile.fileName ?? "",
    fileUrl: printFile.fileUrl ?? undefined,
    side: printFileSideMap[printFile.side] ?? "front",
  };
}

function mapPrimaryPrintFile(printFiles: Array<{
  status: string;
  fileName: string | null;
  fileUrl: string | null;
  side: string;
}>) {
  const printFile = printFiles.find((file) => file.side === "FRONT") ?? printFiles[0];

  if (!printFile) {
    return { status: "missing" as const, fileName: "" };
  }

  return mapPrintFile(printFile);
}

export async function getOrderByNumberFromDb(orderNumber: string): Promise<Order | null> {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const prisma = getPrisma();
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      billingAddress: true,
      shippingAddress: true,
      items: {
        include: {
          printFiles: true,
          productionState: {
            include: {
              manufacturer: true,
              currentBatch: true,
            },
          },
        },
        orderBy: { lineNumber: "asc" },
      },
      activityLogs: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!order) {
    return null;
  }

  return {
    id: order.orderNumber,
    source: sourceMap[order.source] ?? "email",
    externalId: order.externalId,
    date: formatDate(order.receivedAt),
    customer: order.customerName,
    email: order.customerEmail,
    phone: order.customerPhone ?? "-",
    billingAddress: mapAddress(order.billingAddress),
    shippingAddress: mapAddress(order.shippingAddress),
    items: order.items.map((item) => {
      const manufacturer = item.productionState?.manufacturer?.code
        ? manufacturerMap[item.productionState.manufacturer.code]
        : inferManufacturer(item);

      return {
        name: item.productName,
        sku: item.sku ?? `line-${item.lineNumber}`,
        size: item.size ?? "-",
        quantity: item.quantity,
        printFile: mapPrimaryPrintFile(item.printFiles),
        printFiles: item.printFiles.map(mapPrintFile),
        production: {
          manufacturer,
          batchId: item.productionState?.currentBatch?.batchNumber ?? undefined,
          status: item.productionState?.status
            ? productionStatusMap[item.productionState.status] ?? "not_routed"
            : manufacturer
              ? "draft"
              : "not_routed",
        },
      };
    }),
    amount: formatAmount(order.amountCents, order.currency),
    paymentStatus: order.paymentStatus === "PAID" ? "Paid" : "Open",
    artworkStatus: "Druckdaten",
    status: statusMap[order.status] ?? "New",
    carrier: order.carrier ?? "-",
    trackingNumber: order.trackingNumber ?? "",
    priority: order.priority.toLowerCase() as Order["priority"],
    deadline: formatDate(order.deadlineAt),
    notes: order.internalNotes ?? "-",
    timeline: order.activityLogs.map((entry) => ({
      id: entry.id,
      timestamp: formatTimestamp(entry.createdAt),
      actor: entry.actor,
      message: entry.message,
    })),
  };
}

export async function getOrdersFromDb(): Promise<Order[] | null> {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const prisma = getPrisma();
  const orders = await prisma.order.findMany({
    include: {
      billingAddress: true,
      shippingAddress: true,
      items: {
        include: {
          printFiles: true,
          productionState: {
            include: {
              manufacturer: true,
              currentBatch: true,
            },
          },
        },
        orderBy: { lineNumber: "asc" },
      },
      activityLogs: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
    orderBy: [{ receivedAt: "desc" }, { orderNumber: "desc" }],
  });

  return orders.map((order) => ({
    id: order.orderNumber,
    source: sourceMap[order.source] ?? "email",
    externalId: order.externalId,
    date: formatDate(order.receivedAt),
    customer: order.customerName,
    email: order.customerEmail,
    phone: order.customerPhone ?? "-",
    billingAddress: mapAddress(order.billingAddress),
    shippingAddress: mapAddress(order.shippingAddress),
    items: order.items.map((item) => {
      const manufacturer = item.productionState?.manufacturer?.code
        ? manufacturerMap[item.productionState.manufacturer.code]
        : inferManufacturer(item);

      return {
        name: item.productName,
        sku: item.sku ?? `line-${item.lineNumber}`,
        size: item.size ?? "-",
        quantity: item.quantity,
        printFile: mapPrimaryPrintFile(item.printFiles),
        printFiles: item.printFiles.map(mapPrintFile),
        production: {
          manufacturer,
          batchId: item.productionState?.currentBatch?.batchNumber ?? undefined,
          status: item.productionState?.status
            ? productionStatusMap[item.productionState.status] ?? "not_routed"
            : manufacturer
              ? "draft"
              : "not_routed",
        },
      };
    }),
    amount: formatAmount(order.amountCents, order.currency),
    paymentStatus: order.paymentStatus === "PAID" ? "Paid" : "Open",
    artworkStatus: "Druckdaten",
    status: statusMap[order.status] ?? "New",
    carrier: order.carrier ?? "-",
    trackingNumber: order.trackingNumber ?? "",
    priority: order.priority.toLowerCase() as Order["priority"],
    deadline: formatDate(order.deadlineAt),
    notes: order.internalNotes ?? "-",
    timeline: order.activityLogs.map((entry) => ({
      id: entry.id,
      timestamp: formatTimestamp(entry.createdAt),
      actor: entry.actor,
      message: entry.message,
    })),
  }));
}

export async function getOrdersWithFallback() {
  try {
    const dbOrders = await getOrdersFromDb();
    return {
      orders: dbOrders && dbOrders.length > 0 ? dbOrders : mockOrders,
      source: dbOrders && dbOrders.length > 0 ? "database" : "mock",
    } as const;
  } catch (error) {
    console.error("Failed to load orders from database. Falling back to mock orders.", error);
    return { orders: mockOrders, source: "mock" } as const;
  }
}
