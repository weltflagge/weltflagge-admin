"use client";

import { useMemo, useState } from "react";
import { ChevronDown, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { priorityLabels, sourceLabels, statuses } from "@/src/lib/mock-orders";
import { getOrderNextAction, orderNeedsAction } from "@/src/lib/order-overview";
import type { Order, OrderPriority, OrderSource, OrderStatus } from "@/src/types/order";
import { OrderCard } from "./order-card";

type StatusFilter = "all" | OrderStatus;
type SourceFilter = "all" | OrderSource;
type PriorityFilter = "all" | OrderPriority;
type PaymentFilter = "all" | Order["paymentStatus"];
type SortKey = "newest" | "priority" | "amount";
type QuickView = "active" | "needs_action" | "production" | "ready_to_ship" | "completed";

const sourceOptions = Object.entries(sourceLabels) as Array<[OrderSource, string]>;
const priorityOptions = Object.entries(priorityLabels) as Array<[OrderPriority, string]>;

const priorityRank: Record<OrderPriority, number> = {
  urgent: 3,
  high: 2,
  normal: 1,
};

const quickViews: Array<{ id: QuickView; label: string }> = [
  { id: "active", label: "Active" },
  { id: "needs_action", label: "Needs action" },
  { id: "production", label: "Production" },
  { id: "ready_to_ship", label: "Ready to ship" },
  { id: "completed", label: "Completed" },
];

function parseAmount(amount: string) {
  return Number(amount.replace(" EUR", "").replace(".", "").replace(",", "."));
}

function getOrderSortDate(order: Order) {
  return order.createdAt ?? order.date;
}

function includesSearch(order: Order, search: string) {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  return [
    order.id,
    order.externalId,
    order.customer,
    order.email,
    order.status,
    order.artworkStatus,
    order.carrier,
    sourceLabels[order.source],
    ...order.items.flatMap((item) => [
      item.name,
      item.sku,
      item.size,
      item.printFile.fileName,
      item.printFile.status,
      item.production.manufacturer ?? "",
      item.production.status,
    ]),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalizedSearch);
}

function matchesQuickView(order: Order, view: QuickView) {
  if (view === "active") {
    return order.status !== "Shipped" && order.status !== "Completed" && order.status !== "Cancelled";
  }

  if (view === "needs_action") {
    return orderNeedsAction(order);
  }

  if (view === "production") {
    return (
      order.status === "In production" ||
      getOrderNextAction(order).label === "In Produktion" ||
      order.items.some((item) => item.production.status === "sent" || item.production.status === "confirmed")
    );
  }

  if (view === "ready_to_ship") {
    return order.status === "Ready to ship" || getOrderNextAction(order).label === "Versand vorbereiten";
  }

  return order.status === "Shipped" || order.status === "Completed" || order.status === "Cancelled";
}

function FilterButton({
  active,
  children,
  count,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
        active
          ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
          : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200"
      }`}
    >
      {children} <span className={active ? "text-cyan-200/70" : "text-slate-600"}>{count}</span>
    </button>
  );
}

function SelectField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

const selectClass =
  "h-10 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-sm text-slate-200 outline-none focus:border-cyan-300/40";

export function OrdersWorkspace({ orders }: { orders: Order[] }) {
  const [search, setSearch] = useState("");
  const [quickView, setQuickView] = useState<QuickView>("active");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [source, setSource] = useState<SourceFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [payment, setPayment] = useState<PaymentFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const quickCounts = useMemo(
    () =>
      Object.fromEntries(quickViews.map((view) => [view.id, orders.filter((order) => matchesQuickView(order, view.id)).length])) as Record<
        QuickView,
        number
      >,
    [orders]
  );

  const filteredOrders = useMemo(() => {
    const result = orders.filter((order) => {
      const matchesSearch = includesSearch(order, search);
      const matchesStatus = status === "all" || order.status === status;
      const matchesSource = source === "all" || order.source === source;
      const matchesPriority = priority === "all" || order.priority === priority;
      const matchesPayment = payment === "all" || order.paymentStatus === payment;

      return matchesSearch && matchesQuickView(order, quickView) && matchesStatus && matchesSource && matchesPriority && matchesPayment;
    });

    return result.sort((a, b) => {
      if (sort === "priority") {
        return priorityRank[b.priority] - priorityRank[a.priority] || getOrderSortDate(b).localeCompare(getOrderSortDate(a));
      }

      if (sort === "amount") {
        return parseAmount(b.amount) - parseAmount(a.amount);
      }

      return getOrderSortDate(b).localeCompare(getOrderSortDate(a)) || b.id.localeCompare(a.id);
    });
  }, [orders, payment, priority, quickView, search, sort, source, status]);

  const hasActiveFilters = search || quickView !== "active" || status !== "all" || source !== "all" || priority !== "all" || payment !== "all" || sort !== "newest";
  const moreFilterCount = [status !== "all", source !== "all", priority !== "all", payment !== "all", sort !== "newest"].filter(Boolean).length;

  function resetFilters() {
    setSearch("");
    setQuickView("active");
    setStatus("all");
    setSource("all");
    setPriority("all");
    setPayment("all");
    setSort("newest");
    setFiltersOpen(false);
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none backdrop-blur-xl">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-lg">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Auftrag, Kunde oder Produkt suchen..."
                className="h-10 w-full rounded-lg border border-slate-800 bg-slate-950/80 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-300/10"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-9 items-center gap-1 rounded-full border border-slate-800 bg-slate-900 px-3 text-xs font-medium text-slate-300">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {filteredOrders.length} / {orders.length}
              </span>
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFiltersOpen((open) => !open)}
                  className="h-9 rounded-full border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
                >
                  Weitere Filter{moreFilterCount ? ` (${moreFilterCount})` : ""}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
                {filtersOpen ? (
                  <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-2xl shadow-black/40">
                    <div className="space-y-4">
                      <SelectField label="Status">
                        <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className={selectClass}>
                          <option value="all">Alle Status</option>
                          {statuses.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </SelectField>
                      <SelectField label="Quelle">
                        <select value={source} onChange={(event) => setSource(event.target.value as SourceFilter)} className={selectClass}>
                          <option value="all">Alle Quellen</option>
                          {sourceOptions.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </SelectField>
                      <SelectField label="Prioritaet">
                        <select value={priority} onChange={(event) => setPriority(event.target.value as PriorityFilter)} className={selectClass}>
                          <option value="all">Alle Prioritaeten</option>
                          {priorityOptions.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </SelectField>
                      <SelectField label="Zahlung">
                        <select value={payment} onChange={(event) => setPayment(event.target.value as PaymentFilter)} className={selectClass}>
                          <option value="all">Alle Zahlungen</option>
                          <option value="Paid">Bezahlt</option>
                          <option value="Open">Offen</option>
                        </select>
                      </SelectField>
                      <SelectField label="Sortierung">
                        <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className={selectClass}>
                          <option value="newest">Neueste zuerst</option>
                          <option value="priority">Prioritaet zuerst</option>
                          <option value="amount">Hoechster Betrag</option>
                        </select>
                      </SelectField>
                    </div>
                  </div>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={resetFilters}
                disabled={!hasActiveFilters}
                className="h-9 rounded-full border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {quickViews.map((view) => (
              <FilterButton key={view.id} active={quickView === view.id} count={quickCounts[view.id]} onClick={() => setQuickView(view.id)}>
                {view.label}
              </FilterButton>
            ))}
          </div>
        </CardContent>
      </Card>

      <section className="space-y-2">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order) => <OrderCard key={order.id} order={order} />)
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-8 text-center">
            <p className="text-sm font-medium text-white">Keine Auftraege gefunden.</p>
            <p className="mt-2 text-sm text-slate-500">Filter anpassen oder Ansicht zuruecksetzen.</p>
          </div>
        )}
      </section>
    </div>
  );
}
