import type { Prisma } from "@prisma/client";
import { dbSourceMap, type ExternalOrderPayload, type ExternalOrderSource, getImportStartDate, upsertOrderImport } from "@/src/lib/order-imports";
import { fetchWooOrders, getWooSourceConfig, isWooSourceConfigured, type WooCommerceSourceId } from "@/src/lib/woocommerce";
import { getPrisma, hasDatabaseUrl } from "@/src/lib/prisma";

export type ImportSourceId = ExternalOrderSource;

export type ImportLogRow = {
  id: string;
  source: ImportSourceId;
  externalId: string;
  result: "imported" | "updated" | "skipped" | "error";
  message: string;
  createdAt: string;
};

export type ImportSourceStatus = {
  source: ImportSourceId;
  label: string;
  configured: boolean;
  lastSuccessfulSyncAt?: string;
  lastErrorAt?: string;
  lastErrorMessage?: string;
  importedToday: number;
  updatedToday: number;
  skippedToday: number;
};

export type ImportDashboard = {
  startDate: string;
  sources: ImportSourceStatus[];
  logs: ImportLogRow[];
};

type SyncResult = {
  ok: boolean;
  source: ImportSourceId;
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  message: string;
};

const sourceLabels: Record<ImportSourceId, string> = {
  "woocommerce-weltflagge": "weltflagge.de",
  "woocommerce-partner": "flaggeshop.de",
  ebay: "eBay",
};

const logResultMap = {
  imported: "IMPORTED",
  updated: "UPDATED",
  skipped: "SKIPPED",
  error: "ERROR",
} as const;

function todayStart() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);

  return date;
}

function sourceIsConfigured(source: ImportSourceId) {
  if (source === "ebay") {
    return Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET && process.env.EBAY_REFRESH_TOKEN);
  }

  return isWooSourceConfigured(source);
}

function sourceConfigError(source: ImportSourceId) {
  if (source === "ebay") {
    return "eBay API config is missing.";
  }

  return `${getWooSourceConfig(source).label} WooCommerce config is missing.`;
}

