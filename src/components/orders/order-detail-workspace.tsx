"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  Factory,
  FileCheck2,
  GitBranch,
  Mail,
  MapPin,
  MessageSquarePlus,
  Package,
  PackageCheck,
  Send,
  Truck,
  Undo2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { priorityLabels, sourceLabels } from "@/src/lib/mock-orders";
import { manufacturerLabels } from "@/src/lib/mock-production";
import type { ActivityLogEntry, Order, OrderAddress, OrderItem, OrderPriority, OrderStatus, PrintFile, PrintFileStatus } from "@/src/types/order";
import type { ManufacturerId } from "@/src/types/production";
import { StatusChip } from "./status-chip";

const printFileStatuses: PrintFileStatus[] = ["missing", "received", "approved", "problem"];
const editableOrderStatuses: OrderStatus[] = [
  "New",
  "Payment open",
  "Print files missing",
  "Print files review",
  "Customer reply needed",
  "Approval missing",
  "Production ready",
  "In production",
  "Ready to ship",
  "Shipped",
  "Completed",
];
const editablePriorities: OrderPriority[] = ["normal", "high", "urgent"];
const editInputClass =
  "w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-300/10";

type PrintFileUpdateAction = (input: {
  orderNumber: string;
  itemId?: string;
  sku: string;
  side?: "front" | "back" | "general";
  fileName: string;
  status: PrintFileStatus;
}) => Promise<{
  ok: boolean;
  error?: string;
  timelineEntry?: ActivityLogEntry;
}>;

type StatusUpdateAction = (input: {
  orderNumber: string;
  status: Extract<OrderStatus, "In production" | "Ready to ship">;
}) => Promise<{
  ok: boolean;
  error?: string;
  timelineEntry?: ActivityLogEntry;
}>;

type TrackingUpdateAction = (input: {
  orderNumber: string;
  carrier: string;
  trackingNumber: string;
}) => Promise<{
  ok: boolean;
  error?: string;
  timelineEntry?: ActivityLogEntry;
}>;

type OrderEditAction = (input: {
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
}) => Promise<{
  ok: boolean;
  error?: string;
  timelineEntry?: ActivityLogEntry;
}>;

type OrderArchiveAction = (input: {
  orderNumber: string;
  action: "ship" | "complete" | "reopen";
}) => Promise<{
  ok: boolean;
  error?: string;
  timelineEntry?: ActivityLogEntry;
}>;

function DetailCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none backdrop-blur-xl">
      <CardContent className="p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-cyan-200">
            <Icon className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function AddressBlock({ address }: { address: OrderAddress }) {
  return (
    <div className="space-y-1 text-sm leading-6">
      <p className="font-medium text-white">{address.company}</p>
      <p className="text-slate-300">{address.name}</p>
      <p className="text-slate-400">{address.street}</p>
      <p className="text-slate-400">
        {address.postalCode} {address.city}
      </p>
      <p className="text-slate-400">{address.country}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-900/70 p-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="mt-1 block min-w-0 break-words font-medium text-slate-200">{value}</span>
    </div>
  );
}

function formatTimestamp() {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date())
    .replace("T", " ");
}

function printFileStatusClass(status: PrintFileStatus) {
  if (status === "approved") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
  }

  if (status === "problem") {
    return "border-red-500/25 bg-red-500/10 text-red-200";
  }

  if (status === "received") {
    return "border-cyan-500/25 bg-cyan-500/10 text-cyan-200";
  }

  return "border-amber-500/25 bg-amber-500/10 text-amber-200";
}

function productionStatusClass(status: OrderItem["production"]["status"]) {
  if (status === "produced") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
  }

  if (status === "sent" || status === "confirmed") {
    return "border-cyan-500/25 bg-cyan-500/10 text-cyan-200";
  }

  if (status === "draft") {
    return "border-slate-700 bg-slate-900 text-slate-300";
  }

  return "border-amber-500/25 bg-amber-500/10 text-amber-200";
}

function getItemPrintFiles(item: OrderItem) {
  return item.printFiles?.length ? item.printFiles : [item.printFile];
}

