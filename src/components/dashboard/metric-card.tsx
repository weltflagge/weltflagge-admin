import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type MetricCardProps = {
  title: string;
  value: string | number;
  subtitle: string;
  icon: LucideIcon;
};

export function MetricCard({ title, value, subtitle, icon: Icon }: MetricCardProps) {
  return (
    <Card className="rounded-xl border-[#24262b] bg-[#18191b] shadow-none">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-400">{title}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-white">{value}</p>
            <p className="mt-2 text-sm text-zinc-500">{subtitle}</p>
          </div>
          <div className="rounded-xl border border-[#24262b] bg-black p-3 text-[#0a84ff]">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
