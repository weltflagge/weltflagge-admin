"use server";

import { revalidatePath } from "next/cache";
import type { ActivityLogEntry, Order, OrderPriority, OrderStatus, PrintFileStatus } from "@/src/types/order";
import { getPrisma, hasDatabaseUrl } from "@/src/lib/prisma";

type PrintFileUpdateInput = {
  orderNumber: string;
  itemId?: string;
  sku: string;
  side?: "front" | "back" | "general";
  fileName: string;
  status: PrintFileStatus;
};

type PrintFileUpdateResult = {
  ok: boolean;
  error?: string;
  timelineEntry?: ActivityLogEntry;
};

type OrderStatusUpdateInput = {
  orderNumber: string;
  status: Extract<OrderStatus, "In production" | "Ready to ship">;
};

type TrackingUpdateInput = {
  orderNumber: string;
  carrier: string;
  trackingNumber: string;
};

type EditableOrderUpdateInput = {
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: Order["paymentStatus"];
  priority: OrderPriority;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingCompany: string;
  shippingName: string;
  shippingStreet: string;
  shippingPostalCode: string;
  shippingCity: string;
  shippingCountry: string;
};

type OrderArchiveInput = {
  orderNumber: string;
  action: "ship" | "complete" | "reopen";
};

type ProductionResetInput = {
  orderNumber: string;
};

type OrderActionResult = {
  ok: boolean;
  error?: string;
  timelineEntry?: ActivityLogEntry;
};

const dbStatusByUiStatus: Record<PrintFileStatus, "MISSING" | "RECEIVED" | "APPROVED" | "PROBLEM"> = {
  missing: "MISSING",
  received: "RECEIVED",
  approved: "APPROVED",
  problem: "PROBLEM",
};

const dbPrintFileSideByUiSide: Record<NonNullable<PrintFileUpdateInput["side"]>, "FRONT" | "BACK" | "GENERAL"> = {
  front: "FRONT",
  back: "BACK",
  general: "GENERAL",
};

const dbOrderStatusByUiStatus: Record<OrderStatusUpdateInput["status"], "IN_PRODUCTION" | "READY_TO_SHIP"> = {
  "In production": "IN_PRODUCTION",
  "Ready to ship": "READY_TO_SHIP",
};

const dbAnyOrderStatusByUiStatus: Record<OrderStatus, "NEW" | "PAYMENT_OPEN" | "PRINT_FILES_MISSING" | "PRINT_FILES_REVIEW" | "CUSTOMER_REPLY_NEEDED" | "APPROVAL_MISSING" | "PRODUCTION_READY" | "IN_PRODUCTION" | "READY_TO_SHIP" | "SHIPPED" | "COMPLETED"> = {
  New: "NEW",
  "Payment open": "PAYMENT_OPEN",
  "Print files missing": "PRINT_FILES_MISSING",
  "Print files review": "PRINT_FILES_REVIEW",
  "Customer reply needed": "CUSTOMER_REPLY_NEEDED",
  "Approval missing": "APPROVAL_MISSING",
  "Production ready": "PRODUCTION_READY",
  "In production": "IN_PRODUCTION",
  "Ready to ship": "READY_TO_SHIP",
  Shipped: "SHIPPED",
  Completed: "COMPLETED",
};

const dbPriorityByUiPriority: Record<OrderPriority, "NORMAL" | "HIGH" | "URGENT"> = {
  normal: "NORMAL",
  high: "HIGH",
  urgent: "URGENT",
};

const dbPaymentStatusByUiStatus: Record<Order["paymentStatus"], "PAID" | "OPEN"> = {
  Paid: "PAID",
  Open: "OPEN",
};

const reopensProductionStatuses = new Set<OrderStatus>([
  "Payment open",
  "Print files missing",
  "Print files review",
  "Customer reply needed",
  "Approval missing",
]);

