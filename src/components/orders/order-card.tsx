import Link from "next/link";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sourceLabels } from "@/src/lib/mock-orders";
import type { Order, OrderPriority } from "@/src/types/order";
import { StatusChip } from "./status-chip";

type OrderCardProps = {
  order: Order;
};

function PriorityDot({ priority }: { priority: OrderPriority }) {
  const color = priority === "urgent" ? "bg-[#ff2d55]" : priority === "high" ? "bg-[#ffcc00]" : "bg-zinc-600";

  return <span className={`h-2.5 w-2.5 rounded-full ${color}`} />;
}

export function OrderCard({ order }: OrderCardProps) {
  const primaryItem = order.items[0];

  return (
    <article className="group rounded-xl border border-[#24262b] bg-[#18191b] p-4 transition hover:border-[#33363d] hover:bg-[#1d1f22]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityDot priority={order.priority} />
            <Link href={`/orders/${order.id}`} className="font-semibold text-white transition hover:text-[#0a84ff]">
              {order.id}
            </Link>
            <span className="text-xs text-zinc-500">{order.date}</span>
            <span className="rounded-full border border-[#24262b] bg-black px-2.5 py-1 text-xs text-zinc-300">{sourceLabels[order.source]}</span>
            <StatusChip status={order.status} />
          </div>
          <p className="mt-2 truncate text-sm font-medium text-zinc-200">{order.customer}</p>
          <p className="mt-1 truncate text-xs text-zinc-500">
            {primaryItem.name} - {primaryItem.size} - Qty {primaryItem.quantity}
          </p>
        </div>

        <div className="flex items-center gap-3 md:text-right">
          <div>
            <p className="font-semibold text-white">{order.amount}</p>
            <p className={order.paymentStatus === "Paid" ? "text-xs text-emerald-300" : "text-xs text-red-300"}>
              {order.paymentStatus}
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-xl border-[#24262b] bg-black text-white hover:bg-[#24262b]">
            <Link href={`/orders/${order.id}`} aria-label={`Open ${order.id}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-zinc-500 md:grid-cols-3">
        <div className="rounded-lg bg-black p-3">
          Druckdaten: <span className="text-zinc-300">{order.artworkStatus}</span>
        </div>
        <div className="rounded-lg bg-black p-3">
          Versand: <span className="text-zinc-300">{order.carrier}</span>
        </div>
        <div className="rounded-lg bg-black p-3">
          Deadline: <span className="text-zinc-300">{order.deadline}</span>
        </div>
      </div>

    </article>
  );
}
