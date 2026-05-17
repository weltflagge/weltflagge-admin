"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Download, ExternalLink, FileSpreadsheet, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { downloadProductionXlsx, sortProductionRowsForExport } from "@/src/lib/production-export";
import { manufacturerLabels } from "@/src/lib/mock-production";
import type { ManufacturerId, ProductionRow } from "@/src/types/production";

type ActiveManufacturer = Exclude<ManufacturerId, "needs_review">;
type ManufacturerFilter = "all" | ManufacturerId;
type ProductionActionResult = Promise<{ ok: boolean; error?: string; batchId?: string }>;

const manufacturerFilters: Array<{ id: ManufacturerFilter; label: string }> = [
  { id: "all", label: "Alle" },
  { id: "opinion", label: "Opinion" },
  { id: "logo_pl", label: "Logo.pl" },
  { id: "mph_maciej", label: "MPH - Maciej" },
  { id: "wmd", label: "WMD" },
  { id: "needs_review", label: "Nicht zugeordnet" },
];

const assignableManufacturers: Array<{ id: ActiveManufacturer; label: string }> = [
  { id: "opinion", label: "Opinion" },
  { id: "logo_pl", label: "Logo.pl" },
  { id: "mph_maciej", label: "MPH - Maciej" },
  { id: "wmd", label: "WMD" },
];

function getPrintFiles(row: ProductionRow) {
  return row.printFiles?.length ? row.printFiles : [row.printFile];
}

function hasApprovedPrintFiles(row: ProductionRow) {
  return getPrintFiles(row).every((file) => file.fileName.trim() && file.status === "approved");
}

function isSent(row: ProductionRow) {
  return row.productionStatus === "sent" || row.productionStatus === "confirmed" || row.productionStatus === "produced";
}

function isReadyForProduction(row: ProductionRow) {
  return (row.paymentStatus ?? "Paid") === "Paid" && hasApprovedPrintFiles(row) && !isSent(row);
}

function primaryPrintFileLabel(row: ProductionRow) {
  const files = getPrintFiles(row);
  const front = files.find((file) => (file.side ?? "front") === "front") ?? files[0];

  return front?.fileName || "fehlt";
}

function manufacturerLabel(manufacturer: ManufacturerId) {
  return manufacturer === "needs_review" ? "Nicht zugeordnet" : manufacturerLabels[manufacturer];
}

function groupByManufacturer(rows: ProductionRow[]) {
  const groups = new Map<ActiveManufacturer, ProductionRow[]>();

  for (const row of rows) {
    if (row.manufacturer === "needs_review") {
      continue;
    }

    groups.set(row.manufacturer, [...(groups.get(row.manufacturer) ?? []), row]);
  }

  return groups;
}

