"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  FileCheck2,
  Mail,
  MapPin,
  MessageSquarePlus,
  Package,
  PackageCheck,
  Send,
  Truck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { priorityLabels, sourceLabels } from "@/src/lib/mock-orders";
import type { ActivityLogEntry, Order, OrderAddress, OrderItem, OrderStatus, PrintFileStatus } from "@/src/types/order";
import { StatusChip } from "./status-chip";

const printFileStatuses: PrintFileStatus[] = ["missing", "received", "approved", "problem"];

type PrintFileUpdateAction = (input: {
  orderNumber: string;
  sku: string;
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
    <div className="flex items-center justify-between gap-4 rounded-lg bg-slate-900/70 p-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-200">{value}</span>
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

export function OrderDetailWorkspace({
  order,
  onPrintFileUpdate,
  onStatusUpdate,
  onTrackingUpdate,
}: {
  order: Order;
  onPrintFileUpdate?: PrintFileUpdateAction;
  onStatusUpdate?: StatusUpdateAction;
  onTrackingUpdate?: TrackingUpdateAction;
}) {
  const router = useRouter();
  const [items, setItems] = useState<OrderItem[]>(order.items);
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [timeline, setTimeline] = useState<ActivityLogEntry[]>(order.timeline);
  const [fileNameDrafts, setFileNameDrafts] = useState<Record<string, string>>(
    Object.fromEntries(order.items.map((item) => [item.sku, item.printFile.fileName]))
  );
  const [carrier, setCarrier] = useState(order.carrier === "-" ? "" : order.carrier);
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber);
  const [savingSku, setSavingSku] = useState<string | null>(null);
  const [savingOrderAction, setSavingOrderAction] = useState<"status" | "tracking" | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [trackingMessage, setTrackingMessage] = useState<string | null>(null);

  const allPrintFilesApproved = useMemo(
    () => items.length > 0 && items.every((item) => item.printFile.status === "approved"),
    [items]
  );

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

  async function persistPrintFileUpdate(sku: string, fileName: string, status: PrintFileStatus) {
    if (!onPrintFileUpdate) {
      return;
    }

    setSavingSku(sku);
    setSaveMessage(null);

    try {
      const result = await onPrintFileUpdate({
        orderNumber: order.id,
        sku,
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
      setSavingSku(null);
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
    setItems((currentItems) =>
      currentItems.map((item) => ({
        ...item,
        production: {
          ...item.production,
          status: nextStatus === "In production" ? "confirmed" : "produced",
        },
      }))
    );

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

  function updatePrintFileName(sku: string) {
    const nextFileName = fileNameDrafts[sku]?.trim() ?? "";
    const item = items.find((currentItem) => currentItem.sku === sku);

    if (!item) {
      return;
    }

    const nextStatus: PrintFileStatus = nextFileName
      ? item.printFile.status === "missing"
        ? "received"
        : item.printFile.status
      : "missing";

    setItems((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem.sku === sku
          ? {
              ...currentItem,
              printFile: {
                ...currentItem.printFile,
                fileName: nextFileName,
                status: nextStatus,
              },
              printFiles: currentItem.printFiles?.map((printFile) =>
                printFile.side === "front"
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
          ? `Druckdaten file name updated for ${item.name}: ${nextFileName}.`
          : `Druckdaten file name cleared for ${item.name}.`
      );
    }

    void persistPrintFileUpdate(sku, nextFileName, nextStatus);
  }

  function updatePrintFileStatus(sku: string, status: PrintFileStatus) {
    const item = items.find((currentItem) => currentItem.sku === sku);

    if (!item) {
      return;
    }

    setItems((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem.sku === sku
          ? {
              ...currentItem,
              printFile: {
                ...currentItem.printFile,
                status,
              },
              printFiles: currentItem.printFiles?.map((printFile) =>
                printFile.side === "front"
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
      addTimelineEntry(`Druckdaten status for ${item.name} changed to ${status}.`);
    }

    void persistPrintFileUpdate(sku, item.printFile.fileName, status);
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
              {priorityLabels[order.priority]} priority
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
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-5xl">{order.id}</h1>
          <p className="mt-3 text-sm text-slate-400">
            External ID {order.externalId} - received {order.date} - deadline {order.deadline}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-4 text-right">
          <p className="text-sm text-cyan-100">{order.amount}</p>
          <p className={order.paymentStatus === "Paid" ? "mt-1 text-xs text-emerald-300" : "mt-1 text-xs text-red-300"}>
            {order.paymentStatus}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <DetailCard title="Customer" icon={UserRound}>
              <div className="space-y-3">
                <InfoRow label="Name" value={order.customer} />
                <InfoRow
                  label="E-Mail"
                  value={
                    <a href={`mailto:${order.email}`} className="text-cyan-200 hover:text-cyan-100">
                      {order.email}
                    </a>
                  }
                />
                <InfoRow label="Phone" value={order.phone} />
              </div>
            </DetailCard>

            <DetailCard title="Billing address" icon={MapPin}>
              <AddressBlock address={order.billingAddress} />
            </DetailCard>

            <DetailCard title="Shipping address" icon={Truck}>
              <AddressBlock address={order.shippingAddress} />
            </DetailCard>
          </div>

          <DetailCard title="Ordered products" icon={Package}>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={`${item.sku}-${item.size}`} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
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
                      <span className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${printFileStatusClass(item.printFile.status)}`}>
                        {item.printFile.status}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_11rem_auto]">
                    <input
                      value={fileNameDrafts[item.sku] ?? ""}
                      onChange={(event) =>
                        setFileNameDrafts((currentDrafts) => ({
                          ...currentDrafts,
                          [item.sku]: event.target.value,
                        }))
                      }
                      placeholder="Add or update print file name..."
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-300/10"
                    />
                    <select
                      value={item.printFile.status}
                      onChange={(event) => updatePrintFileStatus(item.sku, event.target.value as PrintFileStatus)}
                      className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/40"
                      aria-label={`Druckdaten status for ${item.sku}`}
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
                      onClick={() => updatePrintFileName(item.sku)}
                      disabled={savingSku === item.sku}
                      className="rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800"
                    >
                      {savingSku === item.sku ? "Saving..." : "Attach file name"}
                    </Button>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    <p>Front: {item.printFile.fileName || "No print file name attached yet."}</p>
                    {item.printFiles
                      ?.filter((printFile) => printFile.side === "back")
                      .map((printFile) => (
                        <p key={`${item.sku}-back`}>Back: {printFile.fileName || "No back-side print file attached yet."}</p>
                      ))}
                  </div>
                </div>
              ))}
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
          <DetailCard title="Status" icon={FileCheck2}>
            <div className="space-y-3">
              <InfoRow label="Payment" value={order.paymentStatus} />
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
              <Button className="w-full justify-start rounded-xl bg-cyan-200 text-slate-950 hover:bg-cyan-100">
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
