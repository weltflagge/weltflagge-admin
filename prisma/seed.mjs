import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for prisma/seed.mjs");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const manufacturers = [
  {
    code: "OPINION",
    name: "Opinion",
    contactEmail: "produktion@opinion.example",
    specialty: "Normal stoff, mesh stoff, banners",
    exportFormat: "opinion-xlsx",
  },
  {
    code: "LOGO_PL",
    name: "Logo.pl",
    contactEmail: "produktion@logo-pl.example",
    specialty: "155g premium flags and indoor satin Zimmerfahnen",
    exportFormat: "logo-pl-xlsx",
  },
  {
    code: "MPH_MACIEJ",
    name: "MPH - Maciej",
    contactEmail: "maciej@example.com",
    specialty: "Beachflags",
    exportFormat: "mph-maciej-xlsx",
  },
  {
    code: "WMD",
    name: "WMD",
    contactEmail: "produktion@wmd.example",
    specialty: "Roll-Up and X-Banner systems",
    exportFormat: "wmd-xlsx",
  },
];

const orders = [
  {
    orderNumber: "WF-10482",
    source: "WOOCOMMERCE_WELTFLAGGE",
    externalId: "wc-58241",
    receivedAt: "2026-05-15T09:42:00.000Z",
    deadlineAt: "2026-05-20T00:00:00.000Z",
    customerName: "Stadtverwaltung Musterstadt",
    customerEmail: "einkauf@musterstadt.de",
    customerPhone: "+49 30 123456",
    amountCents: 17840,
    paymentStatus: "PAID",
    status: "APPROVAL_MISSING",
    priority: "NORMAL",
    carrier: null,
    trackingNumber: null,
    internalNotes: "Customer should approve the print preview before production starts.",
    billingAddress: {
      company: "Stadtverwaltung Musterstadt",
      name: "Anna Keller",
      street: "Rathausplatz 1",
      postalCode: "10115",
      city: "Berlin",
      country: "Germany",
    },
    shippingAddress: {
      company: "Stadtverwaltung Musterstadt",
      name: "Wareneingang",
      street: "Rathausplatz 1",
      postalCode: "10115",
      city: "Berlin",
      country: "Germany",
    },
    items: [
      {
        lineNumber: 1,
        productName: "Hissfahne",
        sku: "HF-120-300",
        size: "120 x 300 cm",
        quantity: 2,
        printFile: { status: "RECEIVED", fileName: "WF-10482_hissfahne_preview.pdf" },
        production: { manufacturerCode: "OPINION", status: "DRAFT" },
      },
    ],
    activity: [
      { actor: "WooCommerce", message: "Order imported from weltflagge.de.", createdAt: "2026-05-15T09:42:00.000Z" },
      { actor: "System", message: "Payment marked as paid.", createdAt: "2026-05-15T10:05:00.000Z" },
      { actor: "Prepress", message: "Print preview created. Waiting for Druckfreigabe.", createdAt: "2026-05-15T10:18:00.000Z" },
    ],
  },
  {
    orderNumber: "WF-10481",
    source: "WOOCOMMERCE_PARTNER",
    externalId: "wc2-19204",
    receivedAt: "2026-05-15T08:55:00.000Z",
    deadlineAt: "2026-05-18T00:00:00.000Z",
    customerName: "BakerBuildings UG",
    customerEmail: "office@bakerbuildings.de",
    customerPhone: "+49 40 882211",
    amountCents: 9270,
    paymentStatus: "PAID",
    status: "IN_PRODUCTION",
    priority: "HIGH",
    carrier: "DPD",
    trackingNumber: null,
    internalNotes: "Logo file is clean. Production can continue.",
    billingAddress: {
      company: "BakerBuildings UG",
      name: "Jonas Weber",
      street: "Industriestrasse 24",
      postalCode: "20095",
      city: "Hamburg",
      country: "Germany",
    },
    shippingAddress: {
      company: "BakerBuildings UG",
      name: "Marketing",
      street: "Industriestrasse 24",
      postalCode: "20095",
      city: "Hamburg",
      country: "Germany",
    },
    items: [
      {
        lineNumber: 1,
        productName: "PVC Banner",
        sku: "BN-500-100",
        size: "500 x 100 cm",
        quantity: 1,
        printFile: { status: "APPROVED", fileName: "WF-10481_banner_500x100.pdf" },
        production: { manufacturerCode: "OPINION", status: "SENT" },
      },
    ],
    activity: [
      { actor: "Woo shop 2", message: "Order imported from secondary WooCommerce shop.", createdAt: "2026-05-15T08:55:00.000Z" },
      { actor: "Prepress", message: "PDF checked and approved for print.", createdAt: "2026-05-15T09:11:00.000Z" },
      { actor: "Production", message: "Moved to production queue.", createdAt: "2026-05-15T11:30:00.000Z" },
    ],
  },
  {
    orderNumber: "WF-10480",
    source: "EMAIL",
    externalId: "mail-9281",
    receivedAt: "2026-05-14T15:02:00.000Z",
    deadlineAt: "2026-05-17T00:00:00.000Z",
    customerName: "Feuerwehr Beispiel e.V.",
    customerEmail: "kontakt@feuerwehr-beispiel.de",
    customerPhone: "+49 89 555019",
    amountCents: 24995,
    paymentStatus: "OPEN",
    status: "CUSTOMER_REPLY_NEEDED",
    priority: "URGENT",
    carrier: null,
    trackingNumber: null,
    internalNotes: "Clarify logo placement and whether the old brand colors are still valid.",
    billingAddress: {
      company: "Feuerwehr Beispiel e.V.",
      name: "Markus Brandt",
      street: "Hauptstrasse 7",
      postalCode: "80331",
      city: "Muenchen",
      country: "Germany",
    },
    shippingAddress: {
      company: "Feuerwehr Beispiel e.V.",
      name: "Geraetewart",
      street: "Feuerwehrweg 2",
      postalCode: "80331",
      city: "Muenchen",
      country: "Germany",
    },
    items: [
      {
        lineNumber: 1,
        productName: "Beachflag inkl. Gestaltungsservice",
        sku: "BF-M-DESIGN",
        size: "M",
        quantity: 1,
        printFile: { status: "MISSING", fileName: null },
        production: { manufacturerCode: "MPH_MACIEJ", status: "NOT_ROUTED" },
      },
    ],
    activity: [
      { actor: "E-Mail", message: "Manual order request created from customer email.", createdAt: "2026-05-14T15:02:00.000Z" },
      { actor: "Sales", message: "Design service item added to the draft order.", createdAt: "2026-05-14T15:20:00.000Z" },
      { actor: "System", message: "Customer reply required before artwork can be prepared.", createdAt: "2026-05-15T08:40:00.000Z" },
    ],
  },
];

