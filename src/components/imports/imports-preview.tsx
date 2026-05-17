import { AlertTriangle, CheckCircle2, FileText, PackageSearch } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { normalizedMockImports } from "@/src/lib/order-imports";
import { sourceLabels } from "@/src/lib/mock-orders";
import { printModeLabels } from "@/src/lib/product-catalog";
import { manufacturerLabels } from "@/src/lib/mock-production";

function confidenceClass(confidence: "high" | "needs_review") {
  return confidence === "high"
    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
    : "border-amber-500/25 bg-amber-500/10 text-amber-200";
}

function manufacturerClass(manufacturer: string) {
  if (manufacturer === "needs_review") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-200";
  }

  return "border-cyan-300/20 bg-cyan-300/10 text-cyan-100";
}

export function ImportsPreview() {
  const totalItems = normalizedMockImports.reduce((sum, order) => sum + order.items.length, 0);
  const readyItems = normalizedMockImports.reduce((sum, order) => sum + order.readyItems, 0);
  const reviewItems = normalizedMockImports.reduce((sum, order) => sum + order.reviewItems, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-200">Import preview</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-5xl">Incoming orders</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Mock WooCommerce and eBay payloads normalized into the internal order catalog before saving.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-5 py-4 text-sm text-slate-300">
          Save/import action is intentionally disabled in this mock step.
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-slate-500">Mock items</p>
              <p className="mt-2 text-3xl font-semibold text-white">{totalItems}</p>
            </div>
            <PackageSearch className="h-6 w-6 text-cyan-200" />
          </CardContent>
        </Card>
        <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-slate-500">Ready items</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-200">{readyItems}</p>
            </div>
            <CheckCircle2 className="h-6 w-6 text-emerald-200" />
          </CardContent>
        </Card>
        <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-slate-500">Needs review</p>
              <p className="mt-2 text-3xl font-semibold text-amber-200">{reviewItems}</p>
            </div>
            <AlertTriangle className="h-6 w-6 text-amber-200" />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-5">
        {normalizedMockImports.map((order) => (
          <Card key={order.id} className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none">
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 border-b border-slate-800 pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300">
                      {sourceLabels[order.source]}
                    </span>
                    <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300">
                      {order.receivedAt.slice(0, 16).replace("T", " ")}
                    </span>
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold text-white">{order.orderNumber}</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    {order.customerName} - {order.customerEmail}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-right">
                  <p className="text-sm text-cyan-100">{order.amount}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {order.readyItems}/{order.items.length} ready, {order.reviewItems} review
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {order.items.map((item) => (
                  <div key={item.externalLineId} className="rounded-xl border border-slate-800 bg-slate-900/45 p-4">
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr_0.8fr]">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${confidenceClass(item.confidence)}`}>
                            {item.confidence === "high" ? "Mapped" : "Needs review"}
                          </span>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${manufacturerClass(item.manufacturer)}`}>
                            {manufacturerLabels[item.manufacturer]}
                          </span>
                        </div>
                        <p className="mt-3 font-medium text-white">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.sku} - Qty {item.quantity}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-lg bg-slate-950/70 p-3">
                          <p className="text-xs text-slate-500">Product</p>
                          <p className="mt-1 text-slate-200">{item.productLabel}</p>
                        </div>
                        <div className="rounded-lg bg-slate-950/70 p-3">
                          <p className="text-xs text-slate-500">Material</p>
                          <p className="mt-1 text-slate-200">{item.materialLabel}</p>
                        </div>
                        <div className="rounded-lg bg-slate-950/70 p-3">
                          <p className="text-xs text-slate-500">Size / shape</p>
                          <p className="mt-1 text-slate-200">
                            {item.size || "-"} {item.shape ? `- ${item.shape}` : ""}
                          </p>
                        </div>
                        <div className="rounded-lg bg-slate-950/70 p-3">
                          <p className="text-xs text-slate-500">Print mode</p>
                          <p className="mt-1 text-slate-200">{printModeLabels[item.printMode]}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Druckdaten</p>
                        {item.printFiles.map((file) => (
                          <div key={`${item.externalLineId}-${file.side}`} className="flex items-center justify-between gap-3 rounded-lg bg-slate-950/70 p-3 text-sm">
                            <span className="flex items-center gap-2 text-slate-400">
                              <FileText className="h-4 w-4 text-slate-500" />
                              {file.side}
                            </span>
                            <span className={file.fileName ? "text-slate-200" : "text-amber-200"}>{file.fileName || "missing"}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {item.warnings.length ? (
                      <div className="mt-4 rounded-xl border border-amber-500/15 bg-amber-500/10 p-3 text-sm text-amber-100">
                        {item.warnings.join(" ")}
                      </div>
                    ) : (
                      <p className="mt-4 text-xs text-slate-500">{item.routingReason}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
