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
  MapPin,
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

type ProductionResetAction = (input: {
  orderNumber: string;
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
  onProductionReset,
}: {
  order: Order;
  onPrintFileUpdate?: PrintFileUpdateAction;
  onStatusUpdate?: StatusUpdateAction;
  onTrackingUpdate?: TrackingUpdateAction;
  onOrderEdit?: OrderEditAction;
  onArchiveUpdate?: OrderArchiveAction;
  onProductionReset?: ProductionResetAction;
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
  const [savingOrderAction, setSavingOrderAction] = useState<"status" | "tracking" | "production-reset" | null>(null);
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
      setSaveMessage("Aenderung gespeichert.");
      return;
    }

    addTimelineEntry(fallbackMessage);
    setSaveMessage(result.error ?? "Aenderung konnte nicht gespeichert werden.");
  }

  async function markWorkflowStatus(nextStatus: Extract<OrderStatus, "In production" | "Ready to ship">) {
    const fallbackMessage =
      nextStatus === "In production" ? "Auftrag wurde in Produktion gesetzt." : "Auftrag wurde versandbereit gesetzt.";

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
      setSaveMessage("Auftragsstatus konnte nicht gespeichert werden.");
    } finally {
      setSavingOrderAction(null);
    }
  }

  async function saveTrackingNumber() {
    const nextCarrier = carrier.trim();
    const nextTrackingNumber = trackingNumber.trim();

    if (!nextCarrier && !nextTrackingNumber) {
      setTrackingMessage("Versanddienst oder Sendungsnummer ist erforderlich.");
      return;
    }

    const fallbackMessage = nextCarrier
      ? `Versanddaten gespeichert: ${nextCarrier} ${nextTrackingNumber}.`
      : `Versanddaten gespeichert: ${nextTrackingNumber}.`;

    if (!onTrackingUpdate) {
      addTimelineEntry(fallbackMessage);
      setTrackingMessage("Versanddaten lokal aktualisiert.");
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
        setTrackingMessage("Versanddaten gespeichert.");
        router.refresh();
        return;
      }

      addTimelineEntry(fallbackMessage);
      setTrackingMessage(result.error ?? "Versanddaten konnten nicht gespeichert werden.");
    } catch {
      addTimelineEntry(fallbackMessage);
      setTrackingMessage("Versanddaten konnten nicht gespeichert werden.");
    } finally {
      setSavingOrderAction(null);
    }
  }

  async function saveOrderEdits() {
    if (!customerDraft.name.trim() || !customerDraft.email.trim()) {
      setEditMessage("Kundenname und E-Mail sind erforderlich.");
      return;
    }

    if ((status === "Shipped" || status === "Completed") && (!carrier.trim() || !trackingNumber.trim())) {
      setEditMessage("Versanddienst und Sendungsnummer sind vor Versand oder Abschluss erforderlich.");
      return;
    }

    if (!onOrderEdit) {
      addTimelineEntry("Auftragsdaten wurden aktualisiert.");
      setEditMessage("Auftragsdaten lokal aktualisiert.");
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
        setEditMessage("Auftragsdaten gespeichert.");
        router.refresh();
        return;
      }

      setEditMessage(result.error ?? "Auftragsdaten konnten nicht gespeichert werden.");
    } catch {
      setEditMessage("Auftragsdaten konnten nicht gespeichert werden.");
    } finally {
      setSavingOrderEdit(false);
    }
  }

  async function updateArchiveStatus(action: "ship" | "complete" | "reopen") {
    if ((action === "ship" || action === "complete") && (!carrier.trim() || !trackingNumber.trim())) {
      setTrackingMessage("Versanddienst und Sendungsnummer sind vor Versand oder Abschluss erforderlich.");
      return;
    }

    const nextStatus: OrderStatus = action === "reopen" ? "In production" : action === "complete" ? "Completed" : "Shipped";
    const fallbackMessage =
      action === "reopen"
        ? "Auftrag wurde wieder geoeffnet und in Produktion gesetzt."
        : action === "complete"
          ? "Auftrag wurde abgeschlossen."
          : "Auftrag wurde als versendet markiert.";

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
      setSaveMessage("Auftragsstatus konnte nicht gespeichert werden.");
    } finally {
      setSavingOrderAction(null);
    }
  }

  async function resetProductionWorkflow() {
    const fallbackMessage = "Produktion wurde zurueckgesetzt und der Auftrag ist wieder in Druckdatenpruefung.";

    setStatus("Print files review");
    setItems((currentItems) =>
      currentItems.map((item) => ({
        ...item,
        production: {
          ...item.production,
          status: "draft",
          batchId: undefined,
        },
      }))
    );

    if (!onProductionReset) {
      addTimelineEntry(fallbackMessage);
      setSaveMessage("Produktion lokal zurueckgesetzt.");
      return;
    }

    setSavingOrderAction("production-reset");
    setSaveMessage(null);

    try {
      const result = await onProductionReset({ orderNumber: order.id });
      addActionResultToTimeline(result, fallbackMessage);
      router.refresh();
    } catch {
      addTimelineEntry(fallbackMessage);
      setSaveMessage("Produktion konnte nicht zurueckgesetzt werden.");
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
          ? `Druckdaten ${side ?? "front"} fuer ${item.name} aktualisiert: ${nextFileName}.`
          : `Druckdaten ${side ?? "front"} fuer ${item.name} entfernt.`
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
      addTimelineEntry(`Druckdaten ${side ?? "front"} fuer ${item.name} auf ${status} gesetzt.`);
    }

    void persistPrintFileUpdate(item, side, currentPrintFile.fileName, status);
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="outline" className="rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800">
          <Link href="/orders">
            <ArrowLeft className="h-4 w-4" />
            Zurueck zu Auftraegen
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
              {priorityLabels[priority]} Prioritaet
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                allPrintFilesApproved
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
                  : "border-amber-500/25 bg-amber-500/10 text-amber-200"
              }`}
            >
              {allPrintFilesApproved ? "Druckdaten bereit" : "Druckdaten offen"}
            </span>
            {splitAcrossManufacturers ? (
              <span className="rounded-full border border-violet-400/25 bg-violet-400/10 px-3 py-1 text-xs font-medium text-violet-100">
                Geteilte Produktion
              </span>
            ) : null}
            {archived ? (
              <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-medium text-slate-300">
                Archiviert
              </span>
            ) : null}
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-5xl">{order.id}</h1>
          <p className="mt-3 text-sm text-slate-400">
            Externe ID {order.externalId} - Eingang {order.date} - Termin {order.deadline}
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
            <DetailCard title="Kunde" icon={UserRound}>
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
                <InfoRow label="Telefon" value={customerDraft.phone || "-"} />
              </div>
            </DetailCard>

            <DetailCard title="Rechnungsadresse" icon={MapPin}>
              <AddressBlock address={order.billingAddress} />
            </DetailCard>

            <DetailCard title="Lieferadresse" icon={Truck}>
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

          <DetailCard title="Produktion" icon={Factory}>
            <div className="space-y-4">
              {splitAcrossManufacturers ? (
                <div className="flex items-start gap-3 rounded-xl border border-violet-400/20 bg-violet-400/10 p-4">
                  <GitBranch className="mt-0.5 h-5 w-5 text-violet-100" />
                  <div>
                    <p className="text-sm font-medium text-violet-100">Dieser Auftrag ist auf mehrere Hersteller verteilt.</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Die Produktion laeuft pro Artikel. Versand bleibt ein separater Schritt.
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
                          {group.items.length} Artikel - {group.completeItems}/{group.items.length} Druckdaten bereit
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">
                        {group.batchIds.length ? "Gesendet" : "Noch nicht gesendet"}
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
                                  {item.sku} - {item.size} - Stueck {item.quantity}
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
                                <p className="text-xs uppercase tracking-wide text-slate-500">Hersteller</p>
                                <p className="mt-1 text-sm text-slate-200">{manufacturerLabels[group.manufacturer]}</p>
                              </div>
                              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                                <p className="text-xs uppercase tracking-wide text-slate-500">Druckdaten</p>
                                <div className="mt-1 space-y-1">
                                  {getItemPrintFiles(item).map((printFile) => (
                                    <p key={getPrintFileKey(item, printFile)} className="flex justify-between gap-3 text-xs">
                                      <span className="text-slate-500">{printFile.side ?? "front"}</span>
                                      <span className={printFile.fileName && printFile.status !== "missing" ? "text-slate-200" : "text-amber-200"}>
                                        {printFile.fileName || "fehlt"}
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
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-medium text-amber-100">Produktion neu pruefen</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Setzt die Produktion fuer diesen Auftrag zurueck und verschiebt ihn in die Druckdatenpruefung.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetProductionWorkflow}
                    disabled={savingOrderAction === "production-reset"}
                    className="rounded-xl border-amber-500/25 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15"
                  >
                    <Undo2 className="h-4 w-4" />
                    {savingOrderAction === "production-reset" ? "Speichern..." : "Produktion zuruecksetzen"}
                  </Button>
                </div>
              </div>
            </div>
          </DetailCard>

          <DetailCard title="Druckdaten & Produkte" icon={Package}>
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
                          {item.sku} - {item.size} - Stueck {item.quantity}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Produktion</p>
                        <p className="mt-1 text-sm text-slate-300">{item.production.manufacturer ?? "Nicht zugeordnet"}</p>
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
                              <p className="text-xs uppercase tracking-wide text-slate-500">Seite</p>
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
                              placeholder={`${side} Druckdatei eintragen...`}
                              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-300/10"
                            />
                            <select
                              value={printFile.status}
                              onChange={(event) => updatePrintFileStatus(itemKey, side, event.target.value as PrintFileStatus)}
                              className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/40"
                              aria-label={`Druckdatenstatus fuer ${item.sku} ${side}`}
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
                              {savingPrintFileKey === printFileKey ? "Speichern..." : "Druckdatei speichern"}
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
              {saveMessage ?? "Druckdaten-Aenderungen werden direkt gespeichert."}
            </p>
          </DetailCard>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <DetailCard title="Interne Notizen" icon={ClipboardList}>
              <p className="rounded-lg bg-slate-900/70 p-4 text-sm leading-6 text-slate-300">{order.notes}</p>
            </DetailCard>

            <DetailCard title="Verlauf" icon={CalendarClock}>
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
          <DetailCard title="Auftrag bearbeiten" icon={ClipboardList}>
            <div className="space-y-3">
              <label className="block space-y-2 text-sm text-slate-400">
                <span>Auftragsstatus</span>
                <select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus)} className={editInputClass}>
                  {editableOrderStatuses.map((editableStatus) => (
                    <option key={editableStatus} value={editableStatus}>
                      {editableStatus}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2 text-sm text-slate-400">
                <span>Zahlung</span>
                <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as Order["paymentStatus"])} className={editInputClass}>
                  <option value="Open">Open</option>
                  <option value="Paid">Paid</option>
                </select>
              </label>
              <label className="block space-y-2 text-sm text-slate-400">
                <span>Prioritaet</span>
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
                  placeholder="Kundenname"
                  className={editInputClass}
                />
                <input
                  type="email"
                  value={customerDraft.email}
                  onChange={(event) => setCustomerDraft((draft) => ({ ...draft, email: event.target.value }))}
                  placeholder="E-Mail"
                  className={editInputClass}
                />
                <input
                  value={customerDraft.phone}
                  onChange={(event) => setCustomerDraft((draft) => ({ ...draft, phone: event.target.value }))}
                  placeholder="Telefon"
                  className={editInputClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 border-t border-slate-800 pt-3">
                <input
                  value={shippingDraft.company}
                  onChange={(event) => setShippingDraft((draft) => ({ ...draft, company: event.target.value }))}
                  placeholder="Firma Versand"
                  className={editInputClass}
                />
                <input
                  value={shippingDraft.name}
                  onChange={(event) => setShippingDraft((draft) => ({ ...draft, name: event.target.value }))}
                  placeholder="Name Versand"
                  className={editInputClass}
                />
                <input
                  value={shippingDraft.street}
                  onChange={(event) => setShippingDraft((draft) => ({ ...draft, street: event.target.value }))}
                  placeholder="Strasse"
                  className={editInputClass}
                />
                <div className="grid grid-cols-[0.8fr_1fr] gap-3">
                  <input
                    value={shippingDraft.postalCode}
                    onChange={(event) => setShippingDraft((draft) => ({ ...draft, postalCode: event.target.value }))}
                    placeholder="PLZ"
                    className={editInputClass}
                  />
                  <input
                    value={shippingDraft.city}
                    onChange={(event) => setShippingDraft((draft) => ({ ...draft, city: event.target.value }))}
                    placeholder="Stadt"
                    className={editInputClass}
                  />
                </div>
                <input
                  value={shippingDraft.country}
                  onChange={(event) => setShippingDraft((draft) => ({ ...draft, country: event.target.value }))}
                  placeholder="Land"
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
                {savingOrderEdit ? "Speichern..." : "Auftrag speichern"}
              </Button>
              <p className="text-xs leading-5 text-slate-500">{editMessage ?? "Kunde, Versandadresse, Zahlung, Status und Prioritaet koennen hier angepasst werden."}</p>
            </div>
          </DetailCard>

          <DetailCard title="Uebersicht" icon={FileCheck2}>
            <div className="space-y-3">
              <InfoRow label="Zahlung" value={paymentStatus} />
              <InfoRow label="Druckdaten" value={allPrintFilesApproved ? "Ready" : "Open"} />
              <InfoRow label="Auftrag" value={<StatusChip status={status} />} />
              <InfoRow label="Versanddienst" value={carrier || "-"} />
            </div>
          </DetailCard>

          <DetailCard title="Versand" icon={Truck}>
            <div className="space-y-3">
              <label className="block text-sm text-slate-400" htmlFor="shipping-carrier">
                Versanddienst
              </label>
              <input
                id="shipping-carrier"
                value={carrier}
                onChange={(event) => setCarrier(event.target.value)}
                placeholder="DPD, UPS, DHL..."
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-300/10"
              />
              <label className="block text-sm text-slate-400" htmlFor="tracking-number">
                Sendungsnummer
              </label>
              <input
                id="tracking-number"
                value={trackingNumber}
                onChange={(event) => setTrackingNumber(event.target.value)}
                placeholder="Sendungsnummer eintragen..."
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
                {savingOrderAction === "tracking" ? "Speichern..." : "Versand speichern"}
              </Button>
              <p className="text-xs leading-5 text-slate-500">
                {trackingMessage ?? "Versanddaten sind ein separater Schritt nach der Produktion."}
              </p>
            </div>
          </DetailCard>

          <DetailCard title="Workflow" icon={PackageCheck}>
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => markWorkflowStatus("In production")}
                disabled={savingOrderAction === "status"}
                className="w-full justify-start rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800"
              >
                <Package className="h-4 w-4" />
                {savingOrderAction === "status" ? "Speichern..." : "In Produktion setzen"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => markWorkflowStatus("Ready to ship")}
                disabled={savingOrderAction === "status"}
                className="w-full justify-start rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800"
              >
                <PackageCheck className="h-4 w-4" />
                {savingOrderAction === "status" ? "Speichern..." : "Versandbereit setzen"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => updateArchiveStatus("ship")}
                disabled={savingOrderAction === "status" || status === "Shipped" || status === "Completed"}
                className="w-full justify-start rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800"
              >
                <Truck className="h-4 w-4" />
                {savingOrderAction === "status" ? "Speichern..." : "Als versendet markieren"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => updateArchiveStatus("complete")}
                disabled={savingOrderAction === "status" || status === "Completed"}
                className="w-full justify-start rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800"
              >
                <PackageCheck className="h-4 w-4" />
                {savingOrderAction === "status" ? "Speichern..." : "Auftrag abschliessen"}
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
                  {savingOrderAction === "status" ? "Speichern..." : "Auftrag wieder oeffnen"}
                </Button>
              ) : null}
            </div>
          </DetailCard>
        </aside>
      </section>
    </div>
  );
}
