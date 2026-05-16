import { connection } from "next/server";
import { OrdersWorkspace } from "@/src/components/orders/orders-workspace";
import { getOrdersWithFallback } from "@/src/lib/orders-db";

export default async function OrdersPage() {
  await connection();
  const { orders, source } = await getOrdersWithFallback();

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-200">Orders</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-5xl">Order list</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Central queue for WooCommerce, eBay and E-Mail orders. Current data source: {source === "database" ? "Postgres" : "mock fallback"}.
          </p>
        </div>
        <span className="rounded-full border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
          {orders.length} orders
        </span>
      </header>

      <OrdersWorkspace orders={orders} />
    </div>
  );
}
