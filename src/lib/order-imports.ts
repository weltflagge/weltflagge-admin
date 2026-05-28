import { getCatalogEntry, getCatalogMaterial, type PrintMode, type ProductTypeId } from "@/src/lib/product-catalog";
import { getPrisma, hasDatabaseUrl } from "@/src/lib/prisma";
import type { OrderSource, PrintFileStatus } from "@/src/types/order";
import type { ManufacturerId } from "@/src/types/production";

export type ExternalOrderSource = Extract<OrderSource, "woocommerce-weltflagge" | "woocommerce-partner" | "ebay">;

export type ExternalPrintFile = {
  name?: string;
  url?: string;
  side?: "front" | "back" | "general";
};

export type ExternalOrderItemPayload = {
  externalLineId: string;
  title: string;
  sku?: string;
  quantity: number;
  attributes: Record<string, string>;
  printFiles?: ExternalPrintFile[];
};

export type ExternalOrderPayload = {
  id: string;
  source: ExternalOrderSource;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  amount: string;
  currency: "EUR";
  receivedAt: string;
  paymentStatus?: "paid" | "open" | "refunded" | "cancelled";
  billingAddress?: ExternalAddressPayload;
  shippingAddress?: ExternalAddressPayload;
  items: ExternalOrderItemPayload[];
};

export type ExternalAddressPayload = {
  company?: string;
  name?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
};

export type NormalizedImportPrintFile = {
  side: "front" | "back" | "general";
  fileName: string;
  fileUrl?: string;
  status: PrintFileStatus;
};

export type NormalizedImportItem = {
  externalLineId: string;
  title: string;
  sku: string;
  quantity: number;
  productType?: ProductTypeId;
  productLabel: string;
  materialId?: string;
  materialLabel: string;
  size: string;
  shape: string;
  printMode: PrintMode;
  manufacturer: ManufacturerId;
  routingReason: string;
  printFiles: NormalizedImportPrintFile[];
  confidence: "high" | "needs_review";
  warnings: string[];
};

export type NormalizedImportOrder = {
  id: string;
  source: ExternalOrderSource;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  amount: string;
  currency: "EUR";
  receivedAt: string;
  paymentStatus: "paid" | "open" | "refunded" | "cancelled";
  billingAddress: ExternalAddressPayload;
  shippingAddress: ExternalAddressPayload;
  items: NormalizedImportItem[];
  readyItems: number;
  reviewItems: number;
};

export type StoredOrderImport = NormalizedImportOrder & {
  importDbId: string;
  importStatus: "pending" | "needs_review" | "approved" | "skipped" | "error";
  importWarnings: string[];
  approvedOrderNumber?: string;
  lastSyncedAt: string;
};

export type OrderImportUpsertResult = {
  result: "imported" | "updated" | "skipped";
  externalId: string;
  orderNumber: string;
  message: string;
};

function textIncludes(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle));
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replaceAll("ü", "ue")
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ß", "ss")
    .replaceAll("²", "2");
}

function getAttribute(payload: ExternalOrderItemPayload, names: string[]) {
  const entries = Object.entries(payload.attributes);
  const normalizedNames = names.map(normalizeText);
  const match = entries.find(([key]) => normalizedNames.includes(normalizeText(key)));

  return match?.[1] ?? "";
}

function getAttributeByKeyIncludes(payload: ExternalOrderItemPayload, names: string[]) {
  const entries = Object.entries(payload.attributes);
  const normalizedNames = names.map(normalizeText);
  const match = entries.find(([key]) => normalizedNames.some((name) => normalizeText(key).includes(name)));

  return match?.[1] ?? "";
}

function normalizeDecimalNumber(value: string) {
  return value.replace(",", ".").replace(/\s/g, "");
}

function formatDimension(value: string) {
  const number = Number(normalizeDecimalNumber(value));

  if (!Number.isFinite(number)) {
    return value.trim();
  }

  return Number.isInteger(number) ? String(number) : String(number).replace(".", ",");
}

