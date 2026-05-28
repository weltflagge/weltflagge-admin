import { getImportStartDate, type ExternalOrderItemPayload, type ExternalOrderPayload, type ExternalOrderSource, type ExternalPrintFile } from "@/src/lib/order-imports";

export type WooCommerceSourceId = Extract<ExternalOrderSource, "woocommerce-weltflagge" | "woocommerce-partner">;

type WooAddress = {
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  address_2?: string;
  postcode?: string;
  city?: string;
  country?: string;
  email?: string;
  phone?: string;
};

type WooMeta = {
  key?: string;
  display_key?: string;
  value?: unknown;
  display_value?: unknown;
};

type WooLineItem = {
  id: number;
  name: string;
  sku?: string;
  quantity: number;
  total?: string;
  meta_data?: WooMeta[];
};

export type WooOrder = {
  id: number;
  number?: string;
  status?: string;
  currency?: string;
  total?: string;
  date_created_gmt?: string;
  date_created?: string;
  billing?: WooAddress;
  shipping?: WooAddress;
  line_items?: WooLineItem[];
  meta_data?: WooMeta[];
};

export type WooSourceConfig = {
  source: WooCommerceSourceId;
  label: string;
  baseUrl?: string;
  consumerKey?: string;
  consumerSecret?: string;
  webhookSecret?: string;
};

const sourceConfigs: Record<WooCommerceSourceId, WooSourceConfig> = {
  "woocommerce-weltflagge": {
    source: "woocommerce-weltflagge",
    label: "weltflagge.de",
    baseUrl: process.env.WOOCOMMERCE_WELTFLAGGE_URL ?? process.env.WOOCOMMERCE_URL,
    consumerKey: process.env.WOOCOMMERCE_WELTFLAGGE_CONSUMER_KEY ?? process.env.WOOCOMMERCE_CONSUMER_KEY,
    consumerSecret: process.env.WOOCOMMERCE_WELTFLAGGE_CONSUMER_SECRET ?? process.env.WOOCOMMERCE_CONSUMER_SECRET,
    webhookSecret: process.env.WOOCOMMERCE_WELTFLAGGE_WEBHOOK_SECRET ?? process.env.IMPORT_SYNC_SECRET,
  },
  "woocommerce-partner": {
    source: "woocommerce-partner",
    label: "flaggeshop.de",
    baseUrl: process.env.WOOCOMMERCE_FLAGGESHOP_URL,
    consumerKey: process.env.WOOCOMMERCE_FLAGGESHOP_CONSUMER_KEY,
    consumerSecret: process.env.WOOCOMMERCE_FLAGGESHOP_CONSUMER_SECRET,
    webhookSecret: process.env.WOOCOMMERCE_FLAGGESHOP_WEBHOOK_SECRET ?? process.env.IMPORT_SYNC_SECRET,
  },
};

export function getWooSourceConfig(source: WooCommerceSourceId) {
  return sourceConfigs[source];
}

export function isWooSourceConfigured(source: WooCommerceSourceId) {
  const config = getWooSourceConfig(source);

  return Boolean(config.baseUrl && config.consumerKey && config.consumerSecret);
}

function requireConfig(source: WooCommerceSourceId) {
  const config = getWooSourceConfig(source);

  if (!config.baseUrl || !config.consumerKey || !config.consumerSecret) {
    throw new Error(`${config.label} WooCommerce config is missing.`);
  }

  return {
    ...config,
    baseUrl: config.baseUrl.replace(/\/$/, ""),
    auth: Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64"),
  };
}

function textValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);

  return "";
}

function addressName(address?: WooAddress) {
  return [address?.first_name, address?.last_name].filter(Boolean).join(" ").trim();
}

function mapAddress(address?: WooAddress) {
  return {
    company: address?.company ?? "",
    name: addressName(address),
    street: [address?.address_1, address?.address_2].filter(Boolean).join(" ").trim(),
    postalCode: address?.postcode ?? "",
    city: address?.city ?? "",
    country: address?.country ?? "",
  };
}

