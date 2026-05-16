import Link from "next/link";
import { connection } from "next/server";
import { AlertTriangle, CalendarClock, Euro, Inbox, PackageCheck, TrendingUp, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MetricCard } from "@/src/components/dashboard/metric-card";
import { OrderCard } from "@/src/components/orders/order-card";
import { statuses, statusConfig } from "@/src/lib/mock-orders";
import { getOrdersWithFallback } from "@/src/lib/orders-db";
import type { Order } from "@/src/types/order";

function amountToCents(amount: string) {
  const normalized = amount.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  return Math.round((Number.parseFloat(normalized) || 0) * 100);
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function getDailyStats(orders: Order[]) {
  const stats = new Map<string, { date: string; orders: number; revenueCents: number }>();

  for (const order of orders) {
    const current = stats.get(order.date) ?? { date: order.date, orders: 0, revenueCents: 0 };
    current.orders += 1;
    current.revenueCents += amountToCents(order.amount);
    stats.set(order.date, current);
  }

  return [...stats.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
}

function getTopProducts(orders: Order[]) {
  const products = new Map<string, { name: string; quantity: number; orders: number }>();

  for (const order of orders) {
    for (const item of order.items) {
      const current = products.get(item.name) ?? { name: item.name, quantity: 0, orders: 0 };
      current.quantity += item.quantity;
      current.orders += 1;
      products.set(item.name, current);
    }
  }

  return [...products.values()]
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, "de"))
    .slice(0, 5);
}