const inventoryItems = [
  { sku: "BF-QUILL-S", name: "Beachflag Quill S System", form: "Quill", size: "S", currentStock: 6, minimumStock: 3, reorderNote: "Standard Nachbestellung pruefen." },
  { sku: "BF-QUILL-M", name: "Beachflag Quill M System", form: "Quill", size: "M", currentStock: 3, minimumStock: 3, reorderNote: "M ist schnell drehend." },
  { sku: "BF-QUILL-L", name: "Beachflag Quill L System", form: "Quill", size: "L", currentStock: 7, minimumStock: 3, reorderNote: null },
  { sku: "BF-FEATHER-S", name: "Beachflag Feather S System", form: "Feather", size: "S", currentStock: 2, minimumStock: 3, reorderNote: "Lieferant anfragen." },
  { sku: "BF-FEATHER-M", name: "Beachflag Feather M System", form: "Feather", size: "M", currentStock: 9, minimumStock: 3, reorderNote: null },
  { sku: "BF-SQUARE-M", name: "Beachflag Square M System", form: "Square", size: "M", currentStock: 0, minimumStock: 2, reorderNote: "Dringend nachbestellen." },
];

async function main() {
  for (const manufacturer of manufacturers) {
    await prisma.manufacturer.upsert({
      where: { code: manufacturer.code },
      update: manufacturer,
      create: manufacturer,
    });
  }

  for (const item of inventoryItems) {
    await prisma.inventoryItem.upsert({
      where: { sku: item.sku },
      update: {
        name: item.name,
        category: "Beachflag",
        form: item.form,
        size: item.size,
        minimumStock: item.minimumStock,
        reorderNote: item.reorderNote,
      },
      create: {
        ...item,
        category: "Beachflag",
        lastStockChangeAt: new Date(),
        movements: {
          create: {
            changeAmount: item.currentStock,
            previousStock: 0,
            newStock: item.currentStock,
            reason: "INITIAL_STOCK",
            note: "Initial seed stock",
            createdBy: "Seed",
          },
        },
      },
    });
  }

  await prisma.order.deleteMany({
    where: { orderNumber: { in: orders.map((order) => order.orderNumber) } },
  });

  for (const order of orders) {
    const createdOrder = await prisma.order.create({
      data: {
        orderNumber: order.orderNumber,
        source: order.source,
        externalId: order.externalId,
        receivedAt: new Date(order.receivedAt),
        deadlineAt: new Date(order.deadlineAt),
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        amountCents: order.amountCents,
        paymentStatus: order.paymentStatus,
        status: order.status,
        priority: order.priority,
        carrier: order.carrier,
        trackingNumber: order.trackingNumber,
        internalNotes: order.internalNotes,
        billingAddress: { create: order.billingAddress },
        shippingAddress: { create: order.shippingAddress },
      },
    });

    for (const item of order.items) {
      const createdItem = await prisma.orderItem.create({
        data: {
          orderId: createdOrder.id,
          lineNumber: item.lineNumber,
          productName: item.productName,
          sku: item.sku,
          size: item.size,
          quantity: item.quantity,
          printFiles: { create: [{ ...item.printFile, side: "FRONT" }] },
          productionState: {
            create: {
              status: item.production.status,
              manufacturer: { connect: { code: item.production.manufacturerCode } },
            },
          },
        },
      });

      await prisma.activityLog.create({
        data: {
          entityType: "ORDER_ITEM",
          actor: "Seed",
          message: `Initial item created: ${createdItem.productName}.`,
          orderId: createdOrder.id,
          orderItemId: createdItem.id,
        },
      });
    }

    await prisma.activityLog.createMany({
      data: order.activity.map((entry) => ({
        entityType: "ORDER",
        actor: entry.actor,
        message: entry.message,
        orderId: createdOrder.id,
        createdAt: new Date(entry.createdAt),
      })),
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
