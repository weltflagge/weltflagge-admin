"use client";

import Link from "next/link";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useId, useState } from "react";
import { ArrowLeft, PackagePlus, PlusCircle, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { priorityLabels, sourceLabels } from "@/src/lib/mock-orders";
import { getCatalogEntry, getCatalogMaterial, printModeLabels, productCatalog, type PrintMode, type ProductTypeId } from "@/src/lib/product-catalog";
import type { OrderPriority, OrderSource, PrintFileStatus } from "@/src/types/order";

type CreateOrderAction = (input: {
  orderNumber: string;
  source: OrderSource;
  externalId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  company: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  amount: string;
  paymentStatus: "Paid" | "Open";
  priority: OrderPriority;
  deadline: string;
  notes: string;
  items: ManualOrderItem[];
  itemName: string;
  sku: string;
  material: string;
  size: string;
  quantity: string;
  finishing: string;
  printFileName: string;
  printFileStatus: PrintFileStatus;
}) => Promise<{ ok: boolean; error?: string }>;

type ManualOrderItem = {
  id: string;
  itemName: string;
  sku: string;
  material: string;
  size: string;
  quantity: string;
  finishing: string;
  printFileName: string;
  printFileBackName: string;
  printFileStatus: PrintFileStatus;
  productType: ProductTypeId;
  materialId: string;
  printMode: PrintMode;
  shape: string;
};

const inputClass =
  "w-full rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-300/10";

function createBlankItem(): ManualOrderItem {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    itemName: "",
    sku: "",
    material: "",
    size: "",
    quantity: "1",
    finishing: "",
    printFileName: "",
    printFileBackName: "",
    printFileStatus: "missing",
    productType: "flag",
    materialId: "fahnenstoff-115",
    printMode: "single_sided",
    shape: "",
  };
}

function normalizeItemForCatalog(item: ManualOrderItem, patch: Partial<ManualOrderItem>) {
  const nextItem = { ...item, ...patch };
  const productTypeChanged = patch.productType !== undefined && patch.productType !== item.productType;
  const shapeChanged = patch.shape !== undefined && patch.shape !== item.shape;
  const entry = getCatalogEntry(nextItem.productType);
  const material = entry.materials.some((option) => option.id === nextItem.materialId)
    ? getCatalogMaterial(nextItem.productType, nextItem.materialId)
    : entry.materials[0];
  const printMode = material.allowedPrintModes.includes(nextItem.printMode) ? nextItem.printMode : material.allowedPrintModes[0];
  const shape = entry.shapes?.includes(nextItem.shape) ? nextItem.shape : entry.shapes?.[0] ?? "";
  const allowedSizes = entry.sizeMode === "preset" ? entry.sizes?.[shape] ?? [] : [];
  const size =
    entry.sizeMode === "preset"
      ? allowedSizes.includes(nextItem.size) && !shapeChanged
        ? nextItem.size
        : allowedSizes[0] ?? ""
      : productTypeChanged
        ? entry.defaultSize ?? ""
        : nextItem.size;

  return {
    ...nextItem,
    materialId: material.id,
    printMode,
    shape,
    size,
    printFileBackName: printMode === "double_sided" ? nextItem.printFileBackName : "",
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none backdrop-blur-xl">
      <CardContent className="space-y-5 p-5">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {children}
      </CardContent>
    </Card>
  );
}

