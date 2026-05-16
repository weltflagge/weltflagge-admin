import { statusConfig } from "@/src/lib/mock-orders";
import type { OrderStatus } from "@/src/types/order";

type StatusChipProps = {
  status: OrderStatus;
};

export function StatusChip({ status }: StatusChipProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${config.chip}`}>
      <Icon className="h-3.5 w-3.5" />
      {status}
    </span>
  );
}
