"use server";

import { redirect } from "next/navigation";
import { createRequire } from "node:module";
import { parseAngebotText, type AngebotDraft } from "@/src/lib/angebot-parser";
import { getPrisma, hasDatabaseUrl } from "@/src/lib/prisma";
import type { OrderItemType } from "@/src/types/order";

type ActionResult = {
  ok: boolean;
  error?: string;
  draft?: AngebotDraft;
};

type CreateImportedOrderResult = {
  ok: boolean;
  error?: string;
};

const require = createRequire(import.meta.url);

const itemTypeMap: Record<OrderItemType, "PRODUCTION_ITEM" | "ACCESSORY_ITEM" | "SERVICE_ITEM" | "SHIPPING_ITEM"> = {
  production_item: "PRODUCTION_ITEM",
  accessory_item: "ACCESSORY_ITEM",
  service_item: "SERVICE_ITEM",
  shipping_item: "SHIPPING_ITEM",
};

const manufacturerDbCodeByUiId = {
  opinion: "OPINION",
  logo_pl: "LOGO_PL",
  mph_maciej: "MPH_MACIEJ",
  wmd: "WMD",
} as const;

type ManufacturerUiId = keyof typeof manufacturerDbCodeByUiId;

function parseAmountCents(value: string) {
  const normalized = value.replace("EUR", "").replace(/\s/g, "").replace(".", "").replace(",", ".");
  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount < 0) {
    return 0;
  }

  return Math.round(amount * 100);
}

function inferManufacturer(input: { productName: string; material: string; sku: string }): ManufacturerUiId {
  const haystack = `${input.productName} ${input.material} ${input.sku}`.toLowerCase();

  if (haystack.includes("155") || haystack.includes("premium") || haystack.includes("satin") || haystack.includes("zimmer")) {
    return "logo_pl";
  }

  if (haystack.includes("beachflag") || haystack.includes("beach flag")) {
    return "mph_maciej";
  }

  if (haystack.includes("roll-up") || haystack.includes("rollup") || haystack.includes("x-banner")) {
    return "wmd";
  }

  return "opinion";
}

async function extractPdfText(file: File) {
  const { PDFParse } = require("pdf-parse") as typeof import("pdf-parse");
  const parser = new PDFParse({ data: Buffer.from(await file.arrayBuffer()) });
  const result = await parser.getText();
  await parser.destroy();

  return result.text;
}

export async function parseAngebotPdf(formData: FormData): Promise<ActionResult> {
  const file = formData.get("pdf");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Bitte eine Angebot-PDF hochladen." };
  }

  if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
    return { ok: false, error: "Die Datei muss eine PDF sein." };
  }

  try {
    const text = await extractPdfText(file);
    const draft = parseAngebotText(text, file.name);
    return { ok: true, draft };
  } catch (error) {
    console.error("Failed to parse Angebot PDF.", error);
    return { ok: false, error: "PDF konnte nicht gelesen werden. Bitte pruefen, ob die Datei Text enthaelt." };
  }
}

