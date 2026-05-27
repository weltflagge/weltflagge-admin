"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ClipboardList, History, Minus, PackagePlus, Pencil, Plus, RotateCcw, Save, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { InventoryDashboard, InventoryItemView, InventoryMovementView, InventoryStatus } from "@/src/lib/inventory";

type FilterStatus = "all" | InventoryStatus;

type InventoryActionResult = Promise<{ ok: boolean; error?: string }>;

const statusLabels: Record<InventoryStatus, string> = {
  out_of_stock: "Elfogyott",
  low_stock: "Keves",
  ok: "OK",
};

const reasonLabels: Record<string, string> = {
  MANUAL_CORRECTION: "Manual correction",
  ORDER_DEDUCTION: "Order",
  SUPPLIER_DELIVERY: "Supplier delivery",
  STOCK_RESET: "Stock reset",
  MANUAL_REDUCTION: "Manual reduction",
};

const inputClass =
  "w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-300/10";

function statusClass(status: InventoryStatus) {
  if (status === "out_of_stock") {
    return "border-red-500/25 bg-red-500/10 text-red-100";
  }

  if (status === "low_stock") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-100";
  }

  return "border-emerald-500/25 bg-emerald-500/10 text-emerald-100";
}

export function InventoryWorkspace({
  dashboard,
  onAdjustStock,
  onSaveSettings,
  onImportCsv,
}: {
  dashboard: InventoryDashboard;
  onAdjustStock?: (input: { inventoryItemId: string; mode: "add" | "reduce" | "correct"; quantity: number; note: string }) => InventoryActionResult;
  onSaveSettings?: (input: { inventoryItemId: string; minimumStock: number; reorderNote: string }) => InventoryActionResult;
  onImportCsv?: (input: { csvText: string }) => InventoryActionResult;
}) {
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [formFilter, setFormFilter] = useState("all");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [activeItem, setActiveItem] = useState<InventoryItemView | null>(null);
  const [activeAction, setActiveAction] = useState<"add" | "reduce" | "correct" | "settings" | "history" | "import" | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [minimumStock, setMinimumStock] = useState("3");
  const [reorderNote, setReorderNote] = useState("");
  const [note, setNote] = useState("");
  const [csvText, setCsvText] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const visibleItems = useMemo(
    () =>
      dashboard.items.filter(
        (item) =>
          (statusFilter === "all" || item.status === statusFilter) &&
          (formFilter === "all" || item.form === formFilter) &&
          (sizeFilter === "all" || item.size === sizeFilter)
      ),
    [dashboard.items, formFilter, sizeFilter, statusFilter]
  );

  const itemMovements = useMemo(
    () => dashboard.movements.filter((movement) => movement.inventoryItemId === activeItem?.id),
    [activeItem?.id, dashboard.movements]
  );

  function openAction(item: InventoryItemView, action: typeof activeAction) {
    setActiveItem(item);
    setActiveAction(action);
    setQuantity(action === "correct" ? String(item.currentStock) : "1");
    setMinimumStock(String(item.minimumStock));
    setReorderNote(item.reorderNote);
    setNote("");
    setMessage(null);
  }

  async function submitStockAction() {
    if (!activeItem || !activeAction || !onAdjustStock || activeAction === "settings" || activeAction === "history" || activeAction === "import") {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const result = await onAdjustStock({
        inventoryItemId: activeItem.id,
        mode: activeAction,
        quantity: Number.parseInt(quantity, 10) || 0,
        note,
      });
      setMessage(result.ok ? "Lagerbestand gespeichert." : result.error ?? "Aenderung konnte nicht gespeichert werden.");
      if (result.ok) {
        setActiveAction(null);
      }
    } catch {
      setMessage("Aenderung konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  async function submitSettings() {
    if (!activeItem || !onSaveSettings) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const result = await onSaveSettings({
        inventoryItemId: activeItem.id,
        minimumStock: Number.parseInt(minimumStock, 10) || 0,
        reorderNote,
      });
      setMessage(result.ok ? "Einstellungen gespeichert." : result.error ?? "Einstellungen konnten nicht gespeichert werden.");
      if (result.ok) {
        setActiveAction(null);
      }
    } catch {
      setMessage("Einstellungen konnten nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  async function submitImport() {
    if (!onImportCsv) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const result = await onImportCsv({ csvText });
      setMessage(result.ok ? "Import gespeichert." : result.error ?? "Import konnte nicht gespeichert werden.");
      if (result.ok) {
        setActiveAction(null);
        setCsvText("");
      }
    } catch {
      setMessage("Import konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none">
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-cyan-200">{dashboard.items.length} Beachflag Lagerartikel</p>
              <h2 className="mt-1 text-xl font-semibold text-white">{dashboard.reorderItems.length} Artikel muessen nachbestellt werden</h2>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setActiveItem(null);
                setActiveAction("import");
                setMessage(null);
              }}
              className="rounded-lg border-slate-800 bg-slate-900 text-white hover:bg-slate-800"
            >
              <Upload className="h-4 w-4" />
              CSV import
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-amber-500/20 bg-amber-500/10 shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 text-amber-100">
              <AlertTriangle className="h-5 w-5" />
              <p className="font-semibold">Nachbestellen</p>
            </div>
            <div className="mt-3 space-y-2">
              {dashboard.reorderItems.slice(0, 4).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-amber-50">{item.form} {item.size}</span>
                  <span className="text-amber-200">{item.currentStock} / min {item.minimumStock}</span>
                </div>
              ))}
              {!dashboard.reorderItems.length ? <p className="text-sm text-amber-100/80">Alles im gruenen Bereich.</p> : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none">
        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.3fr_0.7fr_0.7fr]">
            <div className="flex flex-wrap gap-2">
              {[
                ["all", "Alle"],
                ["low_stock", "Low stock"],
                ["out_of_stock", "Out of stock"],
                ["ok", "OK"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStatusFilter(id as FilterStatus)}
                  className={`rounded-lg border px-3 py-2 text-sm transition ${
                    statusFilter === id
                      ? "border-cyan-300/30 bg-cyan-300/10 text-white"
                      : "border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <select value={formFilter} onChange={(event) => setFormFilter(event.target.value)} className={inputClass} aria-label="Form filter">
              <option value="all">Alle Formen</option>
              {dashboard.forms.map((form) => (
                <option key={form} value={form}>{form}</option>
              ))}
            </select>
            <select value={sizeFilter} onChange={(event) => setSizeFilter(event.target.value)} className={inputClass} aria-label="Size filter">
              <option value="all">Alle Groessen</option>
              {dashboard.sizes.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>

          {message ? <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">{message}</div> : null}

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-[78rem] w-full border-collapse text-left text-sm">
              <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Form</th>
                  <th className="px-4 py-3 font-medium">Size</th>
                  <th className="px-4 py-3 font-medium">Current stock</th>
                  <th className="px-4 py-3 font-medium">Minimum stock</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Reorder note</th>
                  <th className="px-4 py-3 font-medium">Last change</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr key={item.id} className="border-t border-slate-800 bg-slate-950/30">
                    <td className="px-4 py-3 font-medium text-cyan-100">{item.sku}</td>
                    <td className="px-4 py-3 text-white">{item.name}</td>
                    <td className="px-4 py-3 text-slate-300">{item.form}</td>
                    <td className="px-4 py-3 text-slate-300">{item.size}</td>
                    <td className="px-4 py-3 text-slate-100">{item.currentStock}</td>
                    <td className="px-4 py-3 text-slate-300">{item.minimumStock}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(item.status)}`}>
                        {statusLabels[item.status]}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-slate-300">{item.reorderNote || "-"}</td>
                    <td className="px-4 py-3 text-slate-400">{item.lastStockChangeAt}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <IconButton label="Add stock" onClick={() => openAction(item, "add")} icon={<Plus className="h-4 w-4" />} />
                        <IconButton label="Reduce stock" onClick={() => openAction(item, "reduce")} icon={<Minus className="h-4 w-4" />} />
                        <IconButton label="Correct stock" onClick={() => openAction(item, "correct")} icon={<RotateCcw className="h-4 w-4" />} />
                        <IconButton label="Edit reorder settings" onClick={() => openAction(item, "settings")} icon={<Pencil className="h-4 w-4" />} />
                        <IconButton label="View history" onClick={() => openAction(item, "history")} icon={<History className="h-4 w-4" />} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visibleItems.length ? (
              <div className="border-t border-slate-800 bg-slate-950/30 p-8 text-center text-sm text-slate-500">
                Keine Lagerartikel in dieser Ansicht.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {activeAction ? (
        <InventoryDialog
          action={activeAction}
          item={activeItem}
          movements={itemMovements}
          quantity={quantity}
          minimumStock={minimumStock}
          reorderNote={reorderNote}
          note={note}
          csvText={csvText}
          saving={saving}
          onClose={() => setActiveAction(null)}
          onQuantityChange={setQuantity}
          onMinimumStockChange={setMinimumStock}
          onReorderNoteChange={setReorderNote}
          onNoteChange={setNote}
          onCsvTextChange={setCsvText}
          onSubmitStock={submitStockAction}
          onSubmitSettings={submitSettings}
          onSubmitImport={submitImport}
        />
      ) : null}
    </div>
  );
}

function IconButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300 transition hover:bg-slate-800 hover:text-white"
    >
      {icon}
    </button>
  );
}

function InventoryDialog({
  action,
  item,
  movements,
  quantity,
  minimumStock,
  reorderNote,
  note,
  csvText,
  saving,
  onClose,
  onQuantityChange,
  onMinimumStockChange,
  onReorderNoteChange,
  onNoteChange,
  onCsvTextChange,
  onSubmitStock,
  onSubmitSettings,
  onSubmitImport,
}: {
  action: "add" | "reduce" | "correct" | "settings" | "history" | "import";
  item: InventoryItemView | null;
  movements: InventoryMovementView[];
  quantity: string;
  minimumStock: string;
  reorderNote: string;
  note: string;
  csvText: string;
  saving: boolean;
  onClose: () => void;
  onQuantityChange: (value: string) => void;
  onMinimumStockChange: (value: string) => void;
  onReorderNoteChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onCsvTextChange: (value: string) => void;
  onSubmitStock: () => void;
  onSubmitSettings: () => void;
  onSubmitImport: () => void;
}) {
  const title =
    action === "import" ? "CSV import" : action === "history" ? "Lagerverlauf" : action === "settings" ? "Meldebestand bearbeiten" : "Bestand aendern";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-3xl rounded-xl border border-slate-800 bg-slate-950 shadow-2xl shadow-black/50"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div>
            <p className="text-sm font-medium text-cyan-200">{item ? `${item.sku} - ${item.form} ${item.size}` : "Beachflag Lager"}</p>
            <h2 className="mt-1 text-xl font-semibold text-white">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {action === "history" ? (
            <div className="max-h-[28rem] overflow-auto rounded-xl border border-slate-800">
              {movements.map((movement) => (
                <div key={movement.id} className="border-b border-slate-800 p-4 last:border-b-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-white">{movement.changeAmount > 0 ? `+${movement.changeAmount}` : movement.changeAmount} Stk.</p>
                    <p className="text-xs text-slate-500">{movement.createdAt}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-300">
                    {reasonLabels[movement.reason] ?? movement.reason}: {movement.previousStock} {"->"} {movement.newStock}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{movement.note || movement.orderNumber || "-"}</p>
                </div>
              ))}
              {!movements.length ? <div className="p-6 text-center text-sm text-slate-500">Noch keine Bewegungen fuer diesen Artikel.</div> : null}
            </div>
          ) : action === "settings" ? (
            <div className="grid grid-cols-1 gap-4">
              <label className="space-y-2 text-sm text-slate-400">
                <span>Minimum stock</span>
                <input type="number" min={0} value={minimumStock} onChange={(event) => onMinimumStockChange(event.target.value)} className={inputClass} />
              </label>
              <label className="space-y-2 text-sm text-slate-400">
                <span>Reorder note</span>
                <textarea value={reorderNote} onChange={(event) => onReorderNoteChange(event.target.value)} rows={4} className={inputClass} />
              </label>
            </div>
          ) : action === "import" ? (
            <div className="space-y-3">
              <textarea
                value={csvText}
                onChange={(event) => onCsvTextChange(event.target.value)}
                rows={10}
                placeholder="SKU, name, form, size, current stock, category, reorder note"
                className={inputClass}
              />
              <p className="text-xs text-slate-500">Existing SKUs are updated without changing stock; new SKUs create an initial stock reset history entry.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              <label className="space-y-2 text-sm text-slate-400">
                <span>{action === "correct" ? "New stock" : "Quantity"}</span>
                <input type="number" min={0} value={quantity} onChange={(event) => onQuantityChange(event.target.value)} className={inputClass} />
              </label>
              <label className="space-y-2 text-sm text-slate-400">
                <span>Reason note</span>
                <textarea value={note} onChange={(event) => onNoteChange(event.target.value)} rows={4} placeholder="Manual correction, supplier delivery..." className={inputClass} />
              </label>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-800 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ClipboardList className="h-4 w-4" />
            Jede Bestandsaenderung wird im Verlauf gespeichert.
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-lg border-slate-800 bg-slate-900 text-white hover:bg-slate-800">
              Abbrechen
            </Button>
            {action !== "history" ? (
              <Button
                type="button"
                onClick={action === "settings" ? onSubmitSettings : action === "import" ? onSubmitImport : onSubmitStock}
                disabled={saving}
                className="rounded-lg bg-cyan-200 text-slate-950 hover:bg-cyan-100"
              >
                {action === "import" ? <Upload className="h-4 w-4" /> : action === "settings" ? <Save className="h-4 w-4" /> : <PackagePlus className="h-4 w-4" />}
                {saving ? "Speichern..." : "Speichern"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