function detectWidthHeightSize(payload: ExternalOrderItemPayload) {
  const width = getAttributeByKeyIncludes(payload, ["breite", "width"]);
  const height = getAttributeByKeyIncludes(payload, ["hoehe", "höhe", "height"]);

  if (width && height) {
    return `${formatDimension(width)} x ${formatDimension(height)} cm`;
  }

  const haystack = `${payload.title} ${Object.entries(payload.attributes)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" ")}`;
  const match = haystack.match(/(?:breite|width)\s*(?:\([^)]+\))?\s*:?\s*(\d+(?:[,.]\d+)?)\s*(?:cm)?[\s\S]{0,80}?(?:h(?:ö|oe)he|height)\s*(?:\([^)]+\))?\s*:?\s*(\d+(?:[,.]\d+)?)\s*(?:cm)?/i);

  return match ? `${formatDimension(match[1])} x ${formatDimension(match[2])} cm` : "";
}

function mapBeachflagHeightToSize(value: string) {
  const normalized = normalizeDecimalNumber(value);
  const height = Number(normalized);

  if (!Number.isFinite(height)) {
    return "";
  }

  if ([2.3, 2.6, 2.7].includes(height)) return "S";
  if ([3, 3.1, 3.3].includes(height)) return "M";
  if ([4, 4.1].includes(height)) return "L";
  if ([5, 5.2].includes(height)) return "XL";

  return "";
}

function detectBeachflagSize(payload: ExternalOrderItemPayload) {
  const explicitSize = getAttribute(payload, ["size", "groesse", "größe"]);
  const normalizedExplicitSize = normalizeText(explicitSize).toUpperCase();

  if (["S", "M", "L", "XL"].includes(normalizedExplicitSize)) {
    return normalizedExplicitSize;
  }

  const heightAttribute = getAttributeByKeyIncludes(payload, ["hoehe", "höhe", "height"]);
  const mappedHeightAttribute = heightAttribute ? mapBeachflagHeightToSize(heightAttribute.replace(/m$/i, "")) : "";

  if (mappedHeightAttribute) {
    return mappedHeightAttribute;
  }

  const haystack = `${payload.title} ${Object.entries(payload.attributes)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" ")}`;
  const heightMatch = haystack.match(/(?:h(?:ö|oe)he|height)\s*:?\s*(\d+(?:[,.]\d+)?)\s*m/i);
  const mappedHeight = heightMatch ? mapBeachflagHeightToSize(heightMatch[1]) : "";

  if (mappedHeight) {
    return mappedHeight;
  }

  const tokenMatch = normalizeText(haystack)
    .split(/\W+/)
    .find((token) => ["s", "m", "l", "xl"].includes(token));

  return tokenMatch?.toUpperCase() ?? "";
}

function detectProductType(payload: ExternalOrderItemPayload): ProductTypeId | undefined {
  const haystack = normalizeText(`${payload.title} ${payload.sku ?? ""} ${Object.values(payload.attributes).join(" ")}`);

  if (textIncludes(haystack, ["beachflag", "beach flag", "tropfen", "haiflosse", "welle"])) {
    return "beachflag";
  }

  if (textIncludes(haystack, ["bauzaun", "bauzaeun", "bauzaene", "bauzane"])) {
    return "bauzaunbanner";
  }

  if (textIncludes(haystack, ["roll-up", "rollup", "x-banner", "xbanner"])) {
    return "rollup_xbanner";
  }

  if (textIncludes(haystack, ["banner", "meshbanner", "pvc banner", "textilbanner", "polymesh"])) {
    return "banner";
  }

  if (textIncludes(haystack, ["flagge", "fahne", "hissfahne", "zimmerfahne", "fahnenstoff", "satenstoff", "satin"])) {
    return "flag";
  }

  return undefined;
}