export async function createOrderFromAngebot(input: AngebotDraft): Promise<CreateImportedOrderResult> {
  if (!hasDatabaseUrl()) {
    return { ok: false, error: "DATABASE_URL is not configured yet." };
  }

  const orderNumber = input.orderNumber.trim();
  const customerName = input.customerName.trim() || input.billingCompany.trim() || input.billingName.trim();
  const customerEmail = input.customerEmail.trim();
  const items = input.items.map((item, index) => ({
    ...item,
    lineNumber: index + 1,
    productName: item.productName.trim(),
    quantity: Number(item.quantity),
    itemType: item.itemType,
  }));

  if (!orderNumber || !customerName) {
    return { ok: false, error: "Auftragsnummer und Kunde sind erforderlich." };
  }

  if (items.length === 0 || items.some((item) => !item.productName)) {
    return { ok: false, error: "Mindestens eine Position mit Produktname ist erforderlich." };
  }

  if (items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) {
    return { ok: false, error: "Die Stueckzahl muss mindestens 1 sein." };
  }

  if (
    items.some(
      (item) =>
        item.itemType === "production_item" &&
        (!item.verifiedQuantity || !item.verifiedSize || !item.verifiedFinishing)
    )
  ) {
    return { ok: false, error: "Bitte bei allen Produktionsartikeln Stueckzahl, Groesse und Konfektion bewusst pruefen und abhaken." };
  }

  const prisma = getPrisma();
  const existingOrder = await prisma.order.findUnique({
    where: { orderNumber },
    select: { id: true },
  });

  if (existingOrder) {
    return { ok: false, error: `Order ${orderNumber} already exists.` };
  }

  const productionItems = items.filter((item) => item.itemType === "production_item");
  const manufacturerCodes = [...new Set(productionItems.map((item) => manufacturerDbCodeByUiId[inferManufacturer(item)]))];
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
  const amountCents = input.amount ? parseAmountCents(input.amount) : items.reduce((sum, item) => sum + parseAmountCents(item.totalPrice), 0);

  await prisma.order.create({
    data: {
      orderNumber,
      source: "ANGEBOT_PDF",
      externalId: input.offerNumber.trim() || orderNumber,
      receivedAt: input.offerDate ? new Date(`${input.offerDate}T00:00:00.000Z`) : new Date(),
      customerName,
      customerEmail: customerEmail || "angebot-import@weltflagge.local",
      customerPhone: input.customerPhone.trim() || null,
      amountCents,
      paymentStatus: "OPEN",
      status: "NEW",
      priority: "NORMAL",
      internalNotes: input.notes.trim() || `Aus Angebot PDF importiert: ${input.sourceFileName}`,
      rawPayload: {
        importSource: "angebot_pdf",
        offerNumber: input.offerNumber,
        offerDate: input.offerDate,
        sourceFileName: input.sourceFileName,
        extractedText: input.extractedText,
        uncertainFields: input.uncertainFields,
      },
      billingAddress: {
        create: {
          company: input.billingCompany.trim() || customerName,
          name: input.billingName.trim() || customerName,
          street: input.billingStreet.trim() || null,
          postalCode: input.billingPostalCode.trim() || null,
          city: input.billingCity.trim() || null,
          country: input.billingCountry.trim() || null,
        },
      },
      shippingAddress: {
        create: {
          company: input.shippingCompany.trim() || input.billingCompany.trim() || customerName,
          name: input.shippingName.trim() || input.billingName.trim() || customerName,
          street: input.shippingStreet.trim() || input.billingStreet.trim() || null,
          postalCode: input.shippingPostalCode.trim() || input.billingPostalCode.trim() || null,
          city: input.shippingCity.trim() || input.billingCity.trim() || null,
          country: input.shippingCountry.trim() || input.billingCountry.trim() || null,
        },
      },
      items: {
        create: items.map((item) => {
          const manufacturerCode = manufacturerDbCodeByUiId[inferManufacturer(item)];

          return {
            lineNumber: item.lineNumber,
            productName: item.productName,
            sku: item.sku.trim() || null,
            material: item.material.trim() || null,
            size: item.size.trim() || null,
            quantity: item.quantity,
            finishing: item.finishing.trim() || null,
            unitAmountCents: parseAmountCents(item.unitPrice) || null,
            itemType: itemTypeMap[item.itemType],
            notes: item.notes.trim() || null,
            printFiles:
              item.itemType === "production_item"
                ? {
                    create: {
                      side: "FRONT" as const,
                      status: "MISSING" as const,
                      source: "angebot_pdf",
                    },
                  }
                : undefined,
            productionState:
              item.itemType === "production_item"
                ? {
                    create: {
                      status: "DRAFT" as const,
                      manufacturerId: manufacturerByCode.get(manufacturerCode)?.id,
                      routingReason: "Angebot PDF import - bitte Hersteller bei Bedarf pruefen.",
                    },
                  }
                : undefined,
          };
        }),
      },
      activityLogs: {
        create: {
          entityType: "ORDER",
          actor: "Operator",
          message: `Angebot PDF importiert mit ${items.length} Positionen (${productionItems.length} Produktionsartikel).`,
        },
      },
    },
  });

  redirect(`/orders/${orderNumber}`);
}
