import type { OrderItemType } from "@/src/types/order";

export type AngebotDraftItem = {
  id: string;
  lineNumber: number;
  itemType: OrderItemType;
  productName: string;
  sku: string;
  quantity: string;
  size: string;
  material: string;
  finishing: string;
  unitPrice: string;
  totalPrice: string;
  notes: string;
  uncertainFields: string[];
};

export type AngebotDraft = {
  orderNumber: string;
  offerNumber: string;
  offerDate: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  billingCompany: string;
  billingName: string;
  billingStreet: string;
  billingPostalCode: string;
  billingCity: string;
  billingCountry: string;
  shippingCompany: string;
  shippingName: string;
  shippingStreet: string;
  shippingPostalCode: string;
  shippingCity: string;
  shippingCountry: string;
  amount: string;
  notes: string;
  sourceFileName: string;
  extractedText: string;
  uncertainFields: string[];
  items: AngebotDraftItem[];
};

const productionWords = [
  "flagge",
  "fahne",
  "werbefahne",
  "beachflag",
  "banner",
  "roll-up",
  "rollup",
  "x-banner",
  "druckprodukt",
  "mesh",
  "plane",
];

const accessoryWords = ["querstab", "endkugel", "halterung", "zubehoer", "zubehor", "stange", "bodenplatte", "tasche"];
const serviceWords = ["design-service", "datenanpassung", "grafikservice", "druckdatenpruefung", "druckdatenprüfung"];
const shippingWords = ["versand", "versandkosten", "lieferung"];

