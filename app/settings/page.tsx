import { Settings } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-[#8095ff]">Settings</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">System settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Placeholder for connector credentials, user roles, workflow rules and deployment settings.
        </p>
      </header>

      <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none backdrop-blur-xl">
        <CardContent className="p-8">
          <div className="flex items-start gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-cyan-200">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Integration setup comes later</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                WooCommerce, eBay and E-Mail credentials should be added after the order model and operator workflow are
                locked down.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