function DailyTrendChart({
  dailyStats,
}: {
  dailyStats: Array<{ date: string; orders: number; revenueCents: number }>;
}) {
  const maxRevenue = Math.max(1, ...dailyStats.map((day) => day.revenueCents));
  const maxOrders = Math.max(1, ...dailyStats.map((day) => day.orders));
  const points = dailyStats.map((day, index) => {
    const x = dailyStats.length === 1 ? 50 : (index / (dailyStats.length - 1)) * 100;
    const y = 84 - (day.revenueCents / maxRevenue) * 58;
    return `${x},${y}`;
  });

  return (
    <div className="mt-5">
      <div className="h-56 rounded-xl border border-slate-800 bg-black p-4">
        <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible" preserveAspectRatio="none" role="img" aria-label="Daily order revenue trend">
          {[20, 40, 60, 80].map((line) => (
            <line key={line} x1="0" x2="100" y1={line} y2={line} stroke="#24262b" strokeWidth="0.5" />
          ))}
          <polyline points={points.join(" ")} fill="none" stroke="#0a84ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {dailyStats.map((day, index) => {
            const x = dailyStats.length === 1 ? 50 : (index / (dailyStats.length - 1)) * 100;
            const height = Math.max(6, (day.orders / maxOrders) * 42);
            return (
              <rect
                key={day.date}
                x={x - 2}
                y={88 - height}
                width="4"
                height={height}
                rx="1.5"
                fill="#22c55e"
                opacity="0.45"
              />
            );
          })}
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 md:grid-cols-4">
        {dailyStats.slice(-4).map((day) => (
          <div key={day.date} className="rounded-lg bg-black p-3">
            <p className="font-medium text-slate-300">{day.date.slice(5)}</p>
            <p className="mt-1">{formatCurrency(day.revenueCents)} - {day.orders} orders</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  await connection();
  const { orders, source } = await getOrdersWithFallback();
  const openTasks = orders.filter((order) => order.status !== "Shipped" && order.status !== "Completed").length;
  const critical = orders.filter((order) => order.priority === "urgent").length;
  const ready = orders.filter((order) => order.status === "Ready to ship").length;
  const activeOrders = orders.filter((order) => order.status !== "Shipped" && order.status !== "Completed").slice(0, 4);
  const totalRevenueCents = orders.reduce((sum, order) => sum + amountToCents(order.amount), 0);
  const paidRevenueCents = orders
    .filter((order) => order.paymentStatus === "Paid")
    .reduce((sum, order) => sum + amountToCents(order.amount), 0);
  const dailyStats = getDailyStats(orders);
  const topProducts = getTopProducts(orders);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 border-b border-slate-800 pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300">
            Internal order command center - {source === "database" ? "Postgres live data" : "mock fallback"}
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-5xl">
            Central order operations
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
            One cockpit for incoming WooCommerce, eBay and E-Mail orders before they move into print-file checks,
            approvals, production and shipping.
          </p>
        </div>

        <div className="flex gap-3">
          <Button asChild variant="outline" className="rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800">
            <Link href="/orders">Open orders</Link>
          </Button>
          <Button asChild className="rounded-xl bg-cyan-200 px-5 text-slate-950 hover:bg-cyan-100">
            <Link href="/orders/new">New order</Link>
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Orders today" value={orders.length} subtitle={source === "database" ? "live order records" : "mock data for MVP planning"} icon={Inbox} />
        <MetricCard title="Revenue" value={formatCurrency(totalRevenueCents)} subtitle={`${formatCurrency(paidRevenueCents)} already paid`} icon={Euro} />
        <MetricCard title="Open tasks" value={openTasks} subtitle="orders not yet shipped" icon={CalendarClock} />
        <MetricCard title="Critical / ready" value={`${critical} / ${ready}`} subtitle="urgent and ready to ship" icon={AlertTriangle} />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none backdrop-blur-xl">
          <CardContent className="p-5">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Active orders</h2>
                <p className="mt-1 text-sm text-slate-500">Latest work items across all connected sales channels.</p>
              </div>
              <Button asChild variant="outline" className="rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800">
                <Link href="/orders">View all</Link>
              </Button>
            </div>
            <div className="space-y-3">
              {activeOrders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none backdrop-blur-xl">
            <CardContent className="p-5">
              <h2 className="text-xl font-semibold text-white">Pipeline</h2>
              <p className="mt-1 text-sm text-slate-500">Where orders currently need attention.</p>

              <div className="mt-5 space-y-3">
                {statuses.map((status) => {
                  const count = orders.filter((order) => order.status === status).length;
                  const percent = orders.length > 0 ? Math.max(8, (count / orders.length) * 100) : 0;
                  const Icon = statusConfig[status].icon;

                  return (
                    <div key={status}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-slate-300">
                          <Icon className="h-4 w-4" />
                          {status}
                        </div>
                        <span className="text-slate-500">{count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-cyan-300/70"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none backdrop-blur-xl">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-cyan-200">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Order value trend</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Revenue line with order-volume bars based on the last available order days.
                  </p>
                </div>
              </div>
              <DailyTrendChart dailyStats={dailyStats} />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none backdrop-blur-xl">
          <CardContent className="p-5">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Top products</h2>
                <p className="mt-1 text-sm text-slate-500">Most ordered items by quantity.</p>
              </div>
              <Trophy className="h-5 w-5 text-[#0a84ff]" />
            </div>
            <div className="space-y-3">
              {topProducts.map((product, index) => (
                <div key={product.name} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-xl bg-black p-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg border border-slate-800 text-sm font-semibold text-slate-400">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{product.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{product.orders} order lines</p>
                  </div>
                  <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-sm font-semibold text-slate-200">
                    {product.quantity} pcs
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none backdrop-blur-xl">
          <CardContent className="p-5">
            <h2 className="text-xl font-semibold text-white">Order operations snapshot</h2>
            <p className="mt-1 text-sm text-slate-500">Fast overview for the current queue.</p>
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-black p-4">
                <p className="text-sm text-slate-500">Paid orders</p>
                <p className="mt-2 text-2xl font-semibold text-white">{orders.filter((order) => order.paymentStatus === "Paid").length}</p>
              </div>
              <div className="rounded-xl bg-black p-4">
                <p className="text-sm text-slate-500">Missing files</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {orders.filter((order) => order.items.some((item) => item.printFile.status === "missing")).length}
                </p>
              </div>
              <div className="rounded-xl bg-black p-4">
                <p className="text-sm text-slate-500">In production</p>
                <p className="mt-2 text-2xl font-semibold text-white">{orders.filter((order) => order.status === "In production").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
