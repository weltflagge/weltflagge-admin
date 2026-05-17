import { connection } from "next/server";
import Link from "next/link";
import { FileUp, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrdersWorkspace } from "@/src/components/orders/orders-workspace";
import { getOrdersWithFallback } from "@/src/lib/orders-db";

export default async function OrdersPage() {
  await connection();
  const { orders, source } = await getOrdersWithFallback();

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-[#8095ff]">Orders</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">Auftragsuebersicht</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Kompakte Arbeitsliste fuer offene Auftraege. Datenquelle: {source === "database" ? "Postgres" : "Mock fallback"}.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
            {orders.length} Auftraege
          </span>
          <Button asChild variant="outline" className="rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800">
            <Link href="/orders/import">
              <FileUp className="h-4 w-4" />
              Angebot importieren
            </Link>
          </Button>
          <Button asChild className="rounded-xl bg-cyan-200 text-slate-950 hover:bg-cyan-100">
            <Link href="/orders/new">
              <PlusCircle className="h-4 w-4" />
              Neue Bestellung
            </Link>
          </Button>
        </div>
      </header>

      <OrdersWorkspace orders={orders} />
    </div>
  );
}
