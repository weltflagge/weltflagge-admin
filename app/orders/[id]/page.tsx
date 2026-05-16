import { notFound } from "next/navigation";
import { OrderDetailWorkspace } from "@/src/components/orders/order-detail-workspace";
import { getOrderByNumberFromDb } from "@/src/lib/orders-db";
import { getOrderById } from "@/src/lib/mock-orders";
import { updateOrderEditableFields, updateOrderItemPrintFile, updateOrderTracking, updateOrderWorkflowStatus } from "./actions";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = (await getOrderByNumberFromDb(id)) ?? getOrderById(id);

  if (!order) {
    notFound();
  }

  return (
    <OrderDetailWorkspace
      order={order}
      onPrintFileUpdate={updateOrderItemPrintFile}
      onStatusUpdate={updateOrderWorkflowStatus}
      onTrackingUpdate={updateOrderTracking}
      onOrderEdit={updateOrderEditableFields}
    />
  );
}