function detectMaterialId(productType: ProductTypeId, payload: ExternalOrderItemPayload) {
  const entry = getCatalogEntry(productType);
  const haystack = normalizeText(`${payload.title} ${payload.sku ?? ""} ${Object.values(payload.attributes).join(" ")}`);

  if (productType === "flag") {
    if (textIncludes(haystack, ["155", "premium"])) return "fahnenstoff-155";
    if (textIncludes(haystack, ["mesh"])) return "fahnenstoff-mesh-120";
    if (textIncludes(haystack, ["saten", "satin", "zimmer"])) return "satenstoff";
    if (textIncludes(haystack, ["115", "fahnenstoff", "flagge", "fahne"])) return "fahnenstoff-115";
  }

  if (productType === "beachflag") {
    if (textIncludes(haystack, ["airtex", "mesh"])) return "beachflag-airtex-mesh-single";
    if (textIncludes(haystack, ["115", "fahnenstoff", "beachflag"])) return "beachflag-fahnenstoff-115-single";
  }

  if (productType === "banner") {
    if (textIncludes(haystack, ["mesh"])) return "mesh-banner";
    if (textIncludes(haystack, ["textil"])) return "textilbanner";
    if (textIncludes(haystack, ["polymesh"])) return "polymesh";
    if (textIncludes(haystack, ["pvc", "banner"])) return "pvc-banner";
  }

  if (productType === "bauzaunbanner") {
    if (textIncludes(haystack, ["mesh"])) return "bauzaun-mesh-banner";
    if (textIncludes(haystack, ["textil"])) return "bauzaun-textilbanner";
    if (textIncludes(haystack, ["polymesh"])) return "bauzaun-polymesh";
    if (textIncludes(haystack, ["pvc", "bauzaun"])) return "bauzaun-pvc-banner";
  }

  if (productType === "rollup_xbanner") {
    return "wmd-pvc-banner";
  }

  return entry.materials[0]?.id;
}

function detectShape(productType: ProductTypeId | undefined, payload: ExternalOrderItemPayload) {
  if (productType !== "beachflag") {
    return "";
  }

  const haystack = normalizeText(`${payload.title} ${Object.values(payload.attributes).join(" ")}`);
  const shape = getCatalogEntry("beachflag").shapes?.find((candidate) => haystack.includes(normalizeText(candidate)));

  return shape ?? "";
}

function detectSize(productType: ProductTypeId | undefined, shape: string, payload: ExternalOrderItemPayload) {
  if (productType === "bauzaunbanner") {
    return getCatalogEntry("bauzaunbanner").defaultSize ?? "";
  }

  if (productType === "beachflag") {
    return detectBeachflagSize(payload);
  }

  if (productType === "banner") {
    const widthHeightSize = detectWidthHeightSize(payload);

    if (widthHeightSize) {
      return widthHeightSize;
    }
  }

  const explicitSize = getAttribute(payload, ["size", "groesse", "größe", "format", "masse", "maße"]);

  if (explicitSize) {
    return explicitSize;
  }

  return "";
}

function detectPrintMode(productType: ProductTypeId | undefined, materialId: string | undefined, payload: ExternalOrderItemPayload): PrintMode {
  const haystack = normalizeText(`${payload.title} ${Object.values(payload.attributes).join(" ")}`);
  const requestedMode: PrintMode = textIncludes(haystack, ["beidseitig", "double", "2-seitig", "zweiseitig"])
    ? "double_sided"
    : "single_sided";

  if (!productType || !materialId) {
    return requestedMode;
  }

  const material = getCatalogMaterial(productType, materialId);

  return material.allowedPrintModes.includes(requestedMode) ? requestedMode : material.allowedPrintModes[0];
}

function normalizePrintFiles(payload: ExternalOrderItemPayload, printMode: PrintMode): NormalizedImportPrintFile[] {
  const files = payload.printFiles ?? [];
  const frontFile = files.find((file) => file.side === "front" || !file.side) ?? files[0];
  const backFile = files.find((file) => file.side === "back");

  return [
    {
      side: "front",
      fileName: frontFile?.name ?? "",
      fileUrl: frontFile?.url,
      status: frontFile?.name ? "received" : "missing",
    },
    ...(printMode === "double_sided"
      ? [
          {
            side: "back" as const,
            fileName: backFile?.name ?? "",
            fileUrl: backFile?.url,
            status: backFile?.name ? ("received" as const) : ("missing" as const),
          },
        ]
      : []),
  ];
}

