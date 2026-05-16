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
    <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none backdrop-blur-xl">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">{title}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-white">{value}</p>
            <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-cyan-200">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
