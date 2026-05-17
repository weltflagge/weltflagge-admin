"use server";

import { redirect } from "next/navigation";
import { getCatalogEntry, getCatalogMaterial, printModeLabels, type PrintMode, type ProductTypeId } from "@/src/lib/product-catalog";
import { getPrisma, hasDatabaseUrl } from "@/src/lib/prisma";
import type { OrderPriority, OrderSource, PrintFileStatus } from "@/src/types/order";

type CreateOrderInput = {
  orderNumber: string;
  source: OrderSource;
  externalId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  company: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  amount: string;
  paymentStatus: "Paid" | "Open";
  priority: OrderPriority;
  deadline: string;
  notes: string;
  items: Array<{
    itemName: string;
    sku: string;
    material: string;
    size: string;
    quantity: string;
    finishing: string;
    printFileName: string;
    printFileBackName: string;
    printFileStatus: PrintFileStatus;
    productType: ProductTypeId;
    materialId: string;
    printMode: PrintMode;
    shape: string;
  }>;
  itemName: string;
  sku: string;
  material: string;
  size: string;
  quantity: string;
  finishing: string;
  printFileName: string;
  printFileStatus: PrintFileStatus;
};

type CreateOrderResult = {
  ok: boolean;
  error?: string;
};

const sourceMap: Record<OrderSource, "WOOCOMMERCE_WELTFLAGGE" | "WOOCOMMERCE_PARTNER" | "EBAY" | "EMAIL" | "ANGEBOT_PDF"> = {
  "woocommerce-weltflagge": "WOOCOMMERCE_WELTFLAGGE",
  "woocommerce-partner": "WOOCOMMERCE_PARTNER",
  ebay: "EBAY",
  email: "EMAIL",
  "angebot-pdf": "ANGEBOT_PDF",
};

const priorityMap: Record<OrderPriority, "NORMAL" | "HIGH" | "URGENT"> = {
  normal: "NORMAL",
  high: "HIGH",
  urgent: "URGENT",
};

const printStatusMap: Record<PrintFileStatus, "MISSING" | "RECEIVED" | "APPROVED" | "PROBLEM"> = {
  missing: "MISSING",
  received: "RECEIVED",
  approved: "APPROVED",
  problem: "PROBLEM",
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

  if (!Number.isFinite(amount) || amount < 0) {
    return 0;
  }

  return Math.round(amount * 100);
}

function inferInitialStatus(
  input: CreateOrderInput,
  items: Array<{ printFileName: string; printFileBackName: string; printFileStatus: PrintFileStatus; printMode: PrintMode }>
) {
  if (input.paymentStatus === "Open") {
    return "PAYMENT_OPEN" as const;
  }

  if (items.some((item) => item.printFileStatus === "problem")) {
    return "CUSTOMER_REPLY_NEEDED" as const;
  }

  if (
    items.some(
      (item) =>
        item.printFileStatus === "missing" ||
        !item.printFileName.trim() ||
        (item.printMode === "double_sided" && !item.printFileBackName.trim())
    )
  ) {
    return "PRINT_FILES_MISSING" as const;
  }

  if (items.some((item) => item.printFileStatus === "received")) {
    return "PRINT_FILES_REVIEW" as const;
  }

  return "PRODUCTION_READY" as const;
}

