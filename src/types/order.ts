import type { LucideIcon } from "lucide-react";

export type OrderSource = "woocommerce-weltflagge" | "woocommerce-partner" | "ebay" | "email";

export type OrderStatus =
  | "New"
  | "Payment open"
  | "Print files missing"
  | "Print files review"
  | "Customer reply needed"
  | "Approval missing"
  | "Production ready"
  | "In production"
  | "Ready to ship"
  | "Shipped"
  | "Completed";

export type OrderPriority = "normal" | "high" | "urgent";

export type PrintFileStatus = "missing" | "received" | "approved" | "problem";

export type PrintFile = {
  status: PrintFileStatus;
  fileName: string;
  fileUrl?: string;
  side?: "front" | "back" | "general";
};

export type OrderItemProductionStatus = "not_routed" | "draft" | "sent" | "confirmed" | "produced";

export type OrderItemProduction = {
  manufacturer?: "opinion" | "logo_pl" | "mph_maciej" | "wmd";
  batchId?: string;
  status: OrderItemProductionStatus;
};

export type OrderItem = {
  id?: string;
  name: string;
  sku: string;
  size: string;
  quantity: number;
  printFile: PrintFile;
  printFiles?: PrintFile[];
  production: OrderItemProduction;
};

export type OrderAddress = {
  company: string;
  name: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
};

export type ActivityLogEntry = {
  id: string;
  timestamp: string;
  actor: string;
  message: string;
};

export type Order = {
  id: string;
  source: OrderSource;
  externalId: string;
  date: string;
  customer: string;
  email: string;
  phone: string;
  billingAddress: OrderAddress;
  shippingAddress: OrderAddress;
  items: OrderItem[];
  amount: string;
  paymentStatus: "Paid" | "Open";
  artworkStatus: string;
  status: OrderStatus;
  carrier: string;
  trackingNumber: string;
  priority: OrderPriority;
  deadline: string;
  notes: string;
  timeline: ActivityLogEntry[];
};

export type StatusConfig = {
  icon: LucideIcon;
  chip: string;
  accent: string;
};