export function ProductionWorkspace({
  initialRows,
  onAssignManufacturer,
  onSendBatch,
}: {
  initialRows: ProductionRow[];
  onAssignManufacturer?: (input: { rowId: string; manufacturer: ActiveManufacturer }) => ProductionActionResult;
  onSendBatch?: (input: { manufacturer: ActiveManufacturer; rowIds: string[] }) => ProductionActionResult;
}) {
  const [rows, setRows] = useState(initialRows);
  const [selectedFilter, setSelectedFilter] = useState<ManufacturerFilter>("all");
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [detailRowId, setDetailRowId] = useState<string | null>(null);
  const [bulkManufacturer, setBulkManufacturer] = useState<ActiveManufacturer>("opinion");
  const [showHistory, setShowHistory] = useState(false);
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const readyRows = useMemo(() => rows.filter(isReadyForProduction), [rows]);
  const sentRows = useMemo(() => rows.filter(isSent), [rows]);
  const visibleRows = useMemo(
    () => readyRows.filter((row) => selectedFilter === "all" || row.manufacturer === selectedFilter),
    [readyRows, selectedFilter]
  );
  const selectedRows = useMemo(
    () => readyRows.filter((row) => selectedRowIds.includes(row.id)),
    [readyRows, selectedRowIds]
  );
  const detailRow = rows.find((row) => row.id === detailRowId) ?? null;
  const assignedSelectedRows = selectedRows.filter((row) => row.manufacturer !== "needs_review");
  const hasUnassignedSelection = selectedRows.some((row) => row.manufacturer === "needs_review");
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedRowIds.includes(row.id));

  useEffect(() => {
    if (!detailRowId) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDetailRowId(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [detailRowId]);

  function toggleRow(rowId: string) {
    setSelectedRowIds((currentIds) =>
      currentIds.includes(rowId) ? currentIds.filter((id) => id !== rowId) : [...currentIds, rowId]
    );
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedRowIds((currentIds) => currentIds.filter((id) => !visibleRows.some((row) => row.id === id)));
      return;
    }

    setSelectedRowIds((currentIds) => [...new Set([...currentIds, ...visibleRows.map((row) => row.id)])]);
  }

  async function assignSelectedManufacturer() {
    if (!selectedRows.length) {
      return;
    }

    const rowIds = selectedRows.map((row) => row.id);
    setRows((currentRows) =>
      currentRows.map((row) =>
        rowIds.includes(row.id)
          ? {
              ...row,
              manufacturer: bulkManufacturer,
              productionStatus: "draft",
              routingReason: `Manuell zu ${manufacturerLabels[bulkManufacturer]} zugeordnet.`,
            }
          : row
      )
    );
    setMessage(null);

    if (!onAssignManufacturer) {
      return;
    }

    setSavingAction("assign");

    try {
      const results = await Promise.all(
        rowIds.map((rowId) => onAssignManufacturer({ rowId, manufacturer: bulkManufacturer }))
      );
      const failed = results.find((result) => !result.ok);
      setMessage(failed?.error ?? `${rowIds.length} Artikel wurden ${manufacturerLabels[bulkManufacturer]} zugeordnet.`);
    } catch {
      setMessage("Hersteller konnte nicht gespeichert werden.");
    } finally {
      setSavingAction(null);
    }
  }

  async function assignSingleManufacturer(row: ProductionRow, manufacturer: ActiveManufacturer) {
    setRows((currentRows) =>
      currentRows.map((currentRow) =>
        currentRow.id === row.id
          ? {
              ...currentRow,
              manufacturer,
              productionStatus: "draft",
              routingReason: `Manuell zu ${manufacturerLabels[manufacturer]} zugeordnet.`,
            }
          : currentRow
      )
    );
    setMessage(null);

    if (!onAssignManufacturer) {
      return;
    }

    setSavingAction(`assign-${row.id}`);

    try {
      const result = await onAssignManufacturer({ rowId: row.id, manufacturer });
      setMessage(result.ok ? `${row.orderId} wurde ${manufacturerLabels[manufacturer]} zugeordnet.` : result.error ?? "Hersteller konnte nicht gespeichert werden.");
    } catch {
      setMessage("Hersteller konnte nicht gespeichert werden.");
    } finally {
      setSavingAction(null);
    }
  }

  function exportSelectedXlsx() {
    const groups = groupByManufacturer(assignedSelectedRows);
    const today = new Date().toISOString().slice(0, 10);

    for (const [manufacturer, manufacturerRows] of groups) {
      downloadProductionXlsx(manufacturer, sortProductionRowsForExport(manufacturer, manufacturerRows), today);
    }
  }

  function exportSingleXlsx(row: ProductionRow) {
    if (row.manufacturer === "needs_review") {
      setMessage("Bitte zuerst einen Hersteller setzen.");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    downloadProductionXlsx(row.manufacturer, sortProductionRowsForExport(row.manufacturer, [row]), today);
  }

  async function markSelectedAsSent() {
    if (!assignedSelectedRows.length) {
      return;
    }

    const groups = groupByManufacturer(assignedSelectedRows);
    const sentRowIds = assignedSelectedRows.map((row) => row.id);
    const now = new Date().toISOString().slice(0, 10);

    setRows((currentRows) =>
      currentRows.map((row) =>
        sentRowIds.includes(row.id)
          ? {
              ...row,
              productionStatus: "sent",
              sentAt: now,
            }
          : row
      )
    );
    setSelectedRowIds((currentIds) => currentIds.filter((id) => !sentRowIds.includes(id)));
    setMessage(null);

    if (!onSendBatch) {
      return;
    }

    setSavingAction("send");

    try {
      const results = await Promise.all(
        [...groups.entries()].map(([manufacturer, manufacturerRows]) =>
          onSendBatch({
            manufacturer,
            rowIds: manufacturerRows.map((row) => row.id),
          })
        )
      );
      const failed = results.find((result) => !result.ok);
      setMessage(failed?.error ?? `${sentRowIds.length} Artikel als gesendet markiert.`);
    } catch {
      setMessage("Artikel konnten nicht als gesendet markiert werden.");
    } finally {
      setSavingAction(null);
    }
  }

  async function markSingleAsSent(row: ProductionRow) {
    if (row.manufacturer === "needs_review") {
      setMessage("Bitte zuerst einen Hersteller setzen.");
      return;
    }

    const now = new Date().toISOString().slice(0, 10);
    setRows((currentRows) =>
      currentRows.map((currentRow) =>
        currentRow.id === row.id
          ? {
              ...currentRow,
              productionStatus: "sent",
              sentAt: now,
            }
          : currentRow
      )
    );
    setSelectedRowIds((currentIds) => currentIds.filter((id) => id !== row.id));
    setDetailRowId(null);
    setMessage(null);

    if (!onSendBatch) {
      return;
    }

    setSavingAction(`send-${row.id}`);

    try {
      const result = await onSendBatch({ manufacturer: row.manufacturer, rowIds: [row.id] });
      setMessage(result.ok ? `${row.orderId} als gesendet markiert.` : result.error ?? "Artikel konnte nicht als gesendet markiert werden.");
    } catch {
      setMessage("Artikel konnte nicht als gesendet markiert werden.");
    } finally {
      setSavingAction(null);
    }
  }

  function closeDetailPanel() {
    setDetailRowId(null);
  }

  function openRowDetails(rowId: string, event: React.PointerEvent<HTMLTableRowElement>) {
    const target = event.target as HTMLElement;

    if (target.closest("input, a, button, select")) {
      return;
    }

    setDetailRowId(rowId);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-slate-800 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-200">{readyRows.length} Artikel bereit für Produktion</p>
          <p className="mt-1 text-sm text-slate-500">
            {selectedRows.length ? `${selectedRows.length} Artikel ausgewählt` : "Artikel auswählen, XLSX exportieren und als gesendet markieren."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowHistory((current) => !current)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >
          Gesendete Produktionen anzeigen
          <ChevronDown className={`h-4 w-4 transition ${showHistory ? "rotate-180" : ""}`} />
        </button>
      </div>

      <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {manufacturerFilters.map((filter) => {
                const active = selectedFilter === filter.id;
                const count = readyRows.filter((row) => filter.id === "all" || row.manufacturer === filter.id).length;

                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setSelectedFilter(filter.id)}
                    className={`rounded-xl border px-3 py-2 text-sm transition ${
                      active
                        ? "border-cyan-300/30 bg-cyan-300/10 text-white"
                        : "border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    {filter.label} <span className="text-slate-500">({count})</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={bulkManufacturer}
                onChange={(event) => setBulkManufacturer(event.target.value as ActiveManufacturer)}
                className="h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-300/40"
                aria-label="Hersteller auswählen"
              >
                {assignableManufacturers.map((manufacturer) => (
                  <option key={manufacturer.id} value={manufacturer.id}>
                    {manufacturer.label}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                onClick={assignSelectedManufacturer}
                disabled={!selectedRows.length || savingAction === "assign"}
                className="rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40"
              >
                <Check className="h-4 w-4" />
                Hersteller ändern
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={exportSelectedXlsx}
                disabled={!assignedSelectedRows.length || hasUnassignedSelection}
                className="rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40"
              >
                <FileSpreadsheet className="h-4 w-4" />
                XLSX exportieren
              </Button>
              <Button
                type="button"
                onClick={markSelectedAsSent}
                disabled={!assignedSelectedRows.length || hasUnassignedSelection || savingAction === "send"}
                className="rounded-xl bg-cyan-200 text-slate-950 hover:bg-cyan-100 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
                {savingAction === "send" ? "Speichern..." : "Als gesendet markieren"}
              </Button>
            </div>
          </div>

          {hasUnassignedSelection ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
              Bitte zuerst einen Hersteller für die ausgewählten Artikel setzen.
            </div>
          ) : null}
          {message ? <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">{message}</div> : null}

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-[82rem] w-full border-collapse text-left text-sm">
              <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      className="h-4 w-4 accent-cyan-300"
                      aria-label="Alle sichtbaren Artikel auswählen"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">Bestellung</th>
                  <th className="px-4 py-3 font-medium">Kunde</th>
                  <th className="px-4 py-3 font-medium">Produkt</th>
                  <th className="px-4 py-3 font-medium">Größe</th>
                  <th className="px-4 py-3 font-medium">Material</th>
                  <th className="px-4 py-3 font-medium">Konfektion</th>
                  <th className="px-4 py-3 font-medium">Stück</th>
                  <th className="px-4 py-3 font-medium">Hersteller</th>
                  <th className="px-4 py-3 font-medium">Druckdatei</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const active = detailRowId === row.id;

                  return (
                  <tr
                    key={row.id}
                    onPointerDown={(event) => openRowDetails(row.id, event)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setDetailRowId(row.id);
                      }
                    }}
                    tabIndex={0}
                    className={`cursor-pointer border-t border-slate-800 transition hover:bg-slate-900/80 focus:bg-slate-900/80 focus:outline-none ${
                      active ? "bg-cyan-300/10" : "bg-slate-950/30"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedRowIds.includes(row.id)}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => toggleRow(row.id)}
                        className="h-4 w-4 accent-cyan-300"
                        aria-label={`${row.orderId} auswählen`}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-cyan-100">
                      <Link href={`/orders/${row.orderId}`} onClick={(event) => event.stopPropagation()} className="underline-offset-4 hover:underline">
                        {row.orderId}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{row.customer}</td>
                    <td className="px-4 py-3 text-white">{row.productName}</td>
                    <td className="px-4 py-3 text-slate-300">{row.size}</td>
                    <td className="px-4 py-3 text-slate-300">{row.material}</td>
                    <td className="px-4 py-3 text-slate-300">{row.finishing}</td>
                    <td className="px-4 py-3 text-slate-200">{row.quantity}</td>
                    <td className="px-4 py-3 text-slate-300">{manufacturerLabel(row.manufacturer)}</td>
                    <td className="px-4 py-3 text-slate-300">{primaryPrintFileLabel(row)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            {!visibleRows.length ? (
              <div className="border-t border-slate-800 bg-slate-950/30 p-8 text-center">
                <p className="text-sm font-medium text-white">Keine Artikel in dieser Ansicht.</p>
                <p className="mt-2 text-sm text-slate-500">Sobald ein Artikel bezahlt ist und freigegebene Druckdaten hat, erscheint er hier.</p>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {showHistory ? (
        <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none">
          <CardContent className="p-5">
            <h2 className="text-xl font-semibold text-white">Gesendete Produktionen</h2>
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
              <table className="min-w-[62rem] w-full border-collapse text-left text-sm">
                <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Gesendet am</th>
                    <th className="px-4 py-3 font-medium">Hersteller</th>
                    <th className="px-4 py-3 font-medium">Bestellung</th>
                    <th className="px-4 py-3 font-medium">Kunde</th>
                    <th className="px-4 py-3 font-medium">Produkt</th>
                    <th className="px-4 py-3 font-medium">Stück</th>
                    <th className="px-4 py-3 font-medium">Druckdatei</th>
                  </tr>
                </thead>
                <tbody>
                  {sentRows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-800 bg-slate-950/30">
                      <td className="px-4 py-3 text-slate-300">{row.sentAt && row.sentAt !== "-" ? row.sentAt : "-"}</td>
                      <td className="px-4 py-3 text-slate-300">{manufacturerLabels[row.manufacturer]}</td>
                      <td className="px-4 py-3 font-medium text-cyan-100">
                        <Link href={`/orders/${row.orderId}`} className="underline-offset-4 hover:underline">
                          {row.orderId}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{row.customer}</td>
                      <td className="px-4 py-3 text-white">{row.productName}</td>
                      <td className="px-4 py-3 text-slate-200">{row.quantity}</td>
                      <td className="px-4 py-3 text-slate-300">{primaryPrintFileLabel(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!sentRows.length ? (
                <div className="border-t border-slate-800 bg-slate-950/30 p-8 text-center text-sm text-slate-500">
                  Noch keine gesendeten Produktionen.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {detailRow ? (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm"
          role="presentation"
          onMouseDown={closeDetailPanel}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={`Details ${detailRow.orderId}`}
            tabIndex={-1}
            onMouseDown={(event) => event.stopPropagation()}
            className="ml-auto flex h-full w-full max-w-xl flex-col border-l border-slate-800 bg-[#111827] shadow-2xl shadow-black/50"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5">
              <div>
                <p className="text-sm font-medium text-cyan-200">{detailRow.orderId}</p>
                <h2 className="mt-1 text-xl font-semibold text-white">{detailRow.customer}</h2>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-slate-300">
                    {detailRow.productionStatus}
                  </span>
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-cyan-100">
                    {manufacturerLabel(detailRow.manufacturer)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDetailPanel}
                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                aria-label="Schliessen"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-1 gap-3">
                <DetailRow label="Produkt" value={detailRow.productName} />
                <DetailRow label="Größe" value={detailRow.size} />
                <DetailRow label="Material" value={detailRow.material} />
                <DetailRow label="Konfektion" value={detailRow.finishing} />
                <DetailRow label="Stück" value={detailRow.quantity} />
                <DetailRow label="Druckdatei" value={primaryPrintFileLabel(detailRow)} />
                <DetailRow label="Druckdatenstatus" value={detailRow.printFile.status} />
              </div>

              <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-sm font-medium text-white">Hersteller</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {assignableManufacturers.map((manufacturer) => (
                    <Button
                      key={manufacturer.id}
                      type="button"
                      variant="outline"
                      onClick={() => assignSingleManufacturer(detailRow, manufacturer.id)}
                      disabled={savingAction === `assign-${detailRow.id}`}
                      className={`rounded-lg border-slate-800 text-sm ${
                        detailRow.manufacturer === manufacturer.id
                          ? "bg-cyan-300/10 text-white"
                          : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      {manufacturer.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-sm font-medium text-white">Notizen</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{detailRow.notes || "Keine internen Produktionsnotizen."}</p>
              </div>
            </div>

            <div className="border-t border-slate-800 p-5">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!detailRow.printFile.fileUrl}
                  className="rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40"
                  asChild={Boolean(detailRow.printFile.fileUrl)}
                >
                  {detailRow.printFile.fileUrl ? (
                    <a href={detailRow.printFile.fileUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Druckdatei öffnen
                    </a>
                  ) : (
                    <span>
                      <ExternalLink className="h-4 w-4" />
                      Druckdatei öffnen
                    </span>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => exportSingleXlsx(detailRow)}
                  disabled={detailRow.manufacturer === "needs_review"}
                  className="rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40"
                >
                  <Download className="h-4 w-4" />
                  XLSX exportieren
                </Button>
              </div>
              <Button
                type="button"
                onClick={() => markSingleAsSent(detailRow)}
                disabled={detailRow.manufacturer === "needs_review" || savingAction === `send-${detailRow.id}`}
                className="mt-3 h-11 w-full rounded-xl bg-cyan-200 text-slate-950 hover:bg-cyan-100 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
                {savingAction === `send-${detailRow.id}` ? "Speichern..." : "Als gesendet markieren"}
              </Button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-200">{value || "-"}</p>
    </div>
  );
}