export function normalizeExternalOrder(payload: ExternalOrderPayload): NormalizedImportOrder {
  const items = payload.items.map<NormalizedImportItem>((item) => {
    const productType = detectProductType(item);
    const materialId = productType ? detectMaterialId(productType, item) : undefined;
    const material = productType && materialId ? getCatalogMaterial(productType, materialId) : undefined;
    const shape = detectShape(productType, item);
    const size = detectSize(productType, shape, item);
    const printMode = detectPrintMode(productType, materialId, item);
    const printFiles = normalizePrintFiles(item, printMode);
    const warnings: string[] = [];

    if (!productType) warnings.push("Product type could not be detected.");
    if (!material) warnings.push("Material could not be mapped to the catalog.");
    if (productType === "beachflag" && !shape) warnings.push("Beachflag shape is missing or unknown.");
    if (!size) warnings.push("Size could not be detected.");
    if (printFiles.some((file) => file.status === "missing")) warnings.push("Print file is missing.");

    const manufacturer = material?.manufacturer ?? "needs_review";
    const confidence: NormalizedImportItem["confidence"] =
      productType && material && size && manufacturer !== "needs_review" ? "high" : "needs_review";

    return {
      externalLineId: item.externalLineId,
      title: item.title,
      sku: item.sku ?? "-",
      quantity: item.quantity,
      productType,
      productLabel: productType ? getCatalogEntry(productType).label : "Needs review",
      materialId,
      materialLabel: material?.label ?? "Needs review",
      size,
      shape,
      printMode,
      manufacturer,
      routingReason: material
        ? `${getCatalogEntry(productType!).label} / ${material.label} -> ${material.manufacturer}`
        : "No catalog rule matched this imported item.",
      printFiles,
      confidence,
      warnings,
    };
  });

  return {
    id: payload.id,
    source: payload.source,
    orderNumber: payload.orderNumber,
    customerName: payload.customerName,
    customerEmail: payload.customerEmail,
    customerPhone: payload.customerPhone ?? "",
    amount: `${payload.amount} ${payload.currency}`,
    currency: payload.currency,
    receivedAt: payload.receivedAt,
    paymentStatus: payload.paymentStatus ?? "open",
    billingAddress: payload.billingAddress ?? {},
    shippingAddress: payload.shippingAddress ?? payload.billingAddress ?? {},
    items,
    readyItems: items.filter((item) => item.confidence === "high").length,
    reviewItems: items.filter((item) => item.confidence === "needs_review").length,
  };
}

export const dbSourceMap = {
  "woocommerce-weltflagge": "WOOCOMMERCE_WELTFLAGGE",
  "woocommerce-partner": "WOOCOMMERCE_PARTNER",
  ebay: "EBAY",
} as const;

export type DbOrderSource = (typeof dbSourceMap)[ExternalOrderSource];

const importStatusMap: Record<string, StoredOrderImport["importStatus"]> = {
  PENDING: "pending",
  NEEDS_REVIEW: "needs_review",
  APPROVED: "approved",
  SKIPPED: "skipped",
  ERROR: "error",
};

const manufacturerDbCodeByUiId = {
  opinion: "OPINION",
  logo_pl: "LOGO_PL",
  mph_maciej: "MPH_MACIEJ",
  wmd: "WMD",
} as const;

function parseAmountCents(value: string) {
  const normalized = value.replace("EUR", "").replace(/\s/g, "").replace(".", "").replace(",", ".");
  const amount = Number(normalized);

  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0;
}

function cleanAddress(address: ExternalAddressPayload | undefined, fallbackName: string) {
  return {
    company: address?.company?.trim() || null,
    name: address?.name?.trim() || fallbackName,
    street: address?.street?.trim() || null,
    postalCode: address?.postalCode?.trim() || null,
    city: address?.city?.trim() || null,
    country: address?.country?.trim() || null,
  };
}

function importWarnings(order: NormalizedImportOrder) {
  return order.items.flatMap((item) => item.warnings.map((warning) => `${item.title}: ${warning}`));
}

export function getImportStartDate() {
  const value = process.env.IMPORT_START_DATE;
  const date = value ? new Date(`${value}T00:00:00.000Z`) : new Date("2026-05-28T00:00:00.000Z");

  if (Number.isNaN(date.getTime())) {
    return new Date("2026-05-28T00:00:00.000Z");
  }

  return date;
}