export function NewOrderForm({ onCreateOrder }: { onCreateOrder: CreateOrderAction }) {
  const generatedOrderId = useId().replace(/\W/g, "").slice(-5).toUpperCase();
  const defaultOrderNumber = `WF-${generatedOrderId}`;
  const [orderNumber, setOrderNumber] = useState(defaultOrderNumber);
  const [source, setSource] = useState<OrderSource>("email");
  const [externalId, setExternalId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [company, setCompany] = useState("");
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Germany");
  const [amount, setAmount] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"Paid" | "Open">("Open");
  const [priority, setPriority] = useState<OrderPriority>("normal");
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ManualOrderItem[]>([createBlankItem()]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function updateItem(itemId: string, patch: Partial<ManualOrderItem>) {
    setItems((currentItems) => currentItems.map((item) => (item.id === itemId ? normalizeItemForCatalog(item, patch) : item)));
  }

  function addItem() {
    setItems((currentItems) => [...currentItems, createBlankItem()]);
  }

  function removeItem(itemId: string) {
    setItems((currentItems) => (currentItems.length === 1 ? currentItems : currentItems.filter((item) => item.id !== itemId)));
  }

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    try {
      const result = await onCreateOrder({
        orderNumber,
        source,
        externalId,
        customerName,
        customerEmail,
        customerPhone,
        company,
        street,
        postalCode,
        city,
        country,
        amount,
        paymentStatus,
        priority,
        deadline,
        notes,
        items,
        itemName: items[0]?.itemName ?? "",
        sku: items[0]?.sku ?? "",
        material: items[0]?.material ?? "",
        size: items[0]?.size ?? "",
        quantity: items[0]?.quantity ?? "1",
        finishing: items[0]?.finishing ?? "",
        printFileName: items[0]?.printFileName ?? "",
        printFileStatus: items[0]?.printFileStatus ?? "missing",
      });

      if (!result.ok) {
        setMessage(result.error ?? "Order could not be created.");
      }
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }

      setMessage("Order could not be created.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submitOrder} className="space-y-6">
      <div>
        <Button asChild variant="outline" className="rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800">
          <Link href="/orders">
            <ArrowLeft className="h-4 w-4" />
            Back to orders
          </Link>
        </Button>
      </div>

      <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-200">Manual order</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-5xl">Create order</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Add an email or phone order before WooCommerce and marketplace imports are connected.
          </p>
        </div>
        <Button type="submit" disabled={pending} className="rounded-xl bg-cyan-200 px-5 text-slate-950 hover:bg-cyan-100">
          <Save className="h-4 w-4" />
          {pending ? "Saving..." : "Create order"}
        </Button>
      </header>

      {message ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{message}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-5">
          <Section title="Order">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Order number">
                <input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} className={inputClass} />
              </Field>
              <Field label="Source">
                <select value={source} onChange={(event) => setSource(event.target.value as OrderSource)} className={inputClass}>
                  {Object.entries(sourceLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="External ID">
                <input value={externalId} onChange={(event) => setExternalId(event.target.value)} placeholder="mail-123, wc-123..." className={inputClass} />
              </Field>
            </div>
          </Section>

          <Section title="Customer">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Customer name">
                <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} className={inputClass} />
              </Field>
              <Field label="Email">
                <input type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} className={inputClass} />
              </Field>
              <Field label="Phone">
                <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} className={inputClass} />
              </Field>
              <Field label="Company">
                <input value={company} onChange={(event) => setCompany(event.target.value)} className={inputClass} />
              </Field>
              <Field label="Street">
                <input value={street} onChange={(event) => setStreet(event.target.value)} className={inputClass} />
              </Field>
              <Field label="Postal code">
                <input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} className={inputClass} />
              </Field>
              <Field label="City">
                <input value={city} onChange={(event) => setCity(event.target.value)} className={inputClass} />
              </Field>
              <Field label="Country">
                <input value={country} onChange={(event) => setCountry(event.target.value)} className={inputClass} />
              </Field>
            </div>
          </Section>

          <Section title="Products">
            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">Item {index + 1}</p>
                      <p className="mt-1 text-xs text-slate-500">Each item becomes its own production row.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeItem(item.id)}
                      disabled={items.length === 1}
                      className="rounded-xl border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Field label="Product name">
                      <input
                        value={item.itemName}
                        onChange={(event) => updateItem(item.id, { itemName: event.target.value })}
                        placeholder="Hissfahne, Banner, Beachflag..."
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Product type">
                      <select
                        value={item.productType}
                        onChange={(event) => updateItem(item.id, { productType: event.target.value as ProductTypeId })}
                        className={inputClass}
                      >
                        {productCatalog.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="SKU">
                      <input value={item.sku} onChange={(event) => updateItem(item.id, { sku: event.target.value })} className={inputClass} />
                    </Field>
                    <Field label="Quantity">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(event) => updateItem(item.id, { quantity: event.target.value })}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Material">
                      <select value={item.materialId} onChange={(event) => updateItem(item.id, { materialId: event.target.value })} className={inputClass}>
                        {getCatalogEntry(item.productType).materials.map((material) => (
                          <option key={material.id} value={material.id}>
                            {material.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {getCatalogEntry(item.productType).shapes ? (
                      <Field label="Shape">
                        <select value={item.shape} onChange={(event) => updateItem(item.id, { shape: event.target.value })} className={inputClass}>
                          {getCatalogEntry(item.productType).shapes?.map((shape) => (
                            <option key={shape} value={shape}>
                              {shape}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : null}
                    <Field label="Size">
                      {getCatalogEntry(item.productType).sizeMode === "preset" ? (
                        <select value={item.size} onChange={(event) => updateItem(item.id, { size: event.target.value })} className={inputClass}>
                          {(getCatalogEntry(item.productType).sizes?.[item.shape] ?? []).map((size) => (
                            <option key={size} value={size}>
                              {size}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={item.size}
                          onChange={(event) => updateItem(item.id, { size: event.target.value })}
                          placeholder="120 x 300 cm"
                          className={inputClass}
                        />
                      )}
                    </Field>
                    <Field label="Print mode">
                      <select value={item.printMode} onChange={(event) => updateItem(item.id, { printMode: event.target.value as PrintMode })} className={inputClass}>
                        {getCatalogMaterial(item.productType, item.materialId).allowedPrintModes.map((mode) => (
                          <option key={mode} value={mode}>
                            {printModeLabels[mode]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Finishing">
                      <input
                        value={item.finishing}
                        onChange={(event) => updateItem(item.id, { finishing: event.target.value })}
                        placeholder="Eyelets, sleeve, hooks..."
                        className={inputClass}
                      />
                    </Field>
                    <Field label={item.printMode === "double_sided" ? "Print file front" : "Print file name"}>
                      <input
                        value={item.printFileName}
                        onChange={(event) => updateItem(item.id, { printFileName: event.target.value })}
                        placeholder="WF-xxxxx_file.pdf"
                        className={inputClass}
                      />
                    </Field>
                    {item.printMode === "double_sided" ? (
                      <Field label="Print file back">
                        <input
                          value={item.printFileBackName}
                          onChange={(event) => updateItem(item.id, { printFileBackName: event.target.value })}
                          placeholder="WF-xxxxx_back.pdf"
                          className={inputClass}
                        />
                      </Field>
                    ) : null}
                    <Field label="Print file status">
                      <select
                        value={item.printFileStatus}
                        onChange={(event) => updateItem(item.id, { printFileStatus: event.target.value as PrintFileStatus })}
                        className={inputClass}
                      >
                        <option value="missing">missing</option>
                        <option value="received">received</option>
                        <option value="approved">approved</option>
                        <option value="problem">problem</option>
                      </select>
                    </Field>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Manufacturer: {getCatalogMaterial(item.productType, item.materialId).manufacturer}
                  </p>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={addItem}
                className="rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800"
              >
                <PlusCircle className="h-4 w-4" />
                Add item
              </Button>
            </div>
          </Section>
        </div>

        <aside className="space-y-5">
          <Section title="Workflow">
            <div className="space-y-4">
              <Field label="Amount">
                <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="149,90" className={inputClass} />
              </Field>
              <Field label="Payment status">
                <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as "Paid" | "Open")} className={inputClass}>
                  <option value="Open">Open</option>
                  <option value="Paid">Paid</option>
                </select>
              </Field>
              <Field label="Priority">
                <select value={priority} onChange={(event) => setPriority(event.target.value as OrderPriority)} className={inputClass}>
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Deadline">
                <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className={inputClass} />
              </Field>
            </div>
          </Section>

          <Section title="Items summary">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-slate-900/70 p-3 text-sm">
                <span className="text-slate-500">Items</span>
                <span className="font-medium text-white">{items.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-900/70 p-3 text-sm">
                <span className="text-slate-500">Total quantity</span>
                <span className="font-medium text-white">
                  {items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)}
                </span>
              </div>
            </div>
          </Section>

          <Section title="Notes">
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={6}
              placeholder="Internal notes..."
              className={inputClass}
            />
          </Section>

          <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none backdrop-blur-xl">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-cyan-200">
                  <PackagePlus className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">First version</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    This creates every listed product as a separate order item and production row.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={pending} className="w-full rounded-xl bg-cyan-200 text-slate-950 hover:bg-cyan-100">
            <PlusCircle className="h-4 w-4" />
            {pending ? "Saving..." : "Create manual order"}
          </Button>
        </aside>
      </div>
    </form>
  );
}