async function writeImportLog(input: {
  source: ImportSourceId;
  externalId?: string;
  result: keyof typeof logResultMap;
  message?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  if (!hasDatabaseUrl()) return;

  const prisma = getPrisma();

  await prisma.importLog.create({
    data: {
      source: dbSourceMap[input.source],
      externalId: input.externalId ?? null,
      result: logResultMap[input.result],
      message: input.message ?? null,
      metadata: input.metadata === undefined ? undefined : input.metadata,
    },
  });
}

async function markSourceSuccess(source: ImportSourceId) {
  if (!hasDatabaseUrl()) return;

  const prisma = getPrisma();

  await prisma.importSyncState.upsert({
    where: { source: dbSourceMap[source] },
    update: {
      lastSuccessfulSyncAt: new Date(),
      lastErrorMessage: null,
    },
    create: {
      source: dbSourceMap[source],
      lastSuccessfulSyncAt: new Date(),
    },
  });
}

async function markSourceError(source: ImportSourceId, message: string) {
  if (!hasDatabaseUrl()) return;

  const prisma = getPrisma();

  await prisma.importSyncState.upsert({
    where: { source: dbSourceMap[source] },
    update: {
      lastErrorAt: new Date(),
      lastErrorMessage: message,
    },
    create: {
      source: dbSourceMap[source],
      lastErrorAt: new Date(),
      lastErrorMessage: message,
    },
  });
}

async function fetchExternalOrders(source: ImportSourceId): Promise<ExternalOrderPayload[]> {
  if (source === "ebay") {
    throw new Error("eBay API sync is not configured yet.");
  }

  return fetchWooOrders(source as WooCommerceSourceId);
}

export async function syncImportSource(source: ImportSourceId): Promise<SyncResult> {
  if (!hasDatabaseUrl()) {
    return { ok: false, source, imported: 0, updated: 0, skipped: 0, errors: 1, message: "DATABASE_URL is not configured yet." };
  }

  if (!sourceIsConfigured(source)) {
    const message = sourceConfigError(source);
    await markSourceError(source, message);
    await writeImportLog({ source, result: "error", message });
    return { ok: false, source, imported: 0, updated: 0, skipped: 0, errors: 1, message };
  }

  const counts = { imported: 0, updated: 0, skipped: 0, errors: 0 };

  try {
    const orders = await fetchExternalOrders(source);

    for (const order of orders) {
      try {
        const result = await upsertOrderImport(order);
        counts[result.result] += 1;
        await writeImportLog({
          source,
          externalId: result.externalId,
          result: result.result,
          message: result.message,
          metadata: { orderNumber: result.orderNumber },
        });
      } catch (error) {
        counts.errors += 1;
        await writeImportLog({
          source,
          externalId: order.id,
          result: "error",
          message: error instanceof Error ? error.message : "Import failed.",
          metadata: { orderNumber: order.orderNumber },
        });
      }
    }

    await markSourceSuccess(source);
    return {
      ok: counts.errors === 0,
      source,
      ...counts,
      message: `${sourceLabels[source]} sync: ${counts.imported} imported, ${counts.updated} updated, ${counts.skipped} skipped, ${counts.errors} errors.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed.";
    await markSourceError(source, message);
    await writeImportLog({ source, result: "error", message });

    return { ok: false, source, imported: 0, updated: 0, skipped: 0, errors: 1, message };
  }
}

export async function syncAllImportSources() {
  const sources: ImportSourceId[] = ["woocommerce-weltflagge", "woocommerce-partner", "ebay"];
  const results = [];

  for (const source of sources) {
    results.push(await syncImportSource(source));
  }

  return results;
}

export async function importWebhookOrder(source: ImportSourceId, payload: ExternalOrderPayload) {
  if (!hasDatabaseUrl()) {
    return { ok: false, error: "DATABASE_URL is not configured yet." };
  }

  try {
    const result = await upsertOrderImport(payload);
    await writeImportLog({
      source,
      externalId: result.externalId,
      result: result.result,
      message: `Webhook ${result.message}`,
      metadata: { orderNumber: result.orderNumber },
    });
    await markSourceSuccess(source);

    return { ok: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook import failed.";
    await markSourceError(source, message);
    await writeImportLog({ source, externalId: payload.id, result: "error", message, metadata: { orderNumber: payload.orderNumber } });

    return { ok: false, error: message };
  }
}

export async function getImportDashboard(): Promise<ImportDashboard> {
  const sourceIds: ImportSourceId[] = ["woocommerce-weltflagge", "woocommerce-partner", "ebay"];

  if (!hasDatabaseUrl()) {
    return {
      startDate: getImportStartDate().toISOString().slice(0, 10),
      sources: sourceIds.map((source) => ({
        source,
        label: sourceLabels[source],
        configured: sourceIsConfigured(source),
        lastErrorMessage: sourceIsConfigured(source) ? undefined : sourceConfigError(source),
        importedToday: 0,
        updatedToday: 0,
        skippedToday: 0,
      })),
      logs: [],
    };
  }

  const prisma = getPrisma();
  const dbSources = sourceIds.map((source) => dbSourceMap[source]);
  const [states, logs, todayLogs] = await Promise.all([
    prisma.importSyncState.findMany({ where: { source: { in: dbSources } } }),
    prisma.importLog.findMany({
      where: { source: { in: dbSources } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.importLog.findMany({
      where: {
        source: { in: dbSources },
        createdAt: { gte: todayStart() },
      },
      select: { source: true, result: true },
    }),
  ]);
  const stateBySource = new Map(states.map((state) => [state.source, state]));

  function countToday(source: ImportSourceId, result: "IMPORTED" | "UPDATED" | "SKIPPED") {
    return todayLogs.filter((log) => log.source === dbSourceMap[source] && log.result === result).length;
  }

  return {
    startDate: getImportStartDate().toISOString().slice(0, 10),
    sources: sourceIds.map((source) => {
      const state = stateBySource.get(dbSourceMap[source]);
      const configured = sourceIsConfigured(source);

      return {
        source,
        label: sourceLabels[source],
        configured,
        lastSuccessfulSyncAt: state?.lastSuccessfulSyncAt?.toISOString(),
        lastErrorAt: state?.lastErrorAt?.toISOString(),
        lastErrorMessage: configured ? state?.lastErrorMessage ?? undefined : sourceConfigError(source),
        importedToday: countToday(source, "IMPORTED"),
        updatedToday: countToday(source, "UPDATED"),
        skippedToday: countToday(source, "SKIPPED"),
      };
    }),
    logs: logs.map((log) => ({
      id: log.id,
      source: sourceIds.find((source) => dbSourceMap[source] === log.source) ?? "ebay",
      externalId: log.externalId ?? "-",
      result: log.result.toLowerCase() as ImportLogRow["result"],
      message: log.message ?? "",
      createdAt: log.createdAt.toISOString(),
    })),
  };
}