function mapPaymentStatus(status?: string): ExternalOrderPayload["paymentStatus"] {
  if (status === "completed" || status === "processing") return "paid";
  if (status === "refunded") return "refunded";
  if (status === "cancelled" || status === "failed") return "cancelled";

  return "open";
}

function metaAttributes(meta: WooMeta[] | undefined) {
  const attributes: Record<string, string> = {};

  for (const entry of meta ?? []) {
    const key = entry.display_key || entry.key;
    const value = textValue(entry.display_value ?? entry.value);

    if (key && value && !key.startsWith("_")) {
      attributes[key] = value;
    }
  }

  return attributes;
}

function findPrintFiles(lineItem: WooLineItem, order: WooOrder): ExternalPrintFile[] {
  const files: ExternalPrintFile[] = [];
  const allMeta = [...(lineItem.meta_data ?? []), ...(order.meta_data ?? [])];

  for (const entry of allMeta) {
    const key = `${entry.display_key ?? entry.key ?? ""}`.toLowerCase();
    const value = textValue(entry.display_value ?? entry.value);

    if (!value) continue;
    if (!/(druck|print|artwork|upload|datei|file|pdf|design)/i.test(`${key} ${value}`)) continue;

    const urls = value.match(/https?:\/\/[^\s"'<>)]+/g) ?? [];
    if (urls.length === 0 && !/\.(pdf|ai|eps|svg|zip|jpg|jpeg|png)$/i.test(value)) continue;

    for (const url of urls.length ? urls : [value]) {
      const cleanUrl = url.replace(/[.,;]+$/, "");
      const name = decodeURIComponent(cleanUrl.split("/").pop() || `${lineItem.id}-druckdaten`);
      files.push({
        name,
        url: cleanUrl.startsWith("http") ? cleanUrl : undefined,
        side: key.includes("back") || key.includes("rueck") || key.includes("ruck") ? "back" : "front",
      });
    }
  }

  return files;
}

function orderNumberPrefix(source: WooCommerceSourceId) {
  return source === "woocommerce-partner" ? "FS" : "WF";
}

export function mapWooOrder(order: WooOrder, source: WooCommerceSourceId): ExternalOrderPayload {
  const billing = mapAddress(order.billing);
  const shipping = mapAddress(order.shipping);
  const customerName = billing.company || billing.name || shipping.company || shipping.name || "WooCommerce Kunde";
  const prefix = orderNumberPrefix(source);

  return {
    id: `wc-${order.id}`,
    source,
    orderNumber: order.number ? `${prefix}-${order.number}` : `${prefix}-${order.id}`,
    customerName,
    customerEmail: order.billing?.email ?? "",
    customerPhone: order.billing?.phone ?? "",
    amount: order.total ?? "0",
    currency: order.currency === "EUR" ? "EUR" : "EUR",
    receivedAt: order.date_created_gmt ? `${order.date_created_gmt.replace(" ", "T")}.000Z` : order.date_created ?? new Date().toISOString(),
    paymentStatus: mapPaymentStatus(order.status),
    billingAddress: billing,
    shippingAddress: shipping.name || shipping.company || shipping.street ? shipping : billing,
    items: (order.line_items ?? []).map<ExternalOrderItemPayload>((item) => ({
      externalLineId: String(item.id),
      title: item.name,
      sku: item.sku || undefined,
      quantity: item.quantity,
      attributes: metaAttributes(item.meta_data),
      printFiles: findPrintFiles(item, order),
    })),
  };
}

export async function fetchWooOrders(source: WooCommerceSourceId) {
  const config = requireConfig(source);
  const params = new URLSearchParams({
    per_page: "20",
    orderby: "date",
    order: "desc",
    status: "processing,on-hold,pending",
    after: getImportStartDate().toISOString(),
  });
  const response = await fetch(`${config.baseUrl}/wp-json/wc/v3/orders?${params.toString()}`, {
    headers: {
      Authorization: `Basic ${config.auth}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`${config.label} WooCommerce sync failed (${response.status}).`);
  }

  const orders = (await response.json()) as WooOrder[];
  return orders.map((order) => mapWooOrder(order, source));
}

export async function fetchWeltflaggeWooOrders() {
  return fetchWooOrders("woocommerce-weltflagge");
}