function getItemKey(item: OrderItem) {
  return item.id ?? `${item.sku}-${item.name}-${item.size}`;
}

function getPrintFileKey(item: OrderItem, printFile: PrintFile) {
  return `${getItemKey(item)}-${printFile.side ?? "front"}`;
}

function getPrimaryPrintFile(item: OrderItem, side: PrintFile["side"] = "front") {
  return getItemPrintFiles(item).find((printFile) => (printFile.side ?? "front") === side) ?? item.printFile;
}

function getPrintFileCompleteness(item: OrderItem) {
  const printFiles = getItemPrintFiles(item);
  const missingFiles = printFiles.filter((printFile) => !printFile.fileName || printFile.status === "missing");
  const problemFiles = printFiles.filter((printFile) => printFile.status === "problem");

  if (problemFiles.length > 0) {
    return { label: "Problem", className: "border-red-500/25 bg-red-500/10 text-red-200" };
  }

  if (missingFiles.length > 0) {
    return { label: "Incomplete", className: "border-amber-500/25 bg-amber-500/10 text-amber-200" };
  }

  return { label: "Complete", className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200" };
}

export function OrderDetailWorkspace({
  order,
  onPrintFileUpdate,
  onStatusUpdate,
  onTrackingUpdate,
  onOrderEdit,
  onArchiveUpdate,
}: {
  order: Order;
  onPrintFileUpdate?: PrintFileUpdateAction;
  onStatusUpdate?: StatusUpdateAction;
  onTrackingUpdate?: TrackingUpdateAction;
  onOrderEdit?: OrderEditAction;
  onArchiveUpdate?: OrderArchiveAction;
}) {
  const router = useRouter();
  const [items, setItems] = useState<OrderItem[]>(order.items);
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [paymentStatus, setPaymentStatus] = useState<Order["paymentStatus"]>(order.paymentStatus);
  const [priority, setPriority] = useState<OrderPriority>(order.priority);
  const [timeline, setTimeline] = useState<ActivityLogEntry[]>(order.timeline);
  const [customerDraft, setCustomerDraft] = useState({
    name: order.customer,
    email: order.email,
    phone: order.phone === "-" ? "" : order.phone,
  });
  const [shippingDraft, setShippingDraft] = useState({
    company: order.shippingAddress.company === "-" ? "" : order.shippingAddress.company,
    name: order.shippingAddress.name === "-" ? "" : order.shippingAddress.name,
    street: order.shippingAddress.street === "-" ? "" : order.shippingAddress.street,
    postalCode: order.shippingAddress.postalCode,
    city: order.shippingAddress.city === "-" ? "" : order.shippingAddress.city,
    country: order.shippingAddress.country === "-" ? "" : order.shippingAddress.country,
  });
  const [fileNameDrafts, setFileNameDrafts] = useState<Record<string, string>>(
    Object.fromEntries(
      order.items.flatMap((item) =>
        getItemPrintFiles(item).map((printFile) => [getPrintFileKey(item, printFile), printFile.fileName])
      )
    )
  );
  const [carrier, setCarrier] = useState(order.carrier === "-" ? "" : order.carrier);
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber);
  const [savingPrintFileKey, setSavingPrintFileKey] = useState<string | null>(null);
  const [savingOrderAction, setSavingOrderAction] = useState<"status" | "tracking" | null>(null);
  const [savingOrderEdit, setSavingOrderEdit] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [trackingMessage, setTrackingMessage] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState<string | null>(null);

  const allPrintFilesApproved = useMemo(
    () => items.length > 0 && items.every((item) => getItemPrintFiles(item).every((printFile) => printFile.status === "approved")),
    [items]
  );
  const productionGroups = useMemo(() => {
    const groups = new Map<ManufacturerId, OrderItem[]>();

    for (const item of items) {
      const manufacturer = item.production.manufacturer ?? "needs_review";
      groups.set(manufacturer, [...(groups.get(manufacturer) ?? []), item]);
    }

    return Array.from(groups.entries()).map(([manufacturer, groupedItems]) => {
      const completeItems = groupedItems.filter((item) => getPrintFileCompleteness(item).label === "Complete").length;
      const batchIds = [...new Set(groupedItems.map((item) => item.production.batchId).filter(Boolean))];

      return {
        manufacturer,
        items: groupedItems,
        completeItems,
        batchIds,
      };
    });
  }, [items]);
  const splitAcrossManufacturers = productionGroups.length > 1;
  const archived = status === "Shipped" || status === "Completed";

  function addTimelineEntry(message: string) {
    setTimeline((currentTimeline) => [
      {
        id: `${order.id}-mock-${currentTimeline.length + 1}-${Date.now()}`,
        timestamp: formatTimestamp(),
        actor: "Operator",
        message,
      },
      ...currentTimeline,
    ]);
  }

  async function persistPrintFileUpdate(item: OrderItem, side: PrintFile["side"], fileName: string, status: PrintFileStatus) {
    if (!onPrintFileUpdate) {
      return;
    }

    const printFileKey = `${getItemKey(item)}-${side ?? "front"}`;
    setSavingPrintFileKey(printFileKey);
    setSaveMessage(null);

    try {
      const result = await onPrintFileUpdate({
        orderNumber: order.id,
        itemId: item.id,
        sku: item.sku,
        side,
        fileName,
        status,
      });

      if (result.ok && result.timelineEntry) {
        setTimeline((currentTimeline) => [result.timelineEntry!, ...currentTimeline]);
        setSaveMessage("Druckdaten saved to database.");
        return;
      }

      setSaveMessage(result.error ?? "Druckdaten could not be saved to the database.");
    } catch {
      setSaveMessage("Druckdaten could not be saved to the database.");
    } finally {
      setSavingPrintFileKey(null);
    }
  }

  function addActionResultToTimeline(result: { ok: boolean; error?: string; timelineEntry?: ActivityLogEntry }, fallbackMessage: string) {
    if (result.ok && result.timelineEntry) {
      setTimeline((currentTimeline) => [result.timelineEntry!, ...currentTimeline]);
      setSaveMessage("Order saved to database.");
      return;
    }

    addTimelineEntry(fallbackMessage);
    setSaveMessage(result.error ?? "Order change could not be saved to the database.");
  }

  async function markWorkflowStatus(nextStatus: Extract<OrderStatus, "In production" | "Ready to ship">) {
    const fallbackMessage =
      nextStatus === "In production" ? "Order marked as in production." : "Order marked as ready for shipping.";

    setStatus(nextStatus);

    if (!onStatusUpdate) {
      addTimelineEntry(fallbackMessage);
      return;
    }

    setSavingOrderAction("status");
    setSaveMessage(null);

    try {
      const result = await onStatusUpdate({ orderNumber: order.id, status: nextStatus });
      addActionResultToTimeline(result, fallbackMessage);
    } catch {
      addTimelineEntry(fallbackMessage);
      setSaveMessage("Order status could not be saved to the database.");
    } finally {
      setSavingOrderAction(null);
    }
  }

  async function saveTrackingNumber() {
    const nextCarrier = carrier.trim();
    const nextTrackingNumber = trackingNumber.trim();

    if (!nextCarrier && !nextTrackingNumber) {
      setTrackingMessage("Carrier or tracking number is required before saving.");
      return;
    }

    const fallbackMessage = nextCarrier
      ? `Tracking number saved: ${nextCarrier} ${nextTrackingNumber}.`
      : `Tracking number saved: ${nextTrackingNumber}.`;

    if (!onTrackingUpdate) {
      addTimelineEntry(fallbackMessage);
      setTrackingMessage("Shipping details updated locally.");
      return;
    }

    setSavingOrderAction("tracking");
    setTrackingMessage(null);

    try {
      const result = await onTrackingUpdate({
        orderNumber: order.id,
        carrier: nextCarrier,
        trackingNumber: nextTrackingNumber,
      });

      if (result.ok && result.timelineEntry) {
        setTimeline((currentTimeline) => [result.timelineEntry!, ...currentTimeline]);
        setCarrier(nextCarrier);
        setTrackingNumber(nextTrackingNumber);
        setTrackingMessage("Shipping details saved to database.");
        router.refresh();
        return;
      }

      addTimelineEntry(fallbackMessage);
      setTrackingMessage(result.error ?? "Shipping details could not be saved to the database.");
    } catch {
      addTimelineEntry(fallbackMessage);
      setTrackingMessage("Shipping details could not be saved to the database.");
    } finally {
      setSavingOrderAction(null);
    }
  }

  async function saveOrderEdits() {
    if (!customerDraft.name.trim() || !customerDraft.email.trim()) {
      setEditMessage("Customer name and email are required.");
      return;
    }

    if ((status === "Shipped" || status === "Completed") && (!carrier.trim() || !trackingNumber.trim())) {
      setEditMessage("Carrier and tracking number are required before shipping or closing an order.");
      return;
    }

    if (!onOrderEdit) {
      addTimelineEntry("Order customer, shipping, payment or workflow fields updated.");
      setEditMessage("Order fields updated locally.");
      return;
    }

    setSavingOrderEdit(true);
    setEditMessage(null);

    try {
      const result = await onOrderEdit({
        orderNumber: order.id,
        status,
        paymentStatus,
        priority,
        customerName: customerDraft.name,
        customerEmail: customerDraft.email,
        customerPhone: customerDraft.phone,
        shippingCompany: shippingDraft.company,
        shippingName: shippingDraft.name,
        shippingStreet: shippingDraft.street,
        shippingPostalCode: shippingDraft.postalCode,
        shippingCity: shippingDraft.city,
        shippingCountry: shippingDraft.country,
      });

      if (result.ok && result.timelineEntry) {
        setTimeline((currentTimeline) => [result.timelineEntry!, ...currentTimeline]);
        setEditMessage("Order fields saved to database.");
        router.refresh();
        return;
      }

      setEditMessage(result.error ?? "Order fields could not be saved to the database.");
    } catch {
      setEditMessage("Order fields could not be saved to the database.");
    } finally {
      setSavingOrderEdit(false);
    }
  }

  async function updateArchiveStatus(action: "ship" | "complete" | "reopen") {
    if ((action === "ship" || action === "complete") && (!carrier.trim() || !trackingNumber.trim())) {
      setTrackingMessage("Carrier and tracking number are required before shipping or closing an order.");
      return;
    }

    const nextStatus: OrderStatus = action === "reopen" ? "In production" : action === "complete" ? "Completed" : "Shipped";
    const fallbackMessage =
      action === "reopen"
        ? "Order reopened and moved back to in production."
        : action === "complete"
          ? "Order completed and moved to closed archive."
          : "Order marked as shipped.";

    setStatus(nextStatus);

    if (!onArchiveUpdate) {
      addTimelineEntry(fallbackMessage);
      return;
    }

    setSavingOrderAction("status");
    setTrackingMessage(null);
    setSaveMessage(null);

    try {
      const result = await onArchiveUpdate({ orderNumber: order.id, action });
      addActionResultToTimeline(result, fallbackMessage);
      router.refresh();
    } catch {
      addTimelineEntry(fallbackMessage);
      setSaveMessage("Order archive status could not be saved to the database.");
    } finally {
      setSavingOrderAction(null);
    }
  }

  function updatePrintFileName(itemKey: string, side: PrintFile["side"]) {
    const printFileKey = `${itemKey}-${side ?? "front"}`;
    const nextFileName = fileNameDrafts[printFileKey]?.trim() ?? "";
    const item = items.find((currentItem) => getItemKey(currentItem) === itemKey);

    if (!item) {
      return;
    }

    const currentPrintFile = getPrimaryPrintFile(item, side);
    const nextStatus: PrintFileStatus = nextFileName
      ? currentPrintFile.status === "missing"
        ? "received"
        : currentPrintFile.status
      : "missing";

    setItems((currentItems) =>
      currentItems.map((currentItem) =>
        getItemKey(currentItem) === itemKey
          ? {
              ...currentItem,
              printFile: {
                ...currentItem.printFile,
                ...(side === "front" || !side ? { fileName: nextFileName, status: nextStatus } : {}),
              },
              printFiles: getItemPrintFiles(currentItem).map((printFile) =>
                (printFile.side ?? "front") === (side ?? "front")
                  ? {
                      ...printFile,
                      fileName: nextFileName,
                      status: nextStatus,
                    }
                  : printFile
              ),
            }
          : currentItem
      )
    );

    if (!onPrintFileUpdate) {
      addTimelineEntry(
        nextFileName
          ? `Druckdaten ${side ?? "front"} file name updated for ${item.name}: ${nextFileName}.`
          : `Druckdaten ${side ?? "front"} file name cleared for ${item.name}.`
      );
    }

    void persistPrintFileUpdate(item, side, nextFileName, nextStatus);
  }

  function updatePrintFileStatus(itemKey: string, side: PrintFile["side"], status: PrintFileStatus) {
    const item = items.find((currentItem) => getItemKey(currentItem) === itemKey);

    if (!item) {
      return;
    }

    const currentPrintFile = getPrimaryPrintFile(item, side);

    setItems((currentItems) =>
      currentItems.map((currentItem) =>
        getItemKey(currentItem) === itemKey
          ? {
              ...currentItem,
              printFile: {
                ...currentItem.printFile,
                ...(side === "front" || !side ? { status } : {}),
              },
              printFiles: getItemPrintFiles(currentItem).map((printFile) =>
                (printFile.side ?? "front") === (side ?? "front")
                  ? {
                      ...printFile,
                      status,
                    }
                  : printFile
              ),
            }
          : currentItem
      )
    );

    if (!onPrintFileUpdate) {
      addTimelineEntry(`Druckdaten ${side ?? "front"} status for ${item.name} changed to ${status}.`);
    }

    void persistPrintFileUpdate(item, side, currentPrintFile.fileName, status);
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="outline" className="rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800">
          <Link href="/orders">
            <ArrowLeft className="h-4 w-4" />
            Back to orders
          </Link>
        </Button>
      </div>

      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={status} />
            <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300">
              {sourceLabels[order.source]}
            </span>
            <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300">
              {priorityLabels[priority]} priority
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                allPrintFilesApproved
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
                  : "border-amber-500/25 bg-amber-500/10 text-amber-200"
              }`}
            >
              {allPrintFilesApproved ? "Druckdaten ready" : "Druckdaten open"}
            </span>
            {splitAcrossManufacturers ? (
              <span className="rounded-full border border-violet-400/25 bg-violet-400/10 px-3 py-1 text-xs font-medium text-violet-100">
                Split production
              </span>
            ) : null}
            {archived ? (
              <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-medium text-slate-300">
                Archived
              </span>
            ) : null}
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-5xl">{order.id}</h1>
          <p className="mt-3 text-sm text-slate-400">
            External ID {order.externalId} - received {order.date} - deadline {order.deadline}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-4 text-right">
          <p className="text-sm text-cyan-100">{order.amount}</p>
          <p className={paymentStatus === "Paid" ? "mt-1 text-xs text-emerald-300" : "mt-1 text-xs text-red-300"}>
            {paymentStatus}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <DetailCard title="Customer" icon={UserRound}>
              <div className="space-y-3">
                <InfoRow label="Name" value={customerDraft.name} />
                <InfoRow
                  label="E-Mail"
                  value={
                    <a href={`mailto:${customerDraft.email}`} className="text-cyan-200 hover:text-cyan-100">
                      {customerDraft.email}
                    </a>
                  }
                />
                <InfoRow label="Phone" value={customerDraft.phone || "-"} />
              </div>
            </DetailCard>

            <DetailCard title="Billing address" icon={MapPin}>
              <AddressBlock address={order.billingAddress} />
            </DetailCard>

            <DetailCard title="Shipping address" icon={Truck}>
              <AddressBlock
                address={{
                  company: shippingDraft.company || "-",
                  name: shippingDraft.name || "-",
                  street: shippingDraft.street || "-",
                  postalCode: shippingDraft.postalCode,
                  city: shippingDraft.city || "-",
                  country: shippingDraft.country || "-",
                }}
              />
            </DetailCard>
          </div>

          <DetailCard title="Production overview" icon={Factory}>
            <div className="space-y-4">
              {splitAcrossManufacturers ? (
                <div className="flex items-start gap-3 rounded-xl border border-violet-400/20 bg-violet-400/10 p-4">
                  <GitBranch className="mt-0.5 h-5 w-5 text-violet-100" />
                  <div>
                    <p className="text-sm font-medium text-violet-100">This order is split across multiple manufacturers.</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      The main order status remains separate from item production. Shipping can be handled after all item-level work is ready.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {productionGroups.map((group) => (
                  <div key={group.manufacturer} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-white">{manufacturerLabels[group.manufacturer]}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {group.items.length} item{group.items.length === 1 ? "" : "s"} - {group.completeItems}/{group.items.length} Druckdaten complete
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">
                        {group.batchIds.length ? `${group.batchIds.length} batch${group.batchIds.length === 1 ? "" : "es"}` : "No batch"}
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      {group.items.map((item) => {
                        const completeness = getPrintFileCompleteness(item);

                        return (
                          <div key={`${group.manufacturer}-${getItemKey(item)}`} className="rounded-lg bg-slate-950/70 p-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-white">{item.name}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {item.sku} - {item.size} - Qty {item.quantity}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${productionStatusClass(item.production.status)}`}>
                                  {item.production.status}
                                </span>
                                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${completeness.className}`}>
                                  {completeness.label}
                                </span>
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                                <p className="text-xs uppercase tracking-wide text-slate-500">Batch</p>
                                <p className="mt-1 text-sm text-slate-200">{item.production.batchId ?? "Not batched yet"}</p>
                              </div>
                              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                                <p className="text-xs uppercase tracking-wide text-slate-500">Print files</p>
                                <div className="mt-1 space-y-1">
                                  {getItemPrintFiles(item).map((printFile) => (
                                    <p key={getPrintFileKey(item, printFile)} className="flex justify-between gap-3 text-xs">
                                      <span className="text-slate-500">{printFile.side ?? "front"}</span>
                                      <span className={printFile.fileName && printFile.status !== "missing" ? "text-slate-200" : "text-amber-200"}>
                                        {printFile.fileName || "missing"}
                                      </span>
                                    </p>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </DetailCard>

          <DetailCard title="Ordered products" icon={Package}>
            <div className="space-y-3">
              {items.map((item) => {
                const itemKey = getItemKey(item);
                const printFiles = getItemPrintFiles(item);

                return (
                  <div key={itemKey} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_0.8fr_0.9fr]">
                      <div>
                        <p className="font-medium text-white">{item.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.sku} - {item.size} - Qty {item.quantity}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Production</p>
                        <p className="mt-1 text-sm text-slate-300">{item.production.manufacturer ?? "Not assigned"}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.production.status}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Druckdaten</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {printFiles.map((printFile) => (
                            <span key={getPrintFileKey(item, printFile)} className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${printFileStatusClass(printFile.status)}`}>
                              {printFile.side ?? "front"}: {printFile.status}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {printFiles.map((printFile) => {
                        const side = printFile.side ?? "front";
                        const printFileKey = getPrintFileKey(item, printFile);

                        return (
                          <div key={printFileKey} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-800 bg-slate-950/45 p-3 lg:grid-cols-[7rem_1fr_11rem_auto]">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-500">Side</p>
                              <p className="mt-1 text-sm font-medium text-slate-200">{side}</p>
                            </div>
                            <input
                              value={fileNameDrafts[printFileKey] ?? ""}
                              onChange={(event) =>
                                setFileNameDrafts((currentDrafts) => ({
                                  ...currentDrafts,
                                  [printFileKey]: event.target.value,
                                }))
                              }
                              placeholder={`Add or update ${side} print file name...`}
                              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-300/10"
                            />
                            <select
                              value={printFile.status}
                              onChange={(event) => updatePrintFileStatus(itemKey, side, event.target.value as PrintFileStatus)}
                              className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/40"
                              aria-label={`Druckdaten status for ${item.sku} ${side}`}
                            >
                              {printFileStatuses.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => updatePrintFileName(itemKey, side)}
                              disabled={savingPrintFileKey === printFileKey}
                              className="rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800"
                            >
                              {savingPrintFileKey === printFileKey ? "Saving..." : "Attach file name"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {saveMessage ?? "Druckdaten changes are saved when a database connection is configured."}
            </p>
          </DetailCard>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <DetailCard title="Internal notes" icon={ClipboardList}>
              <p className="rounded-lg bg-slate-900/70 p-4 text-sm leading-6 text-slate-300">{order.notes}</p>
            </DetailCard>

            <DetailCard title="Timeline" icon={CalendarClock}>
              <div className="space-y-4">
                {timeline.map((entry) => (
                  <div key={entry.id} className="relative pl-6">
                    <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-cyan-300" />
                    <div className="rounded-lg bg-slate-900/70 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-white">{entry.actor}</p>
                        <p className="text-xs text-slate-500">{entry.timestamp}</p>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{entry.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </DetailCard>
          </div>
        </div>

        <aside className="space-y-5">
          <DetailCard title="Edit order" icon={ClipboardList}>
            <div className="space-y-3">
              <label className="block space-y-2 text-sm text-slate-400">
                <span>Status</span>
                <select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus)} className={editInputClass}>
                  {editableOrderStatuses.map((editableStatus) => (
                    <option key={editableStatus} value={editableStatus}>
                      {editableStatus}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2 text-sm text-slate-400">
                <span>Payment status</span>
                <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as Order["paymentStatus"])} className={editInputClass}>
                  <option value="Open">Open</option>
                  <option value="Paid">Paid</option>
                </select>
              </label>
              <label className="block space-y-2 text-sm text-slate-400">
                <span>Priority</span>
                <select value={priority} onChange={(event) => setPriority(event.target.value as OrderPriority)} className={editInputClass}>
                  {editablePriorities.map((editablePriority) => (
                    <option key={editablePriority} value={editablePriority}>
                      {priorityLabels[editablePriority]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 gap-3">
                <input
                  value={customerDraft.name}
                  onChange={(event) => setCustomerDraft((draft) => ({ ...draft, name: event.target.value }))}
                  placeholder="Customer name"
                  className={editInputClass}
                />
                <input
                  type="email"
                  value={customerDraft.email}
                  onChange={(event) => setCustomerDraft((draft) => ({ ...draft, email: event.target.value }))}
                  placeholder="Customer email"
                  className={editInputClass}
                />
                <input
                  value={customerDraft.phone}
                  onChange={(event) => setCustomerDraft((draft) => ({ ...draft, phone: event.target.value }))}
                  placeholder="Customer phone"
                  className={editInputClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 border-t border-slate-800 pt-3">
                <input
                  value={shippingDraft.company}
                  onChange={(event) => setShippingDraft((draft) => ({ ...draft, company: event.target.value }))}
                  placeholder="Shipping company"
                  className={editInputClass}
                />
                <input
                  value={shippingDraft.name}
                  onChange={(event) => setShippingDraft((draft) => ({ ...draft, name: event.target.value }))}
                  placeholder="Shipping name"
                  className={editInputClass}
                />
                <input
                  value={shippingDraft.street}
                  onChange={(event) => setShippingDraft((draft) => ({ ...draft, street: event.target.value }))}
                  placeholder="Shipping street"
                  className={editInputClass}
                />
                <div className="grid grid-cols-[0.8fr_1fr] gap-3">
                  <input
                    value={shippingDraft.postalCode}
                    onChange={(event) => setShippingDraft((draft) => ({ ...draft, postalCode: event.target.value }))}
                    placeholder="ZIP"
                    className={editInputClass}
                  />
                  <input
                    value={shippingDraft.city}
                    onChange={(event) => setShippingDraft((draft) => ({ ...draft, city: event.target.value }))}
                    placeholder="City"
                    className={editInputClass}
                  />
                </div>
                <input
                  value={shippingDraft.country}
                  onChange={(event) => setShippingDraft((draft) => ({ ...draft, country: event.target.value }))}
                  placeholder="Country"
                  className={editInputClass}
                />
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={saveOrderEdits}
                disabled={savingOrderEdit}
                className="w-full justify-start rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800"
              >
                <FileCheck2 className="h-4 w-4" />
                {savingOrderEdit ? "Saving..." : "Save order changes"}
              </Button>
              <p className="text-xs leading-5 text-slate-500">{editMessage ?? "Customer, shipping, payment, status and priority can be changed after order intake."}</p>
            </div>
          </DetailCard>

          <DetailCard title="Status" icon={FileCheck2}>
            <div className="space-y-3">
              <InfoRow label="Payment" value={paymentStatus} />
              <InfoRow label="Druckdaten" value={allPrintFilesApproved ? "Ready" : "Open"} />
              <InfoRow label="Production" value={<StatusChip status={status} />} />
              <InfoRow label="Carrier" value={carrier || "-"} />
            </div>
          </DetailCard>

          <DetailCard title="Shipping" icon={Truck}>
            <div className="space-y-3">
              <label className="block text-sm text-slate-400" htmlFor="shipping-carrier">
                Carrier
              </label>
              <input
                id="shipping-carrier"
                value={carrier}
                onChange={(event) => setCarrier(event.target.value)}
                placeholder="DPD, UPS, DHL..."
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-300/10"
              />
              <label className="block text-sm text-slate-400" htmlFor="tracking-number">
                Tracking number
              </label>
              <input
                id="tracking-number"
                value={trackingNumber}
                onChange={(event) => setTrackingNumber(event.target.value)}
                placeholder="Add tracking number..."
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-300/10"
              />
              <Button
                type="button"
                variant="outline"
                onClick={saveTrackingNumber}
                disabled={savingOrderAction === "tracking"}
                className="w-full justify-start rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800"
              >
                <Send className="h-4 w-4" />
                {savingOrderAction === "tracking" ? "Saving..." : "Save shipping details"}
              </Button>
              <p className="text-xs leading-5 text-slate-500">
                {trackingMessage ?? "Tracking is saved independently from the main order closure."}
              </p>
            </div>
          </DetailCard>

          <DetailCard title="Quick actions" icon={MessageSquarePlus}>
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800"
              >
                <Mail className="h-4 w-4" />
                Send Druckfreigabe reminder
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => markWorkflowStatus("In production")}
                disabled={savingOrderAction === "status"}
                className="w-full justify-start rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800"
              >
                <Package className="h-4 w-4" />
                {savingOrderAction === "status" ? "Saving..." : "Mark as in production"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => markWorkflowStatus("Ready to ship")}
                disabled={savingOrderAction === "status"}
                className="w-full justify-start rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800"
              >
                <PackageCheck className="h-4 w-4" />
                {savingOrderAction === "status" ? "Saving..." : "Mark as ready for shipping"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => updateArchiveStatus("ship")}
                disabled={savingOrderAction === "status" || status === "Shipped" || status === "Completed"}
                className="w-full justify-start rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800"
              >
                <Truck className="h-4 w-4" />
                {savingOrderAction === "status" ? "Saving..." : "Mark as shipped"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => updateArchiveStatus("complete")}
                disabled={savingOrderAction === "status" || status === "Completed"}
                className="w-full justify-start rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800"
              >
                <PackageCheck className="h-4 w-4" />
                {savingOrderAction === "status" ? "Saving..." : "Close order"}
              </Button>
              {archived ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => updateArchiveStatus("reopen")}
                  disabled={savingOrderAction === "status"}
                  className="w-full justify-start rounded-xl border-amber-500/25 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15"
                >
                  <Undo2 className="h-4 w-4" />
                  {savingOrderAction === "status" ? "Saving..." : "Reopen order"}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={saveTrackingNumber}
                disabled={savingOrderAction === "tracking"}
                className="w-full justify-start rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800"
              >
                <Send className="h-4 w-4" />
                {savingOrderAction === "tracking" ? "Saving..." : "Add tracking number"}
              </Button>
            </div>
          </DetailCard>

          <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none backdrop-blur-xl">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-cyan-200">
                  <FileCheck2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Operator view</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Druckdaten changes are stored independently. Main order closure remains a separate shipping workflow.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </section>
    </div>
  );
}
