import { productionRows } from "@/src/lib/mock-production";
import type { ManufacturerId, ProductionBatchStatus, ProductionRow } from "@/src/types/production";
import type { OrderItemProductionStatus, PrintFileStatus } from "@/src/types/order";
import { getPrisma, hasDatabaseUrl } from "./prisma";

type ActiveManufacturer = Exclude<ManufacturerId, "needs_review">;
type BatchStatusMap = Record<ActiveManufacturer, ProductionBatchStatus>;

const manufacturerByDbCode: Record<string, ActiveManufacturer> = {
  OPINION: "opinion",
  LOGO_PL: "logo_pl",
  MPH_MACIEJ: "mph_maciej",
  WMD: "wmd",
};

const printFileStatusMap: Record<string, PrintFileStatus> = {
  MISSING: "missing",
  RECEIVED: "received",
  APPROVED: "approved",
  PROBLEM: "problem",
};

const printFileSideMap: Record<string, "front" | "back" | "general"> = {
  FRONT: "front",
  BACK: "back",
  GENERAL: "general",
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

const batchStatusMap: Record<string, ProductionBatchStatus> = {
  DRAFT: "Draft",
  SENT_TO_MANUFACTURER: "Sent to manufacturer",
  CONFIRMED: "Confirmed",
  IN_PRODUCTION: "In production",
  DELIVERED: "Delivered",
};

const defaultBatchStatus: BatchStatusMap = {
  opinion: "Draft",
  logo_pl: "Draft",
  mph_maciej: "Draft",
  wmd: "Draft",
};

function formatDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "-";
}

function inferManufacturer(row: {
  productName: string;
  sku: string | null;
  material: string | null;
}): { manufacturer: ManufacturerId; reason: string } {
  const haystack = `${row.productName} ${row.sku ?? ""} ${row.material ?? ""}`.toLowerCase();

  if (haystack.includes("155") || haystack.includes("premium") || haystack.includes("satin") || haystack.includes("zimmer")) {
    return { manufacturer: "logo_pl", reason: "Premium 155g or indoor satin material routes to Logo.pl." };
  }

  if (haystack.includes("beachflag") || haystack.includes("beach flag") || haystack.includes("bf-")) {
    return { manufacturer: "mph_maciej", reason: "Beachflags route to MPH - Maciej." };
  }

  if (haystack.includes("roll-up") || haystack.includes("rollup") || haystack.includes("x-banner") || haystack.includes("xbanner")) {
    return { manufacturer: "wmd", reason: "Roll-Up and X-Banner products route to WMD." };
  }

  if (haystack.includes("fahne") || haystack.includes("flag") || haystack.includes("banner") || haystack.includes("mesh")) {
    return { manufacturer: "opinion", reason: "Flags, mesh fabric and banners route to Opinion." };
  }

  return { manufacturer: "needs_review", reason: "No manufacturer routing rule matched this item." };
}

function mapProductionStatus(status: string | undefined, manufacturer: ManufacturerId) {
  const mappedStatus = productionStatusMap[status ?? "NOT_ROUTED"] ?? "not_routed";

  if (mappedStatus === "not_routed" && manufacturer !== "needs_review") {
    return "draft";
  }

  return mappedStatus;
}

export async function getProductionRowsFromDb(): Promise<ProductionRow[] | null> {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const prisma = getPrisma();
  const items = await prisma.orderItem.findMany({
    where: {
      itemType: "PRODUCTION_ITEM",
    },
    include: {
      order: true,
      printFiles: true,
      productionState: {
        include: {
          manufacturer: true,
          currentBatch: true,
        },
      },
    },
    orderBy: [{ order: { deadlineAt: "asc" } }, { order: { orderNumber: "asc" } }, { lineNumber: "asc" }],
  });

  return items.map((item) => {
    const inferred = inferManufacturer(item);
    const manufacturer = item.productionState?.manufacturer?.code
      ? manufacturerByDbCode[item.productionState.manufacturer.code] ?? inferred.manufacturer
      : inferred.manufacturer;
    const batch = item.productionState?.currentBatch;
    const primaryPrintFile = item.printFiles.find((file) => file.side === "FRONT") ?? item.printFiles[0];

    return {
      id: item.id,
      manufacturer,
      orderId: item.order.orderNumber,
      customer: item.order.customerName,
      productName: item.productName,
      sku: item.sku ?? "-",
      material: item.material ?? inferred.reason.replace(" routes to ", " -> "),
      size: item.size ?? "-",
      quantity: item.quantity,
      finishing: item.finishing ?? "-",
      printFile: {
        status: printFileStatusMap[primaryPrintFile?.status ?? "MISSING"] ?? "missing",
        fileName: primaryPrintFile?.fileName ?? "",
        fileUrl: primaryPrintFile?.fileUrl ?? undefined,
      },
      printFiles: item.printFiles.map((printFile) => ({
        status: printFileStatusMap[printFile.status] ?? "missing",
        fileName: printFile.fileName ?? "",
        fileUrl: printFile.fileUrl ?? undefined,
        side: printFileSideMap[printFile.side] ?? "front",
      })),
      productionStatus: mapProductionStatus(item.productionState?.status, manufacturer),
      paymentStatus: item.order.paymentStatus === "PAID" ? "Paid" : "Open",
      sentAt: formatDate(item.productionState?.sentAt ?? null),
      batchId: batch?.batchNumber ?? undefined,
      deadline: formatDate(item.order.deadlineAt),
      notes: item.notes ?? item.order.internalNotes ?? "",
      routingReason: item.productionState?.routingReason ?? inferred.reason,
    };
  });
}

export async function getProductionBatchStatusFromDb(): Promise<BatchStatusMap | null> {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const prisma = getPrisma();
  const batches = await prisma.productionBatch.findMany({
    include: { manufacturer: true },
    orderBy: { date: "desc" },
  });

  return batches.reduce<BatchStatusMap>(
    (statusMap, batch) => {
      const manufacturer = manufacturerByDbCode[batch.manufacturer.code];

      if (!manufacturer || statusMap[manufacturer] !== "Draft") {
        return statusMap;
      }

      return {
        ...statusMap,
        [manufacturer]: batchStatusMap[batch.status] ?? "Draft",
      };
    },
    { ...defaultBatchStatus }
  );
}

export async function getProductionWithFallback() {
  try {
    const [dbRows, dbBatchStatus] = await Promise.all([getProductionRowsFromDb(), getProductionBatchStatusFromDb()]);

    return {
      rows: dbRows && dbRows.length > 0 ? dbRows : productionRows,
      batchStatus: dbBatchStatus ?? defaultBatchStatus,
      source: dbRows && dbRows.length > 0 ? "database" : "mock",
    } as const;
  } catch (error) {
    console.error("Failed to load production data from database. Falling back to mock production rows.", error);
    return {
      rows: productionRows,
      batchStatus: defaultBatchStatus,
      source: "mock",
    } as const;
  }
}

export function getBatchNumber(manufacturer: ActiveManufacturer, date = new Date()) {
  return `batch-${date.toISOString().slice(0, 10)}-${manufacturer}`;
}

export { defaultBatchStatus };