function normalizeWhitespace(value: string) {
  return value.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function findFirst(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return "";
}

function normalizeDate(value: string) {
  const match = value.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);

  if (!match) {
    return "";
  }

  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function normalizeMoney(value: string) {
  return value.replace(/\s*EUR/i, "").trim();
}

export function classifyAngebotItem(productName: string, details = ""): OrderItemType {
  const haystack = `${productName} ${details}`.toLowerCase();

  if (shippingWords.some((word) => haystack.includes(word))) {
    return "shipping_item";
  }

  if (serviceWords.some((word) => haystack.includes(word))) {
    return "service_item";
  }

  if (accessoryWords.some((word) => haystack.includes(word))) {
    return "accessory_item";
  }

  if (productionWords.some((word) => haystack.includes(word))) {
    return "production_item";
  }

  if (/\d{2,4}\s*[x×]\s*\d{2,4}\s*(cm|mm|m)?/i.test(haystack) && /(stoff|pvc|mesh|polyester|material|druck)/i.test(haystack)) {
    return "production_item";
  }

  return "production_item";
}

function detectSize(value: string) {
  return findFirst(value, [/(\d{2,4}\s*[x×]\s*\d{2,4}\s*(?:cm|mm|m)?)/i, /(?:groesse|größe|format)[:\s]+([^,\n]+)/i]);
}

function detectMaterial(value: string) {
  return findFirst(value, [
    /(?:material|stoff)[:\s]+([^,\n]+)/i,
    /((?:fahnenstoff|polyester|pvc|mesh|satin|premium)[^,\n]*)/i,
  ]);
}

function detectFinishing(value: string) {
  return findFirst(value, [
    /(?:konfektion|befestigung|verarbeitung)[:\s]+([^,\n]+)/i,
    /((?:hohlsaum|oesen|ösen|karabiner|saum|doppelnaht|tunnel|beschnitt)[^,\n]*)/i,
  ]);
}

function parseLineItem(line: string, index: number): AngebotDraftItem | null {
  const normalized = line.trim();
  const itemMatch = normalized.match(/^(?:pos\.?\s*)?(\d+)[.)\s-]+(.+)$/i);
  const body = itemMatch?.[2] ?? normalized;

  if (!itemMatch && !/(flagge|fahne|banner|beachflag|querstab|design|versand|lieferung|roll)/i.test(body)) {
    return null;
  }

  const quantity = findFirst(body, [
    /(?:menge|anzahl|stueck|stück|qty)[:\s]+(\d+)/i,
    /\b(\d+)\s*(?:st\.?|stk\.?|stück|stueck)\b/i,
  ]);
  const prices = [...body.matchAll(/(\d{1,3}(?:\.\d{3})*,\d{2})\s*(?:EUR|€)?/gi)].map((match) => normalizeMoney(match[1]));
  const cleanName = body
    .replace(/\d{1,3}(?:\.\d{3})*,\d{2}\s*(?:EUR|€)?/gi, "")
    .replace(/\b\d+\s*(?:st\.?|stk\.?|stück|stueck)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const productName = cleanName.replace(/^(?:artikel|produkt)[:\s]+/i, "").trim();
  const itemType = classifyAngebotItem(productName, body);
  const uncertainFields = [
    !productName ? "productName" : "",
    !quantity ? "quantity" : "",
    itemType === "production_item" && !detectSize(body) ? "size" : "",
    itemType === "production_item" && !detectMaterial(body) ? "material" : "",
  ].filter(Boolean);

  return {
    id: `line-${index + 1}`,
    lineNumber: Number(itemMatch?.[1] ?? index + 1),
    itemType,
    productName: productName || body.slice(0, 80),
    sku: "",
    quantity: quantity || "1",
    size: detectSize(body),
    material: detectMaterial(body),
    finishing: detectFinishing(body),
    unitPrice: prices[0] ?? "",
    totalPrice: prices.at(-1) ?? "",
    notes: "",
    uncertainFields,
  };
}

function parseItemBlock(block: string, index: number): AngebotDraftItem | null {
  const normalized = block.replace(/\s+/g, " ").trim();
  const itemMatch = normalized.match(/^(\d+)\.\s+(.+?)(?=\s+\d+(?:,\d+)?\s*Stk\b|\s+\d{1,3}(?:\.\d{3})*,\d{2}\s*(?:EUR|€)|$)/i);

  if (!itemMatch) {
    return parseLineItem(block, index);
  }

  const productName = itemMatch[2].trim();
  const quantity = findFirst(normalized, [/\b(\d+(?:,\d+)?)\s*Stk\b/i]);
  const prices = [...normalized.matchAll(/(\d{1,3}(?:\.\d{3})*,\d{2})\s*(?:EUR|€)?/gi)].map((match) => normalizeMoney(match[1]));
  const itemType = classifyAngebotItem(productName, normalized);
  const size = detectSize(normalized);
  const material = detectMaterial(normalized);
  const finishing = detectFinishing(normalized);
  const uncertainFields = [
    !productName ? "productName" : "",
    !quantity ? "quantity" : "",
    itemType === "production_item" && !size ? "size" : "",
    itemType === "production_item" && !material ? "material" : "",
  ].filter(Boolean);

  return {
    id: `line-${index + 1}`,
    lineNumber: Number(itemMatch[1]),
    itemType,
    productName,
    sku: findFirst(normalized, [/(?:artikelnummer|sku)[:\s]+([A-Z0-9-]+)/i]),
    quantity: quantity ? quantity.replace(",", ".") : "1",
    size,
    material,
    finishing,
    unitPrice: prices[0] ?? "",
    totalPrice: prices.at(-1) ?? "",
    notes: itemType === "production_item" ? "" : normalized.replace(productName, "").trim(),
    uncertainFields,
  };
}

function getPositionBlocks(lines: string[]) {
  const blocks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (/^\d+\.\s+/.test(line)) {
      if (current.length > 0) {
        blocks.push(current.join("\n"));
      }

      current = [line];
      continue;
    }

    if (current.length > 0) {
      if (/^(friedrich|angebot|datum|ihre kundennummer|ihr ansprechpartner|\d+\/\d+|--)/i.test(line)) {
        blocks.push(current.join("\n"));
        current = [];
        continue;
      }

      current.push(line);
    }
  }

  if (current.length > 0) {
    blocks.push(current.join("\n"));
  }

  return blocks;
}

