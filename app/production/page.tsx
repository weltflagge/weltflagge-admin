import { ProductionWorkspace } from "@/src/components/production/production-workspace";

export default function ProductionPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-slate-800 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-200">Production</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-5xl">Manufacturer batches</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Route order items to Opinion, Logo.pl and MPH, review exceptions, then prepare manufacturer-ready batch
            tables.
          </p>
        </div>
      </header>

      <ProductionWorkspace />
    </div>
  );
}
