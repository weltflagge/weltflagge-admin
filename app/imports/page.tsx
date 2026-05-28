import { ImportsPreview } from "@/src/components/imports/imports-preview";
import { getImportDashboard } from "@/src/lib/import-sync";
import { getStoredOrderImports, normalizedMockImports } from "@/src/lib/order-imports";
import { approveImportedOrder, reopenImportedOrder, skipImportedOrder, syncImportedOrdersSource, syncWeltflaggeWooOrders } from "./actions";

export default async function ImportsPage() {
  const storedImports = await getStoredOrderImports().catch((error) => {
    console.error("Failed to load order imports.", error);
    return null;
  });
  const initialImports =
    storedImports ??
    normalizedMockImports.map((order, index) => ({
      ...order,
      importDbId: `mock-${index}`,
      importStatus: order.reviewItems ? ("needs_review" as const) : ("pending" as const),
      importWarnings: order.items.flatMap((item) => item.warnings),
      lastSyncedAt: new Date().toISOString(),
    }));
  const dashboard = await getImportDashboard();

  return (
    <ImportsPreview
      initialImports={initialImports}
      dashboard={dashboard}
      onSyncWoo={syncWeltflaggeWooOrders}
      onSyncSource={syncImportedOrdersSource}
      onApproveOrder={approveImportedOrder}
      onSkipOrder={skipImportedOrder}
      onReopenOrder={reopenImportedOrder}
    />
  );
}