function formatTimestamp(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export async function updateOrderItemPrintFile(input: PrintFileUpdateInput): Promise<PrintFileUpdateResult> {
  if (!hasDatabaseUrl()) {
    return {
      ok: false,
      error: "DATABASE_URL is not configured yet, so this change is only kept in local mock state.",
    };
  }

  const fileName = input.fileName.trim();
  const status = dbStatusByUiStatus[fileName ? input.status : "missing"];
  const side = dbPrintFileSideByUiSide[input.side ?? "front"];
  const prisma = getPrisma();

  const orderItem = await prisma.orderItem.findFirst({
    where: {
      ...(input.itemId ? { id: input.itemId } : { sku: input.sku }),
      order: { orderNumber: input.orderNumber },
    },
    include: { order: true },
  });

  if (!orderItem) {
    return { ok: false, error: `No order item found for ${input.itemId ? "selected line item" : `SKU ${input.sku}`}.` };
  }

  const message = fileName
    ? `Druckdaten ${side.toLowerCase()} fuer ${orderItem.productName} aktualisiert: ${fileName} (${input.status}).`
    : `Druckdaten ${side.toLowerCase()} fuer ${orderItem.productName} entfernt.`;

  const now = new Date();

  const activity = await prisma.$transaction(async (tx) => {
    await tx.printFile.upsert({
      where: { orderItemId_side: { orderItemId: orderItem.id, side } },
      create: {
        orderItemId: orderItem.id,
        side,
        fileName: fileName || null,
        status,
        checkedAt: now,
        checkedBy: "Operator",
      },
      update: {
        fileName: fileName || null,
        status,
        checkedAt: now,
        checkedBy: "Operator",
      },
    });

    if (status === "MISSING" || status === "RECEIVED" || status === "PROBLEM") {
      await tx.orderItemProductionState.updateMany({
        where: { orderItemId: orderItem.id },
        data: {
          status: "DRAFT",
          sentAt: null,
          currentBatchId: null,
        },
      });

      await tx.order.update({
        where: { id: orderItem.orderId },
        data: {
          status: status === "MISSING" ? "PRINT_FILES_MISSING" : status === "RECEIVED" ? "PRINT_FILES_REVIEW" : "CUSTOMER_REPLY_NEEDED",
        },
      });
    }

    return tx.activityLog.create({
      data: {
        entityType: "ORDER_ITEM",
        actor: "Operator",
        message,
        orderId: orderItem.orderId,
        orderItemId: orderItem.id,
        createdAt: now,
      },
    });
  });

  revalidatePath(`/orders/${input.orderNumber}`);

  return {
    ok: true,
    timelineEntry: {
      id: activity.id,
      timestamp: formatTimestamp(activity.createdAt),
      actor: activity.actor,
      message: activity.message,
    },
  };
}

export async function updateOrderWorkflowStatus(input: OrderStatusUpdateInput): Promise<OrderActionResult> {
  if (!hasDatabaseUrl()) {
    return {
      ok: false,
      error: "DATABASE_URL is not configured yet, so this status change is only kept in local mock state.",
    };
  }

  const prisma = getPrisma();
  const dbOrderStatus = dbOrderStatusByUiStatus[input.status];
  const message =
    input.status === "In production"
      ? "Auftrag wurde in Produktion gesetzt."
      : "Auftrag wurde versandbereit gesetzt.";
  const now = new Date();

  const order = await prisma.order.findUnique({
    where: { orderNumber: input.orderNumber },
    select: { id: true },
  });

  if (!order) {
    return { ok: false, error: `No order found for ${input.orderNumber}.` };
  }

  const activity = await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: dbOrderStatus },
    });

    return tx.activityLog.create({
      data: {
        entityType: "ORDER",
        actor: "Operator",
        message,
        orderId: order.id,
        createdAt: now,
      },
    });
  });

  revalidatePath(`/orders/${input.orderNumber}`);
  revalidatePath("/orders");

  return {
    ok: true,
    timelineEntry: {
      id: activity.id,
      timestamp: formatTimestamp(activity.createdAt),
      actor: activity.actor,
      message: activity.message,
    },
  };
}

