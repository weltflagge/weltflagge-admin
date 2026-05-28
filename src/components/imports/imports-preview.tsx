"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, PackageSearch, RefreshCcw, RotateCcw, Save, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ImportDashboard, ImportSourceId } from "@/src/lib/import-sync";
import { sourceLabels } from "@/src/lib/mock-orders";
import { getCatalogEntry, getCatalogMaterial, printModeLabels, productCatalog, type PrintMode, type ProductTypeId } from "@/src/lib/product-catalog";
import type { NormalizedImportItem, NormalizedImportOrder, StoredOrderImport } from "@/src/lib/order-imports";
import { manufacturerLabels } from "@/src/lib/mock-production";
import type { ManufacturerId } from "@/src/types/production";

type SyncAction = () => Promise<{ ok: boolean; message?: string; error?: string }>;
type SyncSourceAction = (source: ImportSourceId) => Promise<{ ok: boolean; message?: string; error?: string }>;
type ApproveAction = (importId: string, input: NormalizedImportOrder) => Promise<{ ok: boolean; orderNumber?: string; error?: string }>;
type SkipAction = (importId: string) => Promise<{ ok: boolean; error?: string }>;
type ReopenAction = (importId: string) => Promise<{ ok: boolean; status?: "pending" | "needs_review"; error?: string }>;
type ImportView = "active" | "skipped" | "approved";

const inputClass =
  "w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-300/10";

function confidenceClass(confidence: "high" | "needs_review") {
  return confidence === "high"
    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
    : "border-amber-500/25 bg-amber-500/10 text-amber-200";
}

function manufacturerClass(manufacturer: string) {
  if (manufacturer === "needs_review") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-200";
  }

  return "border-cyan-300/20 bg-cyan-300/10 text-cyan-100";
}

function statusLabel(status: StoredOrderImport["importStatus"]) {
  return {
    pending: "Freigabe offen",
    needs_review: "Review nötig",
    approved: "Als Auftrag erstellt",
    skipped: "Uebersprungen",
    error: "Fehler",
  }[status];
}