export async function createManualOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  if (!hasDatabaseUrl()) {
    return { ok: false, error: "DATABASE_URL is not configured yet." };
  }

  const orderNumber = input.orderNumber.trim();
  const externalId = input.externalId.trim() || `manual-${orderNumber}`;
  const customerName = input.customerName.trim();
  const customerEmail = input.customerEmail.trim();
  const submittedItems: CreateOrderInput["items"] = input.items?.length
    ? input.items
    : [
        {
          itemName: input.itemName,
          sku: input.sku,
          material: input.material,
          size: input.size,
          quantity: input.quantity,
          finishing: input.finishing,
          printFileName: input.printFileName,
          printFileBackName: "",
          printFileStatus: input.printFileStatus,
          productType: "flag",
          materialId: "fahnenstoff-115",
          printMode: "single_sided",
          shape: "",
        },
      ];
  const normalizedItems = submittedItems.map((item, index) => ({
    productType: item.productType,
    materialId: item.materialId,
    printMode: item.printMode,
    shape: item.shape.trim(),
    lineNumber: index + 1,
    productName: item.itemName.trim() || getCatalogEntry(item.productType).label,
    sku: item.sku.trim(),
    material: getCatalogMaterial(item.productType, item.materialId).label,
    size: item.size.trim(),
    quantity: Number(item.quantity),
    finishing: [item.finishing.trim(), item.shape.trim() ? `Form: ${item.shape.trim()}` : "", printModeLabels[item.printMode]]
      .filter(Boolean)
      .join(" | "),
    printFileName: item.printFileName.trim(),
    printFileBackName: item.printFileBackName.trim(),
    printFileStatus: item.printFileStatus,
  }));

  if (!orderNumber || !customerName || !customerEmail || normalizedItems.some((item) => !item.productName)) {
    return { ok: false, error: "Order number, customer, email and item name are required." };
  }

  if (normalizedItems.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) {
    return { ok: false, error: "Quantity must be at least 1." };
  }

  const prisma = getPrisma();
  const existingOrder = await prisma.order.findUnique({
    where: { orderNumber },
    select: { id: true },
  });

  if (existingOrder) {
    return { ok: false, error: `Order ${orderNumber} already exists.` };
  }

  const deadlineAt = input.deadline ? new Date(`${input.deadline}T00:00:00.000Z`) : null;
  const amountCents = parseAmountCents(input.amount);
  const manufacturers = await Promise.all(
    [...new Set(normalizedItems.map((item) => getCatalogMaterial(item.productType, item.materialId).manufacturer))].map((manufacturer) =>
      prisma.manufacturer.upsert({
        where: { code: manufacturerDbCodeByUiId[manufacturer] },
        update: {},
        create: {
          code: manufacturerDbCodeByUiId[manufacturer],
          name: manufacturer === "opinion" ? "Opinion" : manufacturer === "logo_pl" ? "Logo.pl" : manufacturer === "mph_maciej" ? "MPH - Maciej" : "WMD",
          exportFormat: `${manufacturer}-xlsx`,
        },
      })
    )
  );
  const manufacturerByCode = new Map(manufacturers.map((manufacturer) => [manufacturer.code, manufacturer]));

  await prisma.order.create({
    data: {
      orderNumber,
      source: sourceMap[input.source],
      externalId,
      receivedAt: new Date(),
      deadlineAt,
      customerName,
      customerEmail,
      customerPhone: input.customerPhone.trim() || null,
      amountCents,
      paymentStatus: input.paymentStatus === "Paid" ? "PAID" : "OPEN",
      status: inferInitialStatus(input, normalizedItems),
      priority: priorityMap[input.priority],
      internalNotes: input.notes.trim() || null,
      billingAddress: {
        create: {
          company: input.company.trim() || customerName,
          name: customerName,
          street: input.street.trim() || null,
          postalCode: input.postalCode.trim() || null,
          city: input.city.trim() || null,
          country: input.country.trim() || null,
        },
      },
      shippingAddress: {
        create: {
          company: input.company.trim() || customerName,
          name: customerName,
          street: input.street.trim() || null,
          postalCode: input.postalCode.trim() || null,
          city: input.city.trim() || null,
          country: input.country.trim() || null,
        },
      },
      items: {
        create: normalizedItems.map((item) => ({
          lineNumber: item.lineNumber,
          productName: item.productName,
          sku: item.sku || null,
          material: item.material || null,
          size: item.size || null,
          quantity: item.quantity,
          finishing: item.finishing || null,
          printFiles: {
            create: [
              {
                side: "FRONT" as const,
                fileName: item.printFileName || null,
                status: item.printFileName ? printStatusMap[item.printFileStatus] : "MISSING",
                source: "manual",
              },
              ...(item.printMode === "double_sided"
                ? [
                    {
                      side: "BACK" as const,
                      fileName: item.printFileBackName || null,
                      status: item.printFileBackName ? printStatusMap[item.printFileStatus] : "MISSING",
                      source: "manual",
                    },
                  ]
                : []),
            ],
          },
          productionState: {
            create: {
              status: "DRAFT",
              manufacturerId: manufacturerByCode.get(manufacturerDbCodeByUiId[getCatalogMaterial(item.productType, item.materialId).manufacturer])?.id,
              routingReason: `Catalog routing: ${getCatalogEntry(item.productType).label} / ${getCatalogMaterial(item.productType, item.materialId).label}.`,
            },
          },
        })),
      },
      activityLogs: {
        create: {
          entityType: "ORDER",
          actor: "Operator",
          message: `Manual order created with ${normalizedItems.length} item${normalizedItems.length === 1 ? "" : "s"}.`,
        },
      },
    },
  });

  redirect(`/orders/${orderNumber}`);
}