export async function updateOrderTracking(input: TrackingUpdateInput): Promise<OrderActionResult> {
  if (!hasDatabaseUrl()) {
    return {
      ok: false,
      error: "DATABASE_URL is not configured yet, so this tracking change is only kept in local mock state.",
    };
  }

  const carrier = input.carrier.trim();
  const trackingNumber = input.trackingNumber.trim();

  if (!carrier && !trackingNumber) {
    return { ok: false, error: "Versanddienst oder Sendungsnummer ist erforderlich." };
  }

  const prisma = getPrisma();
  const now = new Date();

  const order = await prisma.order.findUnique({
    where: { orderNumber: input.orderNumber },
    select: { id: true },
  });

  if (!order) {
    return { ok: false, error: `No order found for ${input.orderNumber}.` };
  }

  const message = carrier
    ? `Versanddaten gespeichert: ${carrier} ${trackingNumber}.`
    : `Versanddaten gespeichert: ${trackingNumber}.`;

  const activity = await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        carrier: carrier || null,
        trackingNumber: trackingNumber || null,
      },
    });

    return tx.activityLog.create({
      data: {
        entityType: "ORDER",
        actor: "Operator",
        message,
        orderId: order.id,
        createdAt: now,
      },
    });
  });

  revalidatePath(`/orders/${input.orderNumber}`);
  revalidatePath("/orders");

  return {
    ok: true,
    timelineEntry: {
      id: activity.id,
      timestamp: formatTimestamp(activity.createdAt),
      actor: activity.actor,
      message: activity.message,
    },
  };
}

export async function updateOrderEditableFields(input: EditableOrderUpdateInput): Promise<OrderActionResult> {
  if (!hasDatabaseUrl()) {
    return {
      ok: false,
      error: "DATABASE_URL is not configured yet, so this order change is only kept in local mock state.",
    };
  }

  const customerName = input.customerName.trim();
  const customerEmail = input.customerEmail.trim();

  if (!customerName || !customerEmail) {
    return { ok: false, error: "Kundenname und E-Mail sind erforderlich." };
  }

  const prisma = getPrisma();
  const now = new Date();

  const order = await prisma.order.findUnique({
    where: { orderNumber: input.orderNumber },
    include: { shippingAddress: true },
  });

  if (!order) {
    return { ok: false, error: `No order found for ${input.orderNumber}.` };
  }

  if ((input.status === "Shipped" || input.status === "Completed") && (!order.carrier || !order.trackingNumber)) {
    return { ok: false, error: "Versanddienst und Sendungsnummer sind vor Versand oder Abschluss erforderlich." };
  }

  const activity = await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: dbAnyOrderStatusByUiStatus[input.status],
        paymentStatus: dbPaymentStatusByUiStatus[input.paymentStatus],
        priority: dbPriorityByUiPriority[input.priority],
        customerName,
        customerEmail,
        customerPhone: input.customerPhone.trim() || null,
        shippingAddress: {
          upsert: {
            create: {
              company: input.shippingCompany.trim() || null,
              name: input.shippingName.trim() || customerName,
              street: input.shippingStreet.trim() || null,
              postalCode: input.shippingPostalCode.trim() || null,
              city: input.shippingCity.trim() || null,
              country: input.shippingCountry.trim() || null,
            },
            update: {
              company: input.shippingCompany.trim() || null,
              name: input.shippingName.trim() || customerName,
              street: input.shippingStreet.trim() || null,
              postalCode: input.shippingPostalCode.trim() || null,
              city: input.shippingCity.trim() || null,
              country: input.shippingCountry.trim() || null,
            },
          },
        },
      },
    });

    if (reopensProductionStatuses.has(input.status)) {
      await tx.orderItemProductionState.updateMany({
        where: { orderItem: { orderId: order.id } },
        data: {
          status: "DRAFT",
          sentAt: null,
          currentBatchId: null,
        },
      });
    }

    return tx.activityLog.create({
      data: {
        entityType: "ORDER",
        actor: "Operator",
        message: "Auftragsdaten wurden aktualisiert.",
        orderId: order.id,
        createdAt: now,
      },
    });
  });

  revalidatePath(`/orders/${input.orderNumber}`);
  revalidatePath("/orders");

  return {
    ok: true,
    timelineEntry: {
      id: activity.id,
      timestamp: formatTimestamp(activity.createdAt),
      actor: activity.actor,
      message: activity.message,
    },
  };
}