function formatTimestamp(value?: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function resultClass(result: string) {
  if (result === "imported") return "text-emerald-200";
  if (result === "updated") return "text-cyan-200";
  if (result === "skipped") return "text-slate-400";

  return "text-red-200";
}

function dashboardSourceLabel(dashboard: ImportDashboard, source: ImportSourceId) {
  return dashboard.sources.find((entry) => entry.source === source)?.label ?? sourceLabels[source];
}

function recalculateOrder(order: NormalizedImportOrder): NormalizedImportOrder {
  const items = order.items.map((item) => {
    const warnings: string[] = [];
    const material = item.productType && item.materialId ? getCatalogMaterial(item.productType, item.materialId) : undefined;

    if (!item.productType) warnings.push("Product type could not be detected.");
    if (!material) warnings.push("Material could not be mapped to the catalog.");
    if (item.productType === "beachflag" && !item.shape) warnings.push("Beachflag shape is missing or unknown.");
    if (!item.size) warnings.push("Size could not be detected.");
    if (item.printFiles.some((file) => file.status === "missing")) warnings.push("Print file is missing.");

    const manufacturer = material?.manufacturer ?? item.manufacturer;
    const confidence: NormalizedImportItem["confidence"] =
      item.productType && material && item.size && manufacturer !== "needs_review" && warnings.length === 0 ? "high" : "needs_review";

    return {
      ...item,
      productLabel: item.productType ? getCatalogEntry(item.productType).label : "Needs review",
      materialLabel: material?.label ?? item.materialLabel,
      manufacturer,
      routingReason: material && item.productType ? `${getCatalogEntry(item.productType).label} / ${material.label} -> ${material.manufacturer}` : item.routingReason,
      confidence,
      warnings,
    };
  });

  return {
    ...order,
    items,
    readyItems: items.filter((item) => item.confidence === "high").length,
    reviewItems: items.filter((item) => item.confidence === "needs_review").length,
  };
}

function normalizeItemPatch(item: NormalizedImportItem, patch: Partial<NormalizedImportItem>) {
  const nextItem = { ...item, ...patch };
  const productTypeChanged = patch.productType !== undefined && patch.productType !== item.productType;
  const shapeChanged = patch.shape !== undefined && patch.shape !== item.shape;

  if (!nextItem.productType) {
    return nextItem;
  }

  const entry = getCatalogEntry(nextItem.productType);
  const material = entry.materials.some((option) => option.id === nextItem.materialId)
    ? getCatalogMaterial(nextItem.productType, nextItem.materialId ?? "")
    : entry.materials[0];
  const printMode = material.allowedPrintModes.includes(nextItem.printMode) ? nextItem.printMode : material.allowedPrintModes[0];
  const shape = entry.shapes?.includes(nextItem.shape) ? nextItem.shape : entry.shapes?.[0] ?? "";
  const allowedSizes = entry.sizeMode === "preset" ? entry.sizes?.[shape] ?? [] : [];
  const size =
    entry.sizeMode === "preset"
      ? allowedSizes.includes(nextItem.size) && !shapeChanged
        ? nextItem.size
        : allowedSizes[0] ?? ""
      : productTypeChanged
        ? entry.defaultSize ?? nextItem.size
        : nextItem.size;

  return {
    ...nextItem,
    materialId: material.id,
    materialLabel: material.label,
    manufacturer: material.manufacturer,
    printMode,
    shape,
    size,
  };
}

function editableOrder(order: StoredOrderImport): NormalizedImportOrder {
  return {
    id: order.id,
    source: order.source,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    amount: order.amount,
    currency: order.currency,
    receivedAt: order.receivedAt,
    paymentStatus: order.paymentStatus,
    billingAddress: order.billingAddress,
    shippingAddress: order.shippingAddress,
    items: order.items,
    readyItems: order.readyItems,
    reviewItems: order.reviewItems,
  };
}

export function ImportsPreview({
  initialImports,
  dashboard,
  onSyncWoo,
  onSyncSource,
  onApproveOrder,
  onSkipOrder,
  onReopenOrder,
}: {
  initialImports: StoredOrderImport[];
  dashboard: ImportDashboard;
  onSyncWoo: SyncAction;
  onSyncSource: SyncSourceAction;
  onApproveOrder: ApproveAction;
  onSkipOrder: SkipAction;
  onReopenOrder: ReopenAction;
}) {
  const [orders, setOrders] = useState(initialImports);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<ImportView>("active");
  const [skippingIds, setSkippingIds] = useState<string[]>([]);

  const totals = useMemo(() => {
    const activeOrders = orders.filter((order) => order.importStatus !== "skipped" && order.importStatus !== "approved");
    const totalItems = activeOrders.reduce((sum, order) => sum + order.items.length, 0);
    const readyItems = activeOrders.reduce((sum, order) => sum + order.readyItems, 0);
    const reviewItems = activeOrders.reduce((sum, order) => sum + order.reviewItems, 0);
    const skippedOrders = orders.filter((order) => order.importStatus === "skipped").length;
    const approvedOrders = orders.filter((order) => order.importStatus === "approved").length;

    return { totalItems, readyItems, reviewItems, skippedOrders, approvedOrders };
  }, [orders]);

  const visibleOrders = useMemo(
    () =>
      orders.filter((order) => {
        if (view === "skipped") return order.importStatus === "skipped";
        if (view === "approved") return order.importStatus === "approved";

        return order.importStatus !== "skipped" && order.importStatus !== "approved";
      }),
    [orders, view]
  );

  function updateOrder(importDbId: string, patch: Partial<NormalizedImportOrder>) {
    setOrders((current) =>
      current.map((order) => (order.importDbId === importDbId ? { ...order, ...recalculateOrder({ ...editableOrder(order), ...patch }) } : order))
    );
  }

  function updateItem(importDbId: string, externalLineId: string, patch: Partial<NormalizedImportItem>) {
    setOrders((current) =>
      current.map((order) => {
        if (order.importDbId !== importDbId) return order;

        const payload = editableOrder(order);
        const nextPayload = recalculateOrder({
          ...payload,
          items: payload.items.map((item) => (item.externalLineId === externalLineId ? normalizeItemPatch(item, patch) : item)),
        });

        return { ...order, ...nextPayload };
      })
    );
  }

  async function syncWoo() {
    setBusy("sync");
    setMessage(null);

    try {
      const result = await onSyncWoo();
      setMessage(result.ok ? result.message ?? "WooCommerce sync fertig." : result.error ?? "WooCommerce sync fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  async function syncSource(source: ImportSourceId) {
    setBusy(`source-${source}`);
    setMessage(null);

    try {
      const result = await onSyncSource(source);
      setMessage(result.ok ? result.message ?? "Manueller Sync fertig." : result.error ?? "Manueller Sync fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  async function approve(order: StoredOrderImport) {
    setBusy(order.importDbId);
    setMessage(null);

    try {
      const result = await onApproveOrder(order.importDbId, editableOrder(order));

      if (result.ok) {
        setOrders((current) =>
          current.map((entry) =>
            entry.importDbId === order.importDbId ? { ...entry, importStatus: "approved", approvedOrderNumber: result.orderNumber } : entry
          )
        );
        setMessage(`Auftrag ${result.orderNumber} wurde erstellt.`);
        return;
      }

      setMessage(result.error ?? "Import konnte nicht freigegeben werden.");
    } finally {
      setBusy(null);
    }
  }

  async function skip(order: StoredOrderImport) {
    setBusy(order.importDbId);
    setMessage(null);

    try {
      const result = await onSkipOrder(order.importDbId);

      if (result.ok) {
        setSkippingIds((current) => [...current, order.importDbId]);
        window.setTimeout(() => {
          setOrders((current) => current.map((entry) => (entry.importDbId === order.importDbId ? { ...entry, importStatus: "skipped" } : entry)));
          setSkippingIds((current) => current.filter((id) => id !== order.importDbId));
          setMessage(`${order.orderNumber} wurde aus der aktiven Import Queue genommen.`);
        }, 450);
        return;
      }

      setMessage(result.error ?? "Import konnte nicht uebersprungen werden.");
    } finally {
      setBusy(null);
    }
  }

  async function reopen(order: StoredOrderImport) {
    setBusy(order.importDbId);
    setMessage(null);

    try {
      const result = await onReopenOrder(order.importDbId);

      if (result.ok) {
        setOrders((current) =>
          current.map((entry) => (entry.importDbId === order.importDbId ? { ...entry, importStatus: result.status ?? "pending" } : entry))
        );
        setView("active");
        setMessage(`${order.orderNumber} ist wieder in der aktiven Import Queue.`);
        return;
      }

      setMessage(result.error ?? "Import konnte nicht zurueckgeholt werden.");
    } finally {
      setBusy(null);
    }
  }

  function viewButtonClass(nextView: ImportView) {
    return view === nextView
      ? "rounded-xl bg-cyan-200 text-slate-950 hover:bg-cyan-100"
      : "rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800";
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-200">Automatic sync</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-5xl">Imports</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Neue externe Bestellungen landen automatisch in der Import Queue. Startdatum: {dashboard.startDate}.
          </p>
        </div>
        <Button type="button" onClick={syncWoo} disabled={busy === "sync"} variant="outline" className="rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800">
          <RefreshCcw className="h-4 w-4" />
          {busy === "sync" ? "Sync..." : "Debug sync weltflagge.de"}
        </Button>
      </header>

      {message ? <p className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-sm text-slate-300">{message}</p> : null}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {dashboard.sources.map((source) => (
          <Card key={source.source} className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-white">{source.label}</p>
                  <p className={source.configured ? "mt-1 text-xs text-emerald-200" : "mt-1 text-xs text-amber-200"}>
                    {source.configured ? "Verbunden" : "Konfiguration fehlt"}
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => syncSource(source.source)}
                  disabled={!source.configured || busy === `source-${source.source}`}
                  variant="outline"
                  className="rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800"
                >
                  <RefreshCcw className="h-4 w-4" />
                  {busy === `source-${source.source}` ? "Sync..." : "Manuell synchronisieren"}
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-lg bg-slate-900/70 p-3">
                  <p className="text-xs text-slate-500">Importiert</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-200">{source.importedToday}</p>
                </div>
                <div className="rounded-lg bg-slate-900/70 p-3">
                  <p className="text-xs text-slate-500">Updates</p>
                  <p className="mt-1 text-lg font-semibold text-cyan-200">{source.updatedToday}</p>
                </div>
                <div className="rounded-lg bg-slate-900/70 p-3">
                  <p className="text-xs text-slate-500">Skipped</p>
                  <p className="mt-1 text-lg font-semibold text-slate-300">{source.skippedToday}</p>
                </div>
              </div>
              <div className="space-y-2 text-xs text-slate-500">
                <p>Last success: <span className="text-slate-300">{formatTimestamp(source.lastSuccessfulSyncAt)}</span></p>
                <p>Last error: <span className={source.lastErrorMessage ? "text-red-200" : "text-slate-300"}>{source.lastErrorMessage || "-"}</span></p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Import log</h2>
            <span className="text-xs text-slate-500">Letzte 50 Ereignisse</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr className="border-b border-slate-800">
                  <th className="py-2 pr-4 font-medium">Zeit</th>
                  <th className="py-2 pr-4 font-medium">Quelle</th>
                  <th className="py-2 pr-4 font-medium">External ID</th>
                  <th className="py-2 pr-4 font-medium">Result</th>
                  <th className="py-2 font-medium">Message</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.logs.length ? (
                  dashboard.logs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-900 text-slate-300">
                      <td className="py-2 pr-4">{formatTimestamp(log.createdAt)}</td>
                      <td className="py-2 pr-4">{dashboardSourceLabel(dashboard, log.source)}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{log.externalId}</td>
                      <td className={`py-2 pr-4 font-medium ${resultClass(log.result)}`}>{log.result}</td>
                      <td className="py-2 text-slate-400">{log.message || "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-slate-500">
                      Noch keine Import Logs.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={view === "active" ? "default" : "outline"} onClick={() => setView("active")} className={viewButtonClass("active")}>
          Aktiv
        </Button>
        <Button type="button" variant={view === "skipped" ? "default" : "outline"} onClick={() => setView("skipped")} className={viewButtonClass("skipped")}>
          Kihagyott ({totals.skippedOrders})
        </Button>
        <Button type="button" variant={view === "approved" ? "default" : "outline"} onClick={() => setView("approved")} className={viewButtonClass("approved")}>
          Auftraege ({totals.approvedOrders})
        </Button>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-slate-500">Import items</p>
              <p className="mt-2 text-3xl font-semibold text-white">{totals.totalItems}</p>
            </div>
            <PackageSearch className="h-6 w-6 text-cyan-200" />
          </CardContent>
        </Card>
        <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-slate-500">Ready</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-200">{totals.readyItems}</p>
            </div>
            <CheckCircle2 className="h-6 w-6 text-emerald-200" />
          </CardContent>
        </Card>
        <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-slate-500">Review</p>
              <p className="mt-2 text-3xl font-semibold text-amber-200">{totals.reviewItems}</p>
            </div>
            <AlertTriangle className="h-6 w-6 text-amber-200" />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-5">
        {visibleOrders.length === 0 ? (
          <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none">
            <CardContent className="p-6 text-sm text-slate-400">Ebben a nezetben most nincs import.</CardContent>
          </Card>
        ) : null}

        {visibleOrders.map((order) => {
          const isSkipping = skippingIds.includes(order.importDbId);

          return (
          <Card
            key={order.importDbId}
            className={`overflow-hidden rounded-xl border-slate-800 bg-slate-950/70 shadow-none transition-all duration-500 ease-in-out ${
              isSkipping ? "max-h-0 translate-x-24 scale-[0.98] border-transparent opacity-0 blur-sm" : "max-h-[2200px] translate-x-0 opacity-100 blur-0"
            }`}
          >
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 border-b border-slate-800 pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300">{sourceLabels[order.source]}</span>
                    <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300">{statusLabel(order.importStatus)}</span>
                    <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300">
                      {order.receivedAt.slice(0, 16).replace("T", " ")}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                    <input value={order.orderNumber} onChange={(event) => updateOrder(order.importDbId, { orderNumber: event.target.value })} className={inputClass} />
                    <input value={order.customerName} onChange={(event) => updateOrder(order.importDbId, { customerName: event.target.value })} className={inputClass} />
                    <input value={order.customerEmail} onChange={(event) => updateOrder(order.importDbId, { customerEmail: event.target.value })} className={inputClass} />
                    <input value={order.amount} onChange={(event) => updateOrder(order.importDbId, { amount: event.target.value })} className={inputClass} />
                  </div>
                </div>
                <div className="flex flex-col gap-2 lg:items-end">
                  {order.importStatus === "skipped" ? (
                    <Button type="button" onClick={() => reopen(order)} disabled={busy === order.importDbId} className="rounded-xl bg-cyan-200 text-slate-950 hover:bg-cyan-100">
                      <RotateCcw className="h-4 w-4" />
                      {busy === order.importDbId ? "Oeffne..." : "Visszanyitas"}
                    </Button>
                  ) : order.approvedOrderNumber ? (
                    <Button asChild variant="outline" className="rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800">
                      <Link href={`/orders/${order.approvedOrderNumber}`}>
                        <Send className="h-4 w-4" />
                        Auftrag öffnen
                      </Link>
                    </Button>
                  ) : (
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Button type="button" onClick={() => skip(order)} disabled={busy === order.importDbId} variant="outline" className="rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800">
                        <XCircle className="h-4 w-4" />
                        Kihagyas
                      </Button>
                      <Button type="button" onClick={() => approve(order)} disabled={busy === order.importDbId} className="rounded-xl bg-emerald-200 text-slate-950 hover:bg-emerald-100">
                        <Save className="h-4 w-4" />
                        {busy === order.importDbId ? "Erstelle..." : "Als Auftrag freigeben"}
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-slate-500">
                    {order.readyItems}/{order.items.length} ready, {order.reviewItems} review
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {order.items.map((item) => (
                  <div key={item.externalLineId} className="rounded-xl border border-slate-800 bg-slate-900/45 p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${confidenceClass(item.confidence)}`}>
                        {item.confidence === "high" ? "Mapped" : "Needs review"}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${manufacturerClass(item.manufacturer)}`}>
                        {manufacturerLabels[item.manufacturer]}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
                      <input value={item.title} onChange={(event) => updateItem(order.importDbId, item.externalLineId, { title: event.target.value })} className={inputClass} />
                      <input value={item.sku} onChange={(event) => updateItem(order.importDbId, item.externalLineId, { sku: event.target.value })} className={inputClass} />
                      <input type="number" min="1" value={item.quantity} onChange={(event) => updateItem(order.importDbId, item.externalLineId, { quantity: Number(event.target.value) })} className={inputClass} />
                      <input value={item.size} onChange={(event) => updateItem(order.importDbId, item.externalLineId, { size: event.target.value })} placeholder="Groesse" className={inputClass} />
                      <select value={item.productType ?? ""} onChange={(event) => updateItem(order.importDbId, item.externalLineId, { productType: event.target.value as ProductTypeId })} className={inputClass}>
                        {productCatalog.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.label}
                          </option>
                        ))}
                      </select>
                      <select value={item.materialId ?? ""} onChange={(event) => updateItem(order.importDbId, item.externalLineId, { materialId: event.target.value })} className={inputClass}>
                        {getCatalogEntry(item.productType ?? "flag").materials.map((material) => (
                          <option key={material.id} value={material.id}>
                            {material.label}
                          </option>
                        ))}
                      </select>
                      {getCatalogEntry(item.productType ?? "flag").shapes ? (
                        <select value={item.shape} onChange={(event) => updateItem(order.importDbId, item.externalLineId, { shape: event.target.value })} className={inputClass}>
                          {getCatalogEntry(item.productType ?? "flag").shapes?.map((shape) => (
                            <option key={shape} value={shape}>
                              {shape}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input value={item.shape} onChange={(event) => updateItem(order.importDbId, item.externalLineId, { shape: event.target.value })} placeholder="Form" className={inputClass} />
                      )}
                      <select value={item.printMode} onChange={(event) => updateItem(order.importDbId, item.externalLineId, { printMode: event.target.value as PrintMode })} className={inputClass}>
                        {getCatalogMaterial(item.productType ?? "flag", item.materialId ?? "fahnenstoff-115").allowedPrintModes.map((mode) => (
                          <option key={mode} value={mode}>
                            {printModeLabels[mode]}
                          </option>
                        ))}
                      </select>
                      <select value={item.manufacturer} onChange={(event) => updateItem(order.importDbId, item.externalLineId, { manufacturer: event.target.value as ManufacturerId })} className={inputClass}>
                        {Object.entries(manufacturerLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-3 space-y-2">
                      {item.printFiles.map((file, index) => (
                        <div key={`${item.externalLineId}-${file.side}-${index}`} className="grid grid-cols-1 gap-2 rounded-lg bg-slate-950/70 p-3 text-sm md:grid-cols-[8rem_1fr_1fr]">
                          <span className="flex items-center gap-2 text-slate-400">
                            <FileText className="h-4 w-4 text-slate-500" />
                            {file.side}
                          </span>
                          <input
                            value={file.fileName}
                            onChange={(event) =>
                              updateItem(order.importDbId, item.externalLineId, {
                                printFiles: item.printFiles.map((entry, fileIndex) => (fileIndex === index ? { ...entry, fileName: event.target.value, status: event.target.value ? "received" : "missing" } : entry)),
                              })
                            }
                            placeholder="Druckdatei"
                            className={inputClass}
                          />
                          <input
                            value={file.fileUrl ?? ""}
                            onChange={(event) =>
                              updateItem(order.importDbId, item.externalLineId, {
                                printFiles: item.printFiles.map((entry, fileIndex) => (fileIndex === index ? { ...entry, fileUrl: event.target.value || undefined } : entry)),
                              })
                            }
                            placeholder="URL"
                            className={inputClass}
                          />
                        </div>
                      ))}
                    </div>

                    {item.warnings.length ? (
                      <div className="mt-4 rounded-xl border border-amber-500/15 bg-amber-500/10 p-3 text-sm text-amber-100">{item.warnings.join(" ")}</div>
                    ) : (
                      <p className="mt-4 text-xs text-slate-500">{item.routingReason}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          );
        })}
      </section>
    </div>
  );
}
