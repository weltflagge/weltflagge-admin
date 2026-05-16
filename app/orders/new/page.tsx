import { NewOrderForm } from "@/src/components/orders/new-order-form";
import { createManualOrder } from "./actions";

export default function NewOrderPage() {
  return <NewOrderForm onCreateOrder={createManualOrder} />;
}
