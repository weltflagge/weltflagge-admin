import { connection } from "next/server";
import { ProductionWorkspace } from "@/src/components/production/production-workspace";
import { getProductionWithFallback } from "@/src/lib/production-db";
import { assignProductionManufacturer, sendProductionBatch } from "./actions";

export default async function ProductionPage() {
  await connection();
  const { rows, source } = await getProductionWithFallback();

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-[#8095ff]">Produktion</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">Hersteller-Versand</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Bezahlte Artikel mit freigegebenen Druckdaten exportieren und intern als an den Hersteller gesendet markieren.
            Datenquelle: {source === "database" ? "Postgres" : "Mock-Daten"}.
          </p>
        </div>
      </header>

      <ProductionWorkspace
        initialRows={rows}
        onAssignManufacturer={assignProductionManufacturer}
        onSendBatch={sendProductionBatch}
      />
    </div>
  );
}
