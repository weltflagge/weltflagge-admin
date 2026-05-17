import { getCatalogEntry, getCatalogMaterial, type PrintMode, type ProductTypeId } from "@/src/lib/product-catalog";
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
  amount: string;
  currency: "EUR";
  receivedAt: string;
  items: ExternalOrderItemPayload[];
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
  amount: string;
  receivedAt: string;
  items: NormalizedImportItem[];
  readyItems: number;
  reviewItems: number;
};

function textIncludes(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle));
}

function normalizeText(value: string) {
  return value.toLowerCase().replaceAll("ß", "ss").replaceAll("²", "2");
}

function getAttribute(payload: ExternalOrderItemPayload, names: string[]) {
  const entries = Object.entries(payload.attributes);
  const normalizedNames = names.map(normalizeText);
  const match = entries.find(([key]) => normalizedNames.includes(normalizeText(key)));

  return match?.[1] ?? "";
}

function detectProductType(payload: ExternalOrderItemPayload): ProductTypeId | undefined {
  const haystack = normalizeText(`${payload.title} ${payload.sku ?? ""} ${Object.values(payload.attributes).join(" ")}`);

  if (textIncludes(haystack, ["beachflag", "beach flag", "tropfen", "haiflosse", "welle"])) {
    return "beachflag";
  }

  if (textIncludes(haystack, ["bauzaun"])) {
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
  const explicitSize = getAttribute(payload, ["size", "groesse", "größe", "format", "masse", "maße"]);

  if (explicitSize) {
    return explicitSize;
  }

  if (productType === "bauzaunbanner") {
    return getCatalogEntry("bauzaunbanner").defaultSize ?? "";
  }

  if (productType === "beachflag" && shape) {
    const haystack = normalizeText(`${payload.title} ${Object.values(payload.attributes).join(" ")}`);
    const sizes = getCatalogEntry("beachflag").sizes?.[shape] ?? [];
    const size = sizes.find((candidate) => haystack.split(/\W+/).includes(normalizeText(candidate)));

    return size ?? "";
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
    amount: `${payload.amount} ${payload.currency}`,
    receivedAt: payload.receivedAt,
    items,
    readyItems: items.filter((item) => item.confidence === "high").length,
    reviewItems: items.filter((item) => item.confidence === "needs_review").length,
  };
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
