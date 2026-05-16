import Link from "next/link";
import { connection } from "next/server";
import { AlertTriangle, CalendarClock, Euro, Inbox, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MetricCard } from "@/src/components/dashboard/metric-card";
import { OrderCard } from "@/src/components/orders/order-card";
import { statuses, statusConfig } from "@/src/lib/mock-orders";
import { getOrdersWithFallback } from "@/src/lib/orders-db";

export default async function DashboardPage() {
  await connection();
  const { orders, source } = await getOrdersWithFallback();
  const openTasks = orders.filter((order) => order.status !== "Shipped" && order.status !== "Completed").length;
  const critical = orders.filter((order) => order.priority === "urgent").length;
  const ready = orders.filter((order) => order.status === "Ready to ship").length;
  const activeOrders = orders.filter((order) => order.status !== "Shipped" && order.status !== "Completed").slice(0, 4);

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
          <Button className="rounded-xl bg-cyan-200 px-5 text-slate-950 hover:bg-cyan-100">New task</Button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Orders today" value={orders.length} subtitle={source === "database" ? "live order records" : "mock data for MVP planning"} icon={Inbox} />
        <MetricCard title="Open tasks" value={openTasks} subtitle="orders not yet shipped" icon={CalendarClock} />
        <MetricCard title="Critical" value={critical} subtitle="needs immediate attention" icon={AlertTriangle} />
        <MetricCard title="Ready to ship" value={ready} subtitle="waiting for labels" icon={PackageCheck} />
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
                  <Euro className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">MVP focus</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Keep integrations mocked until the order workflow, status model and operator screens feel reliable.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
