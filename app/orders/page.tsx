import { OrdersWorkspace } from "@/src/components/orders/orders-workspace";
import { mockOrders } from "@/src/lib/mock-orders";

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-200">Orders</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-5xl">Order list</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Mocked central queue for WooCommerce, eBay and E-Mail orders. Real connectors come after the workflow is
            stable.
          </p>
        </div>
        <span className="rounded-full border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
          {mockOrders.length} orders
        </span>
      </header>

      <OrdersWorkspace />
    </div>
  );
}