export async function updateOrderArchiveStatus(input: OrderArchiveInput): Promise<OrderActionResult> {
  if (!hasDatabaseUrl()) {
    return {
      ok: false,
      error: "DATABASE_URL is not configured yet, so this archive change is only kept in local mock state.",
    };
  }

  const prisma = getPrisma();
  const now = new Date();
  const order = await prisma.order.findUnique({
    where: { orderNumber: input.orderNumber },
    select: {
      id: true,
      carrier: true,
      trackingNumber: true,
    },
  });

  if (!order) {
    return { ok: false, error: `No order found for ${input.orderNumber}.` };
  }

  if ((input.action === "ship" || input.action === "complete") && (!order.carrier || !order.trackingNumber)) {
    return { ok: false, error: "Versanddienst und Sendungsnummer sind vor Versand oder Abschluss erforderlich." };
  }

  const nextStatus =
    input.action === "reopen" ? "IN_PRODUCTION" : input.action === "complete" ? "COMPLETED" : "SHIPPED";
  const message =
    input.action === "reopen"
      ? "Auftrag wurde wieder geoeffnet und in Produktion gesetzt."
      : input.action === "complete"
        ? "Auftrag wurde abgeschlossen."
        : "Auftrag wurde als versendet markiert.";

  const activity = await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: nextStatus },
    });

    return tx.activityLog.create({
      data: {
        entityType: "ORDER",
        actor: "Operator",
        message,
        orderId: order.id,
        createdAt: now,
      },
    });
  });

  revalidatePath(`/orders/${input.orderNumber}`);
  revalidatePath("/orders");

  return {
    ok: true,
    timelineEntry: {
      id: activity.id,
      timestamp: formatTimestamp(activity.createdAt),
      actor: activity.actor,
      message: activity.message,
    },
  };
}

export async function resetOrderProduction(input: ProductionResetInput): Promise<OrderActionResult> {
  if (!hasDatabaseUrl()) {
    return {
      ok: false,
      error: "DATABASE_URL is not configured yet, so this production reset is only kept in local mock state.",
    };
  }

  const prisma = getPrisma();
  const now = new Date();
  const order = await prisma.order.findUnique({
    where: { orderNumber: input.orderNumber },
    select: { id: true },
  });

  if (!order) {
    return { ok: false, error: `No order found for ${input.orderNumber}.` };
  }

  const activity = await prisma.$transaction(async (tx) => {
    await tx.orderItemProductionState.updateMany({
      where: { orderItem: { orderId: order.id } },
      data: {
        status: "DRAFT",
        sentAt: null,
        currentBatchId: null,
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: { status: "PRINT_FILES_REVIEW" },
    });

    return tx.activityLog.create({
      data: {
        entityType: "ORDER",
        actor: "Operator",
        message: "Produktion wurde zurueckgesetzt und der Auftrag ist wieder in Druckdatenpruefung.",
        orderId: order.id,
        createdAt: now,
      },
    });
  });

  revalidatePath(`/orders/${input.orderNumber}`);
  revalidatePath("/orders");
  revalidatePath("/production");

  return {
    ok: true,
    timelineEntry: {
      id: activity.id,
      timestamp: formatTimestamp(activity.createdAt),
      actor: activity.actor,
      message: activity.message,
    },
  };
}