export async function upsertOrderImport(payload: ExternalOrderPayload): Promise<OrderImportUpsertResult> {
  if (!hasDatabaseUrl()) {
    throw new Error("DATABASE_URL is not configured yet.");
  }

  const receivedAt = new Date(payload.receivedAt);

  if (receivedAt < getImportStartDate()) {
    return {
      result: "skipped",
      externalId: payload.id,
      orderNumber: payload.orderNumber,
      message: "Order is older than IMPORT_START_DATE.",
    };
  }

  const prisma = getPrisma();
  const normalized = normalizeExternalOrder(payload);
  const warnings = importWarnings(normalized);
  const source = dbSourceMap[payload.source];
  const existing = await prisma.orderImport.findUnique({
    where: {
      source_externalId: {
        source,
        externalId: payload.id,
      },
    },
    select: { status: true },
  });

  if (existing?.status === "APPROVED" || existing?.status === "SKIPPED") {
    return {
      result: "skipped",
      externalId: payload.id,
      orderNumber: payload.orderNumber,
      message: `Existing import is ${existing.status}.`,
    };
  }

  await prisma.orderImport.upsert({
    where: {
      source_externalId: {
        source,
        externalId: payload.id,
      },
    },
    update: {
      orderNumber: payload.orderNumber,
      status: warnings.length ? "NEEDS_REVIEW" : "PENDING",
      customerName: payload.customerName,
      customerEmail: payload.customerEmail || null,
      amountCents: parseAmountCents(payload.amount),
      currency: payload.currency,
      receivedAt,
      rawPayload: payload,
      normalizedPayload: normalized,
      warnings,
      lastSyncedAt: new Date(),
    },
    create: {
      source,
      externalId: payload.id,
      orderNumber: payload.orderNumber,
      status: warnings.length ? "NEEDS_REVIEW" : "PENDING",
      customerName: payload.customerName,
      customerEmail: payload.customerEmail || null,
      amountCents: parseAmountCents(payload.amount),
      currency: payload.currency,
      receivedAt,
      rawPayload: payload,
      normalizedPayload: normalized,
      warnings,
    },
  });

  return {
    result: existing ? "updated" : "imported",
    externalId: payload.id,
    orderNumber: payload.orderNumber,
    message: existing ? "Existing import updated." : "New import created.",
  };
}

export async function getStoredOrderImports(): Promise<StoredOrderImport[] | null> {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const prisma = getPrisma();
  const imports = await prisma.orderImport.findMany({
    where: {
      receivedAt: {
        gte: getImportStartDate(),
      },
    },
    include: { approvedOrder: { select: { orderNumber: true } } },
    orderBy: [{ status: "asc" }, { receivedAt: "desc" }],
  });

  return imports.map((entry) => ({
    ...(entry.normalizedPayload as NormalizedImportOrder),
    importDbId: entry.id,
    importStatus: importStatusMap[entry.status] ?? "pending",
    importWarnings: Array.isArray(entry.warnings) ? entry.warnings.map(String) : [],
    approvedOrderNumber: entry.approvedOrder?.orderNumber,
    lastSyncedAt: entry.lastSyncedAt.toISOString(),
  }));
}

