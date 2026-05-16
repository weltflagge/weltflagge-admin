"use client";

import Link from "next/link";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useMemo, useState } from "react";
import { ArrowLeft, PackagePlus, PlusCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { priorityLabels, sourceLabels } from "@/src/lib/mock-orders";
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
  itemName: string;
  sku: string;
  material: string;
  size: string;
  quantity: string;
  finishing: string;
  printFileName: string;
  printFileStatus: PrintFileStatus;
}) => Promise<{ ok: boolean; error?: string }>;

const inputClass =
  "w-full rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-300/10";

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
  const defaultOrderNumber = useMemo(() => `WF-${Date.now().toString().slice(-5)}`, []);
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
  const [itemName, setItemName] = useState("");
  const [sku, setSku] = useState("");
  const [material, setMaterial] = useState("");
  const [size, setSize] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [finishing, setFinishing] = useState("");
  const [printFileName, setPrintFileName] = useState("");
  const [printFileStatus, setPrintFileStatus] = useState<PrintFileStatus>("missing");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
        itemName,
        sku,
        material,
        size,
        quantity,
        finishing,
        printFileName,
        printFileStatus,
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

          <Section title="Product">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Product name">
                <input value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder="Hissfahne, Banner, Beachflag..." className={inputClass} />
              </Field>
              <Field label="SKU">
                <input value={sku} onChange={(event) => setSku(event.target.value)} className={inputClass} />
              </Field>
              <Field label="Quantity">
                <input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className={inputClass} />
              </Field>
              <Field label="Material">
                <input value={material} onChange={(event) => setMaterial(event.target.value)} placeholder="Normal Stoff, Mesh, 155g..." className={inputClass} />
              </Field>
              <Field label="Size">
                <input value={size} onChange={(event) => setSize(event.target.value)} placeholder="120 x 300 cm" className={inputClass} />
              </Field>
              <Field label="Finishing">
                <input value={finishing} onChange={(event) => setFinishing(event.target.value)} placeholder="Eyelets, sleeve, hooks..." className={inputClass} />
              </Field>
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

          <Section title="Druckdaten">
            <div className="space-y-4">
              <Field label="Print file name">
                <input value={printFileName} onChange={(event) => setPrintFileName(event.target.value)} placeholder="WF-xxxxx_file.pdf" className={inputClass} />
              </Field>
              <Field label="Print file status">
                <select value={printFileStatus} onChange={(event) => setPrintFileStatus(event.target.value as PrintFileStatus)} className={inputClass}>
                  <option value="missing">missing</option>
                  <option value="received">received</option>
                  <option value="approved">approved</option>
                  <option value="problem">problem</option>
                </select>
              </Field>
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
                    This creates one order item. Multi-item manual orders can build on the same database contract next.
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
