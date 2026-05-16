import { connection } from "next/server";
import { ProductionWorkspace } from "@/src/components/production/production-workspace";
import { getProductionWithFallback } from "@/src/lib/production-db";
import { assignProductionManufacturer, createProductionDraftBatch, sendProductionBatch } from "./actions";

export default async function ProductionPage() {
  await connection();
  const { rows, batchStatus, source } = await getProductionWithFallback();

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-slate-800 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-200">Production</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-5xl">Manufacturer batches</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Route order items to Opinion, Logo.pl and MPH, review exceptions, then prepare manufacturer-ready batch
            tables. Current data source: {source === "database" ? "Postgres" : "mock fallback"}.
          </p>
        </div>
      </header>

      <ProductionWorkspace
        initialRows={rows}
        initialBatchStatus={batchStatus}
        onAssignManufacturer={assignProductionManufacturer}
        onCreateDraftBatch={createProductionDraftBatch}
        onSendBatch={sendProductionBatch}
      />
    </div>
  );
}
