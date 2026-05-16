import type { OrderItemProductionStatus, PrintFile } from "@/src/types/order";

export type ManufacturerId = "opinion" | "logo_pl" | "mph_maciej" | "wmd" | "needs_review";

export type Manufacturer = {
  id: Exclude<ManufacturerId, "needs_review">;
  name: string;
  contact: string;
  specialty: string;
  exportFormat: string;
};

export type ProductionRow = {
  id: string;
  manufacturer: ManufacturerId;
  orderId: string;
  customer: string;
  productName: string;
  sku: string;
  material: string;
  size: string;
  quantity: number;
  finishing: string;
  printFile: PrintFile;
  printFiles?: PrintFile[];
  productionStatus: OrderItemProductionStatus;
  batchId?: string;
  deadline: string;
  notes: string;
  routingReason: string;
};

export type ProductionBatchStatus = "Draft" | "Sent to manufacturer" | "Confirmed" | "In production" | "Delivered";

export type ProductionBatch = {
  id: string;
  manufacturer: Exclude<ManufacturerId, "needs_review">;
  date: string;
  status: ProductionBatchStatus;
  rows: ProductionRow[];
};

export type ProductionExportColumn = {
  key: string;
  label: string;
  getValue: (row: ProductionRow, index: number) => string | number;
};

export type ProductionExportValidationIssue = {
  rowId: string;
  severity: "blocker" | "warning";
  reason: string;
};

export type ProductionExportValidation = {
  readyRows: number;
  blockedRows: number;
  issues: ProductionExportValidationIssue[];
};