export async function createOrderFromImport(importId: string, input: NormalizedImportOrder) {
  if (!hasDatabaseUrl()) {
    return { ok: false, error: "DATABASE_URL is not configured yet." };
  }

  const prisma = getPrisma();
  const orderNumber = input.orderNumber.trim();
  const customerName = input.customerName.trim();
  const items = input.items.map((item, index) => ({
    ...item,
    lineNumber: index + 1,
    title: item.title.trim(),
    quantity: Number(item.quantity),
  }));

  if (!orderNumber || !customerName) {
    return { ok: false, error: "Bestellnummer und Kunde sind erforderlich." };
  }

  if (!input.customerEmail.trim()) {
    return { ok: false, error: "E-Mail ist erforderlich. Bitte im Import korrigieren." };
  }

  if (items.length === 0 || items.some((item) => !item.title || !Number.isInteger(item.quantity) || item.quantity < 1)) {
    return { ok: false, error: "Bitte Positionen pruefen: Produktname und Stueckzahl sind erforderlich." };
  }

  if (items.some((item) => item.confidence !== "high" || item.warnings.length > 0 || item.manufacturer === "needs_review")) {
    return { ok: false, error: "Bitte alle Review-Hinweise korrigieren und die Positionen auf 'Mapped' setzen." };
  }

  const existingOrder = await prisma.order.findUnique({ where: { orderNumber }, select: { id: true } });

  if (existingOrder) {
    return { ok: false, error: `Order ${orderNumber} existiert bereits.` };
  }

  const manufacturerCodes = [
    ...new Set(items.map((item) => manufacturerDbCodeByUiId[item.manufacturer as Exclude<ManufacturerId, "needs_review">])),
  ];
  const manufacturers = await Promise.all(
    manufacturerCodes.map((code) =>
      prisma.manufacturer.upsert({
        where: { code },
        update: {},
        create: {
          code,
          name: code === "OPINION" ? "Opinion" : code === "LOGO_PL" ? "Logo.pl" : code === "MPH_MACIEJ" ? "MPH - Maciej" : "WMD",
          exportFormat: `${code.toLowerCase()}-xlsx`,
        },
      })
    )
  );
  const manufacturerByCode = new Map(manufacturers.map((manufacturer) => [manufacturer.code, manufacturer]));
  const billingAddress = cleanAddress(input.billingAddress, customerName);
  const shippingAddress = cleanAddress(input.shippingAddress, customerName);
  const createdOrder = await prisma.order.create({
    data: {
      orderNumber,
      source: dbSourceMap[input.source],
      externalId: input.id,
      receivedAt: new Date(input.receivedAt),
      customerName,
      customerEmail: input.customerEmail.trim(),
      customerPhone: input.customerPhone.trim() || null,
      amountCents: parseAmountCents(input.amount),
      currency: input.currency,
      paymentStatus:
        input.paymentStatus === "paid"
          ? "PAID"
          : input.paymentStatus === "refunded"
            ? "REFUNDED"
            : input.paymentStatus === "cancelled"
              ? "CANCELLED"
              : "OPEN",
      status: items.some((item) => item.printFiles.some((file) => file.status === "missing")) ? "PRINT_FILES_MISSING" : "NEW",
      priority: "NORMAL",
      internalNotes: `Importiert aus WooCommerce Import Queue (${input.source}).`,
      rawPayload: input,
      billingAddress: { create: billingAddress },
      shippingAddress: { create: shippingAddress },
      items: {
        create: items.map((item) => {
          const manufacturerCode = manufacturerDbCodeByUiId[item.manufacturer as Exclude<ManufacturerId, "needs_review">];
          const finishing = [item.shape ? `Form: ${item.shape}` : "", item.printMode === "double_sided" ? "Beidseitig bedruckt" : "Einseitig bedruckt"]
            .filter(Boolean)
            .join(" | ");

          return {
            lineNumber: item.lineNumber,
            productName: item.title,
            sku: item.sku === "-" ? null : item.sku,
            material: item.materialLabel || null,
            size: item.size || null,
            quantity: item.quantity,
            finishing: finishing || null,
            itemType: "PRODUCTION_ITEM" as const,
            notes: item.warnings.length ? item.warnings.join(" ") : null,
            printFiles: {
              create: item.printFiles.map((file) => ({
                side: file.side === "back" ? ("BACK" as const) : file.side === "general" ? ("GENERAL" as const) : ("FRONT" as const),
                status:
                  file.status === "received"
                    ? ("RECEIVED" as const)
                    : file.status === "approved"
                      ? ("APPROVED" as const)
                      : file.status === "problem"
                        ? ("PROBLEM" as const)
                        : ("MISSING" as const),
                fileName: file.fileName || null,
                fileUrl: file.fileUrl || null,
                source: input.source,
              })),
            },
            productionState: {
              create: {
                status: "DRAFT" as const,
                manufacturerId: manufacturerByCode.get(manufacturerCode)?.id,
                routingReason: item.routingReason,
              },
            },
          };
        }),
      },
      activityLogs: {
        create: {
          entityType: "ORDER",
          actor: "WooCommerce Import",
          message: `Import aus ${input.source} freigegeben und als Auftrag erstellt.`,
        },
      },
    },
  });

  await prisma.orderImport.update({
    where: { id: importId },
    data: {
      status: "APPROVED",
      normalizedPayload: input,
      warnings: importWarnings(input),
      approvedOrderId: createdOrder.id,
    },
  });

  return { ok: true, orderNumber };
}

export async function skipOrderImport(importId: string) {
  if (!hasDatabaseUrl()) {
    return { ok: false, error: "DATABASE_URL is not configured yet." };
  }

  const prisma = getPrisma();

  await prisma.orderImport.update({
    where: { id: importId },
    data: {
      status: "SKIPPED",
      reviewNotes: "Manually skipped from import queue.",
    },
  });

  return { ok: true };
}

