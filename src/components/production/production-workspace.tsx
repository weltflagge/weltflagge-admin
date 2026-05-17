"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  downloadProductionXlsx,
  sortProductionRowsForExport,
  validateProductionRowsForExport,
} from "@/src/lib/production-export";
import { manufacturerLabels, manufacturers } from "@/src/lib/mock-production";
import type { ManufacturerId, ProductionRow } from "@/src/types/production";

type ActiveManufacturer = Exclude<ManufacturerId, "needs_review">;
type ManufacturerFilter = ManufacturerId;
type ProductionActionResult = Promise<{ ok: boolean; error?: string; batchId?: string }>;

const manufacturerFilters: Array<{ id: ManufacturerFilter; label: string }> = [
  { id: "opinion", label: "Opinion" },
  { id: "logo_pl", label: "Logo.pl" },
  { id: "mph_maciej", label: "MPH - Maciej" },
  { id: "wmd", label: "WMD" },
  { id: "needs_review", label: "Prufen" },
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

function isReadyToSend(row: ProductionRow) {
  return (row.paymentStatus ?? "Paid") === "Paid" && row.manufacturer !== "needs_review" && hasApprovedPrintFiles(row) && !isSent(row);
}

function statusLabel(row: ProductionRow) {
  if ((row.paymentStatus ?? "Paid") !== "Paid") {
    return "Nicht bezahlt";
  }

  if (row.manufacturer === "needs_review") {
    return "Hersteller prufen";
  }

  if (!hasApprovedPrintFiles(row)) {
    return "Druckdaten offen";
  }

  if (isSent(row)) {
    return "An Hersteller gesendet";
  }

  return "Bereit";
}

function statusClass(row: ProductionRow) {
  const label = statusLabel(row);

  if (label === "Bereit") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
  }

  if (label === "An Hersteller gesendet") {
    return "border-cyan-500/25 bg-cyan-500/10 text-cyan-200";
  }

  return "border-amber-500/25 bg-amber-500/10 text-amber-200";
}

function primaryPrintFileLabel(row: ProductionRow) {
  const files = getPrintFiles(row);
  const front = files.find((file) => (file.side ?? "front") === "front") ?? files[0];

  return front?.fileName || "fehlt";
}