function parseItems(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const blockCandidates = getPositionBlocks(lines)
    .map((block, index) => parseItemBlock(block, index))
    .filter((item): item is AngebotDraftItem => Boolean(item));
  const candidates = blockCandidates.length > 0
    ? blockCandidates
    : lines.map((line, index) => parseLineItem(line, index)).filter((item): item is AngebotDraftItem => Boolean(item));

  const deduped = new Map<string, AngebotDraftItem>();
  for (const item of candidates) {
    const key = `${item.lineNumber}-${item.productName.toLowerCase()}`;
    if (!deduped.has(key)) {
      deduped.set(key, item);
    }
  }

  return [...deduped.values()];
}

function detectAddress(text: string) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const senderIndex = lines.findIndex((line) => /^Friedrich\s*&\s*Rick GbR\s*-/i.test(line));
  const addressLines =
    senderIndex >= 0
      ? lines.slice(senderIndex + 1, senderIndex + 7).filter((line) => !/^Deutschland$/i.test(line))
      : lines.slice(0, 8).filter((line) => !/angebot|datum|kund|friedrich|rick/i.test(line));
  const postalLine = addressLines.find((line) => /\b\d{5}\b/.test(line)) ?? "";
  const postalMatch = postalLine.match(/(\d{5})\s+(.+)/);

  return {
    company: addressLines[0] ?? "",
    name: addressLines[1] ?? addressLines[0] ?? "",
    street: addressLines.find((line) => /\d/.test(line) && !/\b\d{5}\b/.test(line)) ?? "",
    postalCode: postalMatch?.[1] ?? "",
    city: postalMatch?.[2] ?? "",
  };
}

export function parseAngebotText(text: string, sourceFileName: string): AngebotDraft {
  const normalizedText = normalizeWhitespace(text);
  const offerNumber = findFirst(normalizedText, [
    /(?:angebot(?:snummer)?|angebot nr\.?|nr\.)[:\s#-]*([A-Z]{0,4}[-\s]?\d{4,})/i,
    /\b(AN[-\s]?\d{4,})\b/i,
  ]);
  const offerDateRaw = findFirst(normalizedText, [/(?:angebotsdatum|datum)[:\s]+(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i]);
  const email = findFirst(normalizedText, [/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i]);
  const phone = findFirst(normalizedText, [/(?:telefon|tel\.?|phone)[:\s]+([+0-9 ()/-]{6,})/i]);
  const address = detectAddress(normalizedText);
  const total = findFirst(normalizedText, [
    /(?:gesamtbetrag|endbetrag|summe|gesamt)[:\s]+(\d{1,3}(?:\.\d{3})*,\d{2})\s*(?:EUR|€)?/i,
  ]);
  const items = parseItems(normalizedText);
  const uncertainFields = [
    !offerNumber ? "offerNumber" : "",
    !address.company && !address.name ? "customerName" : "",
    !email ? "customerEmail" : "",
    items.length === 0 ? "items" : "",
  ].filter(Boolean);

  return {
    orderNumber: offerNumber || `AN-${Date.now().toString().slice(-6)}`,
    offerNumber,
    offerDate: normalizeDate(offerDateRaw),
    customerName: address.company || address.name,
    customerEmail: email,
    customerPhone: phone,
    billingCompany: address.company,
    billingName: address.name,
    billingStreet: address.street,
    billingPostalCode: address.postalCode,
    billingCity: address.city,
    billingCountry: "Deutschland",
    shippingCompany: "",
    shippingName: "",
    shippingStreet: "",
    shippingPostalCode: "",
    shippingCity: "",
    shippingCountry: "",
    amount: normalizeMoney(total),
    notes: "",
    sourceFileName,
    extractedText: normalizedText.slice(0, 12000),
    uncertainFields,
    items,
  };
}
