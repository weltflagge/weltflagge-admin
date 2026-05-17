import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getCompactSourceLabel, getOrderItemSummary, getOrderNextAction, getShortProductSummary } from "@/src/lib/order-overview";
import type { Order, OrderPriority } from "@/src/types/order";

type OrderCardProps = {
  order: Order;
};

const actionToneClass = {
  danger: "border-red-500/25 bg-red-500/10 text-red-200",
  warning: "border-amber-500/25 bg-amber-500/10 text-amber-200",
  ready: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
  info: "border-cyan-500/25 bg-cyan-500/10 text-cyan-200",
  done: "border-slate-700 bg-slate-950 text-slate-400",
  neutral: "border-slate-700 bg-slate-900 text-slate-300",
};

function PriorityDot({ priority }: { priority: OrderPriority }) {
  const color = priority === "urgent" ? "bg-red-400" : priority === "high" ? "bg-amber-300" : "bg-slate-600";
  return <span className={`h-2 w-2 rounded-full ${color}`} />;
}

export function OrderCard({ order }: OrderCardProps) {
  const nextAction = getOrderNextAction(order);

  return (
    <Link
      href={`/orders/${order.id}`}
      className="group grid grid-cols-1 gap-3 rounded-lg border border-slate-800 bg-slate-950/70 px-4 py-3 transition hover:border-cyan-300/35 hover:bg-slate-900/80 lg:grid-cols-[minmax(11rem,0.9fr)_minmax(12rem,1fr)_minmax(16rem,1.4fr)_9rem_8rem_12rem] lg:items-center"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <PriorityDot priority={order.priority} />
          <span className="truncate text-sm font-semibold text-white">{order.id}</span>
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-600 transition group-hover:text-cyan-200" />
        </div>
        <p className="mt-1 truncate text-xs text-slate-500">{order.date}</p>
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-200">{order.customer}</p>
        <span className="mt-1 inline-flex rounded-full border border-slate-800 bg-slate-900 px-2 py-0.5 text-xs text-slate-400">
          {getCompactSourceLabel(order.source)}
        </span>
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm text-slate-200">{getShortProductSummary(order)}</p>
        <p className="mt-1 truncate text-xs text-slate-500">{getOrderItemSummary(order)}</p>
      </div>

      <div className="text-sm font-semibold text-white lg:text-right">{order.amount}</div>

      <div className={order.paymentStatus === "Paid" ? "text-sm font-medium text-emerald-300" : "text-sm font-medium text-red-300"}>
        {order.paymentStatus === "Paid" ? "Bezahlt" : "Offen"}
      </div>

      <div className="lg:text-right">
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${actionToneClass[nextAction.tone]}`}>
          {nextAction.label}
        </span>
      </div>
    </Link>
  );
}