function Section({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none backdrop-blur-xl">
      <CardContent className="p-5">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          {action}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function ProductionTable({
  rows,
  emptyTitle,
  emptyText,
  showSentDate = false,
  actionsForRow,
}: {
  rows: ProductionRow[];
  emptyTitle: string;
  emptyText: string;
  showSentDate?: boolean;
  actionsForRow?: (row: ProductionRow) => React.ReactNode;
}) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center">
        <p className="text-sm font-medium text-white">{emptyTitle}</p>
        <p className="mt-2 text-sm text-slate-500">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="min-w-[92rem] w-full border-collapse text-left text-sm">
        <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Bestellung</th>
            <th className="px-4 py-3 font-medium">Kunde</th>
            <th className="px-4 py-3 font-medium">Produkt</th>
            <th className="px-4 py-3 font-medium">Groesse</th>
            <th className="px-4 py-3 font-medium">Material</th>
            <th className="px-4 py-3 font-medium">Konfektion</th>
            <th className="px-4 py-3 font-medium">Stk.</th>
            <th className="px-4 py-3 font-medium">Hersteller</th>
            <th className="px-4 py-3 font-medium">Druckdatei</th>
            <th className="px-4 py-3 font-medium">Status</th>
            {showSentDate ? <th className="px-4 py-3 font-medium">Gesendet am</th> : null}
            <th className="px-4 py-3 font-medium">Aktion</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-800 bg-slate-950/30">
              <td className="px-4 py-3 font-medium text-cyan-100">
                <Link href={`/orders/${row.orderId}`} className="underline-offset-4 hover:underline">
                  {row.orderId}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-300">{row.customer}</td>
              <td className="px-4 py-3 text-white">{row.productName}</td>
              <td className="px-4 py-3 text-slate-300">{row.size}</td>
              <td className="px-4 py-3 text-slate-300">{row.material}</td>
              <td className="px-4 py-3 text-slate-300">{row.finishing}</td>
              <td className="px-4 py-3 text-slate-200">{row.quantity}</td>
              <td className="px-4 py-3 text-slate-300">{manufacturerLabels[row.manufacturer]}</td>
              <td className="px-4 py-3 text-slate-300">{primaryPrintFileLabel(row)}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(row)}`}>
                  {statusLabel(row)}
                </span>
              </td>
              {showSentDate ? <td className="px-4 py-3 text-slate-300">{row.sentAt && row.sentAt !== "-" ? row.sentAt : "-"}</td> : null}
              <td className="px-4 py-3">{actionsForRow?.(row) ?? <span className="text-slate-600">-</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
  const [selectedManufacturer, setSelectedManufacturer] = useState<ManufacturerFilter>("opinion");
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const readyRows = useMemo(() => rows.filter(isReadyToSend), [rows]);
  const sentRows = useMemo(() => rows.filter(isSent), [rows]);
  const selectedRows = useMemo(
    () => rows.filter((row) => row.manufacturer === selectedManufacturer),
    [rows, selectedManufacturer]
  );
  const selectedReadyRows = useMemo(
    () => selectedRows.filter(isReadyToSend),
    [selectedRows]
  );
  const activeManufacturer = selectedManufacturer === "needs_review" ? null : selectedManufacturer;
  const exportValidation = activeManufacturer
    ? validateProductionRowsForExport(selectedReadyRows, { allowReceivedFiles: false })
    : { readyRows: 0, blockedRows: 0, issues: [] };
  const hasExportBlockers = exportValidation.blockedRows > 0;

  async function assignRow(rowId: string, manufacturer: ActiveManufacturer) {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              manufacturer,
              productionStatus: "draft",
              routingReason: `Manuell zu ${manufacturerLabels[manufacturer]} zugeordnet.`,
            }
          : row
      )
    );
    setSelectedManufacturer(manufacturer);
    setMessage(null);

    if (!onAssignManufacturer) {
      return;
    }

    setSavingAction(`assign-${rowId}`);

    try {
      const result = await onAssignManufacturer({ rowId, manufacturer });
      setMessage(result.ok ? `Artikel wurde ${manufacturerLabels[manufacturer]} zugeordnet.` : result.error ?? "Zuordnung konnte nicht gespeichert werden.");
    } catch {
      setMessage("Zuordnung konnte nicht gespeichert werden.");
    } finally {
      setSavingAction(null);
    }
  }

  async function markSelectedAsSent() {
    if (!activeManufacturer || !selectedReadyRows.length || hasExportBlockers) {
      return;
    }

    const now = new Date().toISOString().slice(0, 10);
    const rowIds = selectedReadyRows.map((row) => row.id);

    setRows((currentRows) =>
      currentRows.map((row) =>
        rowIds.includes(row.id)
          ? {
              ...row,
              productionStatus: "sent",
              sentAt: now,
            }
          : row
      )
    );
    setMessage(null);

    if (!onSendBatch) {
      return;
    }

    setSavingAction("send");

    try {
      const result = await onSendBatch({
        manufacturer: activeManufacturer,
        rowIds,
      });
      setMessage(result.ok ? "Artikel wurden als an Hersteller gesendet markiert." : result.error ?? "Artikel konnten nicht gesendet werden.");
    } catch {
      setMessage("Artikel konnten nicht gesendet werden.");
    } finally {
      setSavingAction(null);
    }
  }

  function exportSelectedXlsx() {
    if (!activeManufacturer || !selectedReadyRows.length || hasExportBlockers) {
      return;
    }

    downloadProductionXlsx(activeManufacturer, sortProductionRowsForExport(activeManufacturer, selectedReadyRows), new Date().toISOString().slice(0, 10));
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none">
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Bereit zum Senden</p>
            <p className="mt-2 text-3xl font-semibold text-white">{readyRows.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none">
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">An Hersteller gesendet</p>
            <p className="mt-2 text-3xl font-semibold text-white">{sentRows.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none">
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Prufen</p>
            <p className="mt-2 text-3xl font-semibold text-white">{rows.filter((row) => row.manufacturer === "needs_review").length}</p>
          </CardContent>
        </Card>
      </section>

      {message ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">{message}</div>
      ) : null}

      <Section
        title="Bereit zum Senden"
        subtitle="Bezahlte Artikel mit freigegebenen Druckdaten, die noch nicht an den Hersteller gesendet wurden."
      >
        <ProductionTable
          rows={readyRows}
          emptyTitle="Keine Artikel bereit."
          emptyText="Sobald Zahlung und Druckdaten freigegeben sind, erscheinen die Artikel hier."
          actionsForRow={(row) => (
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedManufacturer(row.manufacturer)}
              className="rounded-lg border-slate-800 bg-slate-900 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Hersteller öffnen
            </Button>
          )}
        />
      </Section>

      <Section
        title="Hersteller"
        subtitle="Waehle einen Hersteller, exportiere die XLSX-Liste und markiere die Artikel danach als gesendet."
        action={
          activeManufacturer ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={exportSelectedXlsx}
                disabled={!selectedReadyRows.length || hasExportBlockers}
                className="rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40"
              >
                <FileSpreadsheet className="h-4 w-4" />
                XLSX exportieren
              </Button>
              <Button
                type="button"
                onClick={markSelectedAsSent}
                disabled={!selectedReadyRows.length || hasExportBlockers || savingAction === "send"}
                className="rounded-xl bg-cyan-200 text-slate-950 hover:bg-cyan-100 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
                {savingAction === "send" ? "Speichern..." : "An Hersteller gesendet"}
              </Button>
            </div>
          ) : null
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {manufacturerFilters.map((filter) => {
            const active = selectedManufacturer === filter.id;
            const count = rows.filter((row) => row.manufacturer === filter.id).length;

            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setSelectedManufacturer(filter.id)}
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

        {selectedManufacturer === "needs_review" ? (
          <ProductionTable
            rows={selectedRows}
            emptyTitle="Keine Artikel zu prufen."
            emptyText="Alle Artikel sind einem Hersteller zugeordnet."
            actionsForRow={(row) => (
              <div className="flex flex-wrap gap-2">
                {manufacturers.map((manufacturer) => (
                  <Button
                    key={manufacturer.id}
                    type="button"
                    variant="outline"
                    onClick={() => assignRow(row.id, manufacturer.id)}
                    disabled={savingAction === `assign-${row.id}`}
                    className="rounded-lg border-slate-800 bg-slate-900 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
                  >
                    {manufacturer.name}
                  </Button>
                ))}
              </div>
            )}
          />
        ) : (
          <>
            {hasExportBlockers ? (
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <p>
                  Einige Artikel sind noch nicht exportierbar. Bitte Zahlung, Hersteller und freigegebene Druckdaten prufen.
                </p>
              </div>
            ) : selectedReadyRows.length ? (
              <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                <CheckCircle2 className="h-4 w-4" />
                <p>{selectedReadyRows.length} Artikel bereit fur {manufacturerLabels[selectedManufacturer]}.</p>
              </div>
            ) : null}
            <ProductionTable
              rows={selectedRows}
              emptyTitle="Keine Artikel fuer diesen Hersteller."
              emptyText="Waehle einen anderen Hersteller oder ordne Artikel unter 'Prufen' zu."
            />
          </>
        )}
      </Section>

      <Section
        title="An Hersteller gesendet"
        subtitle="Interner Produktionsstatus. Versand und Tracking bleiben ein separater Prozess."
      >
        <ProductionTable
          rows={sentRows}
          emptyTitle="Noch nichts gesendet."
          emptyText="Gesendete Artikel erscheinen hier mit internem Produktionsstatus."
          showSentDate
          actionsForRow={() => <span className="text-xs text-slate-500">Intern gesendet</span>}
        />
      </Section>
    </div>
  );
}
