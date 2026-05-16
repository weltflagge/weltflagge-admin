"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Factory,
  FileSpreadsheet,
  PackageCheck,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  downloadProductionXlsx,
  productionExportSchemas,
  sortProductionRowsForExport,
  validateProductionRowsForExport,
} from "@/src/lib/production-export";
import { manufacturerLabels, manufacturers } from "@/src/lib/mock-production";
import type {
  ManufacturerId,
  ProductionBatchStatus,
  ProductionExportColumn,
  ProductionExportValidationIssue,
  ProductionRow,
} from "@/src/types/production";

type ActiveManufacturer = Exclude<ManufacturerId, "needs_review">;
type BatchStatusMap = Record<ActiveManufacturer, ProductionBatchStatus>;
type ProductionActionResult = Promise<{ ok: boolean; error?: string; batchId?: string }>;

const defaultInitialBatchStatus: BatchStatusMap = {
  opinion: "Draft",
  logo_pl: "Draft",
  mph_maciej: "Draft",
  wmd: "Draft",
};

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none backdrop-blur-xl">
      <CardContent className="p-5">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function ManufacturerBadge({ manufacturer }: { manufacturer: ManufacturerId }) {
  const warning = manufacturer === "needs_review";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-medium ${
        warning
          ? "border-amber-500/25 bg-amber-500/10 text-amber-200"
          : "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
      }`}
    >
      {manufacturerLabels[manufacturer]}
    </span>
  );
}

function BatchTable({
  rows,
  columns,
  issues,
}: {
  rows: ProductionRow[];
  columns: ProductionExportColumn[];
  issues: ProductionExportValidationIssue[];
}) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center">
        <p className="text-sm font-medium text-white">No rows in this batch yet.</p>
        <p className="mt-2 text-sm text-slate-500">Assign review items or choose another manufacturer.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800">
      <div
        className="grid min-w-[78rem] gap-3 bg-slate-900 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(8rem, 1fr)) minmax(12rem, 1.2fr)` }}
      >
        {columns.map((column) => (
          <span key={column.key}>{column.label}</span>
        ))}
        <span>Validation</span>
      </div>
      {rows.map((row, rowIndex) => (
        <div
          key={row.id}
          className={`grid min-w-[78rem] gap-3 border-t px-4 py-4 text-sm ${
            issues.some((issue) => issue.rowId === row.id)
              ? "border-red-500/20 bg-red-500/5"
              : "border-slate-800"
          }`}
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(8rem, 1fr)) minmax(12rem, 1.2fr)` }}
        >
          {columns.map((column) => (
            <span
              key={`${row.id}-${column.key}`}
              className={column.key === "orderId" || column.key === "position" ? "font-medium text-cyan-100" : "text-slate-300"}
            >
              {column.key === "orderId" ? (
                <Link href={`/orders/${row.orderId}`} className="underline-offset-4 transition hover:text-[#0a84ff] hover:underline">
                  {column.getValue(row, rowIndex)}
                </Link>
              ) : (
                column.getValue(row, rowIndex)
              )}
            </span>
          ))}
          <span className="text-slate-300">
            {issues
              .filter((issue) => issue.rowId === row.id)
              .map((issue) => issue.reason)
              .join(", ") || "Ready"}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ProductionWorkspace({
  initialRows,
  initialBatchStatus = defaultInitialBatchStatus,
  onAssignManufacturer,
  onCreateDraftBatch,
  onSendBatch,
}: {
  initialRows: ProductionRow[];
  initialBatchStatus?: BatchStatusMap;
  onAssignManufacturer?: (input: { rowId: string; manufacturer: ActiveManufacturer }) => ProductionActionResult;
  onCreateDraftBatch?: (input: { manufacturer: ActiveManufacturer; rowIds: string[] }) => ProductionActionResult;
  onSendBatch?: (input: { manufacturer: ActiveManufacturer; rowIds: string[] }) => ProductionActionResult;
}) {
  const [rows, setRows] = useState(initialRows);
  const [selectedManufacturer, setSelectedManufacturer] = useState<ActiveManufacturer>("opinion");
  const [batchStatus, setBatchStatus] = useState<BatchStatusMap>(initialBatchStatus);
  const [allowReceivedFiles, setAllowReceivedFiles] = useState(false);
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const [productionMessage, setProductionMessage] = useState<string | null>(null);

  const reviewRows = rows.filter((row) => row.manufacturer === "needs_review");
  const routedRows = rows.filter((row) => row.manufacturer !== "needs_review");
  const selectedRows = rows.filter((row) => row.manufacturer === selectedManufacturer);
  const sortedSelectedRows = sortProductionRowsForExport(selectedManufacturer, selectedRows);
  const selectedManufacturerMeta = manufacturers.find((manufacturer) => manufacturer.id === selectedManufacturer);

  const manufacturerStats = useMemo(() => {
    return manufacturers.map((manufacturer) => {
      const manufacturerRows = rows.filter((row) => row.manufacturer === manufacturer.id);
      const quantity = manufacturerRows.reduce((sum, row) => sum + row.quantity, 0);

      return {
        ...manufacturer,
        rows: manufacturerRows,
        quantity,
      };
    });
  }, [rows]);

  const totalQuantity = routedRows.reduce((sum, row) => sum + row.quantity, 0);
  const batchId = `batch-2026-05-16-${selectedManufacturer}`;
  const currentStatus = batchStatus[selectedManufacturer];
  const sent = currentStatus === "Sent to manufacturer";
  const exportColumns = productionExportSchemas[selectedManufacturer];
  const exportValidation = validateProductionRowsForExport(selectedRows, { allowReceivedFiles });
  const hasExportBlockers = exportValidation.blockedRows > 0;
  const selectedIssues = exportValidation.issues;

  async function assignRow(rowId: string, manufacturer: ActiveManufacturer) {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              manufacturer,
              productionStatus: "draft",
              batchId: `batch-2026-05-16-${manufacturer}`,
              notes: `${row.notes} Assigned manually to ${manufacturerLabels[manufacturer]}.`,
              routingReason: `Manual assignment to ${manufacturerLabels[manufacturer]}.`,
            }
          : row
      )
    );
    setSelectedManufacturer(manufacturer);
    setProductionMessage(null);

    if (!onAssignManufacturer) {
      return;
    }

    setSavingAction(`assign-${rowId}`);

    try {
      const result = await onAssignManufacturer({ rowId, manufacturer });
      setProductionMessage(result.ok ? `Assigned to ${manufacturerLabels[manufacturer]} and saved.` : result.error ?? "Assignment could not be saved.");
    } catch {
      setProductionMessage("Assignment could not be saved.");
    } finally {
      setSavingAction(null);
    }
  }

  async function createDraftBatch() {
    setBatchStatus((currentStatusMap) => ({
      ...currentStatusMap,
      [selectedManufacturer]: "Draft",
    }));
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.manufacturer === selectedManufacturer
          ? {
              ...row,
              productionStatus: "draft",
              batchId,
            }
          : row
      )
    );
    setProductionMessage(null);

    if (!onCreateDraftBatch) {
      return;
    }

    setSavingAction("draft");

    try {
      const result = await onCreateDraftBatch({
        manufacturer: selectedManufacturer,
        rowIds: selectedRows.map((row) => row.id),
      });
      setProductionMessage(result.ok ? `Draft batch ${result.batchId ?? batchId} saved.` : result.error ?? "Draft batch could not be saved.");
    } catch {
      setProductionMessage("Draft batch could not be saved.");
    } finally {
      setSavingAction(null);
    }
  }

  async function sendToManufacturer() {
    if (hasExportBlockers) {
      return;
    }

    setRows((currentRows) =>
      currentRows.map((row) =>
        row.manufacturer === selectedManufacturer
          ? {
              ...row,
              productionStatus: "sent",
              batchId: `batch-2026-05-16-${selectedManufacturer}`,
            }
          : row
      )
    );
    setBatchStatus((currentStatusMap) => ({
      ...currentStatusMap,
      [selectedManufacturer]: "Sent to manufacturer",
    }));
    setProductionMessage(null);

    if (!onSendBatch) {
      return;
    }

    setSavingAction("send");

    try {
      const result = await onSendBatch({
        manufacturer: selectedManufacturer,
        rowIds: selectedRows.map((row) => row.id),
      });
      setProductionMessage(result.ok ? `Batch ${result.batchId ?? batchId} marked as sent.` : result.error ?? "Batch could not be sent.");
    } catch {
      setProductionMessage("Batch could not be sent.");
    } finally {
      setSavingAction(null);
    }
  }

  function exportXlsx() {
    if (hasExportBlockers) {
      return;
    }

    downloadProductionXlsx(selectedManufacturer, selectedRows, "2026-05-16");
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none backdrop-blur-xl">
          <CardContent className="p-5">
            <p className="text-sm text-slate-400">Routed items</p>
            <p className="mt-2 text-3xl font-semibold text-white">{routedRows.length}</p>
            <p className="mt-2 text-sm text-slate-500">{totalQuantity} total pieces in manufacturer queues</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none backdrop-blur-xl">
          <CardContent className="p-5">
            <p className="text-sm text-slate-400">Selected batch</p>
            <p className="mt-2 text-3xl font-semibold text-white">{selectedRows.length}</p>
            <p className="mt-2 text-sm text-slate-500">
              {manufacturerLabels[selectedManufacturer]} - {currentStatus}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">Sending a batch updates item production status only.</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-amber-500/20 bg-amber-500/5 shadow-none backdrop-blur-xl">
          <CardContent className="p-5">
            <p className={hasExportBlockers ? "text-sm text-red-200" : "text-sm text-emerald-200"}>Export validation</p>
            <p className="mt-2 text-3xl font-semibold text-white">{exportValidation.blockedRows}</p>
            <p className="mt-2 text-sm text-slate-500">
              {exportValidation.readyRows} ready / {exportValidation.blockedRows} blocked in selected batch
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Manufacturer routing" subtitle="Choose a manufacturer to preview and prepare its batch.">
          <div className="space-y-3">
            {manufacturerStats.map((manufacturer) => {
              const active = selectedManufacturer === manufacturer.id;

              return (
                <button
                  type="button"
                  key={manufacturer.id}
                  onClick={() => setSelectedManufacturer(manufacturer.id)}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    active
                      ? "border-cyan-300/30 bg-cyan-300/10"
                      : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Factory className="h-4 w-4 text-cyan-200" />
                        <h3 className="font-semibold text-white">{manufacturer.name}</h3>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{manufacturer.specialty}</p>
                      <p className="mt-2 text-xs text-slate-500">{manufacturer.exportFormat}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-white">{manufacturer.rows.length}</p>
                      <p className="text-xs text-slate-500">{manufacturer.quantity} pieces</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel title="Needs review" subtitle="Assign rows manually before creating a manufacturer export.">
          {reviewRows.length ? (
            <div className="space-y-3">
              {reviewRows.map((row) => (
                <div key={row.id} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-200" />
                        <p className="font-medium text-white">
                          {row.orderId} - {row.productName}
                        </p>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">{row.routingReason}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.customer} - {row.size} - Qty {row.quantity}
                      </p>
                    </div>
                    <ManufacturerBadge manufacturer={row.manufacturer} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {manufacturers.map((manufacturer) => (
                      <Button
                        key={manufacturer.id}
                        type="button"
                        variant="outline"
                        onClick={() => assignRow(row.id, manufacturer.id)}
                        disabled={savingAction === `assign-${row.id}`}
                        className="rounded-full border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
                      >
                        {savingAction === `assign-${row.id}` ? "Saving..." : `Assign to ${manufacturer.name}`}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
              <div className="flex items-center gap-3 text-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
                <p className="text-sm font-medium">All rows are assigned.</p>
              </div>
              <p className="mt-2 text-sm text-slate-500">You can now create or send manufacturer batches.</p>
            </div>
          )}
        </Panel>
      </section>

      <Panel
        title={`Batch preview: ${manufacturerLabels[selectedManufacturer]}`}
        subtitle={`${batchId} - ${selectedRows.length} rows - status: ${currentStatus}`}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <ClipboardList className="h-4 w-4 text-cyan-200" />
              {selectedManufacturerMeta?.contact}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Preview follows the {manufacturerLabels[selectedManufacturer]} export schema and sorting. Main orders stay open.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ManufacturerBadge manufacturer={selectedManufacturer} />
            <Button
              type="button"
              variant="outline"
              onClick={createDraftBatch}
              disabled={!selectedRows.length || savingAction === "draft"}
              className="rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800"
            >
              <PackageCheck className="h-4 w-4" />
              {savingAction === "draft" ? "Saving..." : "Create draft batch"}
            </Button>
            <Button
              type="button"
              onClick={sendToManufacturer}
              disabled={!selectedRows.length || sent || hasExportBlockers || savingAction === "send"}
              className="rounded-xl bg-cyan-200 text-slate-950 hover:bg-cyan-100 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              {savingAction === "send" ? "Saving..." : sent ? "Sent" : "Mark as sent"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={exportXlsx}
              disabled={!selectedRows.length || hasExportBlockers}
              className="rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800 disabled:text-slate-500 disabled:opacity-40"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export XLSX
            </Button>
          </div>
        </div>
        {productionMessage ? (
          <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">
            {productionMessage}
          </div>
        ) : null}
        <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-medium text-white">Production impact</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Marking this batch as sent changes these order items to <span className="text-cyan-100">sent to manufacturer</span>.
                It does not close the main customer order; shipping and final order status remain separate.
              </p>
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={allowReceivedFiles}
                onChange={(event) => setAllowReceivedFiles(event.target.checked)}
                className="h-4 w-4 accent-cyan-300"
              />
              Allow received files
            </label>
          </div>
        </div>
        <div
          className={`mb-4 rounded-xl border p-4 ${
            hasExportBlockers ? "border-red-500/20 bg-red-500/5" : "border-emerald-500/20 bg-emerald-500/5"
          }`}
        >
          <div className="flex flex-wrap items-center gap-3">
            {hasExportBlockers ? (
              <AlertTriangle className="h-4 w-4 text-red-200" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-200" />
            )}
            <p className="text-sm font-medium text-white">
              {exportValidation.readyRows} rows ready, {exportValidation.blockedRows} rows blocked
            </p>
          </div>
          {hasExportBlockers ? (
            <ul className="mt-3 space-y-1 text-sm text-slate-400">
              {selectedIssues.map((issue) => {
                const row = selectedRows.find((selectedRow) => selectedRow.id === issue.rowId);

                return (
                  <li key={`${issue.rowId}-${issue.reason}`}>
                    {row?.orderId ?? issue.rowId}: {issue.reason}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-400">This batch can be sent or exported.</p>
          )}
        </div>
        <div className="overflow-x-auto">
          <BatchTable rows={sortedSelectedRows} columns={exportColumns} issues={selectedIssues} />
        </div>
      </Panel>
    </div>
  );
}
