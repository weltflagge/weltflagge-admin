import { connection } from "next/server";
import { InventoryWorkspace } from "@/src/components/inventory/inventory-workspace";
import { getInventoryDashboard } from "@/src/lib/inventory";
import { addInventoryItem, adjustInventoryStock, createReorderDraft, importInventoryCsv, saveInventoryItemSettings } from "./actions";

export default async function InventoryPage() {
  await connection();
  const dashboard = await getInventoryDashboard();

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-[#8095ff]">Lager</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">Beachflag Systeme</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Stabiler Bestand fuer Beachflag Systeme mit automatischem Abzug, Meldebestand und nachvollziehbarer Bewegungshistorie.
            Datenquelle: {dashboard.source === "database" ? "Postgres" : "keine Datenbank"}.
          </p>
        </div>
      </header>

      <InventoryWorkspace
        dashboard={dashboard}
        onAdjustStock={adjustInventoryStock}
        onAddItem={addInventoryItem}
        onSaveSettings={saveInventoryItemSettings}
        onCreateReorderDraft={createReorderDraft}
        onImportCsv={importInventoryCsv}
      />
    </div>
  );
}