export async function reopenOrderImport(importId: string) {
  if (!hasDatabaseUrl()) {
    return { ok: false, error: "DATABASE_URL is not configured yet." };
  }

  const prisma = getPrisma();
  const orderImport = await prisma.orderImport.findUnique({
    where: { id: importId },
    select: {
      status: true,
      normalizedPayload: true,
    },
  });

  if (!orderImport) {
    return { ok: false, error: "Import wurde nicht gefunden." };
  }

  if (orderImport.status === "APPROVED") {
    return { ok: false, error: "Bereits erstellte Auftraege koennen nicht zurueck in die Import Queue." };
  }

  const normalized = orderImport.normalizedPayload as NormalizedImportOrder;
  const warnings = importWarnings(normalized);

  await prisma.orderImport.update({
    where: { id: importId },
    data: {
      status: warnings.length ? "NEEDS_REVIEW" : "PENDING",
      reviewNotes: null,
      warnings,
    },
  });

  return { ok: true, status: warnings.length ? ("needs_review" as const) : ("pending" as const) };
}

export const mockExternalOrders: ExternalOrderPayload[] = [
  {
    id: "wc-wf-75841",
    source: "woocommerce-weltflagge",
    orderNumber: "WF-75841",
    customerName: "Stadtwerke Lueneburg",
    customerEmail: "marketing@stadtwerke-lueneburg.de",
    amount: "358,80",
    currency: "EUR",
    receivedAt: "2026-05-16T09:21:00.000Z",
    items: [
      {
        externalLineId: "line-1",
        title: "Hissfahne 120 x 300 cm - Fahnenstoff 115 g/m2",
        sku: "HF-115-120x300",
        quantity: 3,
        attributes: { Material: "Fahnenstoff 115 g/m2", Groesse: "120 x 300 cm", Druck: "Einseitig bedruckt" },
        printFiles: [{ name: "WF-75841_hissfahne.pdf", side: "front" }],
      },
      {
        externalLineId: "line-2",
        title: "Premium Flagge 155g 150 x 250 cm",
        sku: "HF-155-150x250",
        quantity: 1,
        attributes: { Material: "Fahnenstoff 155 g/m2", Format: "150 x 250 cm" },
        printFiles: [{ name: "WF-75841_premium_155g.pdf", side: "front" }],
      },
    ],
  },
  {
    id: "wc-partner-30018",
    source: "woocommerce-partner",
    orderNumber: "WF-75842",
    customerName: "Eventbau Kramer GmbH",
    customerEmail: "orders@eventbau-kramer.de",
    amount: "214,90",
    currency: "EUR",
    receivedAt: "2026-05-16T10:04:00.000Z",
    items: [
      {
        externalLineId: "line-1",
        title: "Beachflag Tropfen M - Fahnenstoff 115 g/m2 - beidseitig",
        sku: "BF-TROPFEN-M-DS",
        quantity: 2,
        attributes: { Form: "Tropfen", Size: "M", Druck: "Beidseitig bedruckt" },
        printFiles: [
          { name: "WF-75842_beachflag_front.pdf", side: "front" },
          { name: "WF-75842_beachflag_back.pdf", side: "back" },
        ],
      },
      {
        externalLineId: "line-2",
        title: "Bauzaunbanner PVC Banner",
        sku: "BZ-PVC-340x173",
        quantity: 5,
        attributes: { Material: "PVC Banner" },
        printFiles: [{ name: "WF-75842_bauzaun.pdf", side: "front" }],
      },
    ],
  },
  {
    id: "ebay-1122334455",
    source: "ebay",
    orderNumber: "EB-1122334455",
    customerName: "Messebau Nord",
    customerEmail: "buyer@example.invalid",
    amount: "89,00",
    currency: "EUR",
    receivedAt: "2026-05-16T11:12:00.000Z",
    items: [
      {
        externalLineId: "line-1",
        title: "Roll-Up Display PVC Banner 85 x 200 cm",
        sku: "RU-85x200",
        quantity: 1,
        attributes: { Format: "85 x 200 cm", Material: "PVC Banner" },
        printFiles: [{ name: "EB-1122334455_rollup.pdf", side: "front" }],
      },
      {
        externalLineId: "line-2",
        title: "Sonderprodukt Kundenwunsch",
        sku: "CUSTOM-UNKNOWN",
        quantity: 1,
        attributes: { Info: "Bitte pruefen" },
        printFiles: [],
      },
    ],
  },
];

export const normalizedMockImports = mockExternalOrders.map(normalizeExternalOrder);
