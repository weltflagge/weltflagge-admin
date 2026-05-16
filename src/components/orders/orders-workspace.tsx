"use client";

import { useMemo, useState } from "react";
import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  mockOrders,
  priorityLabels,
  sourceLabels,
  statuses,
} from "@/src/lib/mock-orders";
import type { Order, OrderPriority, OrderSource, OrderStatus } from "@/src/types/order";
import { OrderCard } from "./order-card";

type StatusFilter = "all" | OrderStatus;
type SourceFilter = "all" | OrderSource;
type PriorityFilter = "all" | OrderPriority;
type PaymentFilter = "all" | Order["paymentStatus"];
type SortKey = "newest" | "deadline" | "priority" | "amount";

const sourceOptions = Object.entries(sourceLabels) as Array<[OrderSource, string]>;
const priorityOptions = Object.entries(priorityLabels) as Array<[OrderPriority, string]>;

const priorityRank: Record<OrderPriority, number> = {
  urgent: 3,
  high: 2,
  normal: 1,
};

function parseAmount(amount: string) {
  return Number(amount.replace(" EUR", "").replace(".", "").replace(",", "."));
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

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
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
      {children}
    </button>
  );
}

export function OrdersWorkspace() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [source, setSource] = useState<SourceFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [payment, setPayment] = useState<PaymentFilter>("all");
  const [needsActionOnly, setNeedsActionOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("newest");

  const filteredOrders = useMemo(() => {
    const result = mockOrders.filter((order) => {
      const matchesSearch = includesSearch(order, search);
      const matchesStatus = status === "all" || order.status === status;
      const matchesSource = source === "all" || order.source === source;
      const matchesPriority = priority === "all" || order.priority === priority;
      const matchesPayment = payment === "all" || order.paymentStatus === payment;
      const needsAction =
        order.priority === "urgent" ||
        order.paymentStatus === "Open" ||
        order.status === "Customer reply needed" ||
        order.status === "Approval missing" ||
        order.status === "Print files missing";

      return (
        matchesSearch &&
        matchesStatus &&
        matchesSource &&
        matchesPriority &&
        matchesPayment &&
        (!needsActionOnly || needsAction)
      );
    });

    return result.sort((a, b) => {
      if (sort === "deadline") {
        return a.deadline.localeCompare(b.deadline);
      }

      if (sort === "priority") {
        return priorityRank[b.priority] - priorityRank[a.priority] || a.deadline.localeCompare(b.deadline);
      }

      if (sort === "amount") {
        return parseAmount(b.amount) - parseAmount(a.amount);
      }

      return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
    });
  }, [needsActionOnly, payment, priority, search, sort, source, status]);

  const hasActiveFilters =
    search ||
    status !== "all" ||
    source !== "all" ||
    priority !== "all" ||
    payment !== "all" ||
    needsActionOnly ||
    sort !== "newest";

  function resetFilters() {
    setSearch("");
    setStatus("all");
    setSource("all");
    setPriority("all");
    setPayment("all");
    setNeedsActionOnly(false);
    setSort("newest");
  }

  return (
    <div className="space-y-5">
      <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none backdrop-blur-xl">
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-xl">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search order, customer, product, source or status..."
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-300/10"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {filteredOrders.length} / {mockOrders.length}
              </span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="h-9 rounded-full border border-slate-800 bg-slate-900 px-3 text-xs font-medium text-slate-300 outline-none focus:border-cyan-300/40"
                aria-label="Sort orders"
              >
                <option value="newest">Newest first</option>
                <option value="deadline">Deadline first</option>
                <option value="priority">Priority first</option>
                <option value="amount">Highest amount</option>
              </select>
              <Button
                type="button"
                variant="outline"
                onClick={resetFilters}
                disabled={!hasActiveFilters}
                className="rounded-full border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <FilterButton active={status === "all"} onClick={() => setStatus("all")}>
                All statuses
              </FilterButton>
              {statuses.map((item) => (
                <FilterButton key={item} active={status === item} onClick={() => setStatus(item)}>
                  {item}
                </FilterButton>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-3">
              <FilterButton active={source === "all"} onClick={() => setSource("all")}>
                All sources
              </FilterButton>
              {sourceOptions.map(([value, label]) => (
                <FilterButton key={value} active={source === value} onClick={() => setSource(value)}>
                  {label}
                </FilterButton>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-3">
              <FilterButton active={priority === "all"} onClick={() => setPriority("all")}>
                All priorities
              </FilterButton>
              {priorityOptions.map(([value, label]) => (
                <FilterButton key={value} active={priority === value} onClick={() => setPriority(value)}>
                  {label}
                </FilterButton>
              ))}
              <FilterButton active={payment === "Open"} onClick={() => setPayment(payment === "Open" ? "all" : "Open")}>
                Payment open
              </FilterButton>
              <FilterButton active={needsActionOnly} onClick={() => setNeedsActionOnly(!needsActionOnly)}>
                Needs action
              </FilterButton>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order) => <OrderCard key={order.id} order={order} />)
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-8 text-center">
            <p className="text-sm font-medium text-white">No orders match these filters.</p>
            <p className="mt-2 text-sm text-slate-500">Adjust the filters or reset the view.</p>
          </div>
        )}
      </section>
    </div>
  );
}
