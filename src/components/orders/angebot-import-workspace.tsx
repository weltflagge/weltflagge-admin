"use client";

import Link from "next/link";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useMemo, useState } from "react";
import { ArrowLeft, FileText, PlusCircle, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AngebotDraft, AngebotDraftItem } from "@/src/lib/angebot-parser";
import type { OrderItemType } from "@/src/types/order";

type ParseAction = (formData: FormData) => Promise<{ ok: boolean; error?: string; draft?: AngebotDraft }>;
type CreateAction = (input: AngebotDraft) => Promise<{ ok: boolean; error?: string }>;

const inputClass =
  "w-full rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-300/10";
const uncertainClass = "border-amber-400/40 bg-amber-400/10";

const itemTypeLabels: Record<OrderItemType, string> = {
  production_item: "Produktionsartikel",
  accessory_item: "Zubehoer",
  service_item: "Service",
  shipping_item: "Versand",
};

function parseGermanAmount(value: string) {
  const amount = Number(value.replace(/\s/g, "").replace(".", "").replace(",", "."));
  return Number.isFinite(amount) ? amount : 0;
}

function formatGermanAmount(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function calculateTotalPrice(quantity: string, unitPrice: string) {
  const parsedQuantity = Number(quantity.replace(",", "."));
  const parsedUnitPrice = parseGermanAmount(unitPrice);

  if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0 || parsedUnitPrice <= 0) {
    return "";
  }

  return formatGermanAmount(parsedQuantity * parsedUnitPrice);
}

function fieldClass(isUncertain: boolean) {
  return `${inputClass} ${isUncertain ? uncertainClass : ""}`;
}

function Field({
  label,
  uncertain,
  children,
}: {
  label: string;
  uncertain?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className={uncertain ? "text-sm text-amber-200" : "text-sm text-slate-400"}>{label}</span>
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

function createEmptyItem(index: number): AngebotDraftItem {
  return {
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    lineNumber: index + 1,
    itemType: "production_item",
    productName: "",
    sku: "",
    quantity: "1",
    size: "",
    material: "",
    finishing: "",
    unitPrice: "",
    totalPrice: "",
    notes: "",
    verifiedQuantity: false,
    verifiedSize: false,
    verifiedFinishing: false,
    uncertainFields: ["productName"],
  };
}

export function AngebotImportWorkspace({
  onParsePdf,
  onCreateOrder,
}: {
  onParsePdf: ParseAction;
  onCreateOrder: CreateAction;
}) {
  const [draft, setDraft] = useState<AngebotDraft | null>(null);
  const [parseMessage, setParseMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  const itemCounts = useMemo(() => {
    const counts: Record<OrderItemType, number> = {
      production_item: 0,
      accessory_item: 0,
      service_item: 0,
      shipping_item: 0,
    };

    for (const item of draft?.items ?? []) {
      counts[item.itemType] += 1;
    }

    return counts;
  }, [draft]);

  async function parsePdf(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setParsing(true);
    setParseMessage(null);

    try {
      const result = await onParsePdf(new FormData(event.currentTarget));

      if (result.ok && result.draft) {
        setDraft(result.draft);
        setParseMessage("PDF gelesen. Bitte Daten pruefen und ergaenzen.");
        return;
      }

      setParseMessage(result.error ?? "PDF konnte nicht gelesen werden.");
    } finally {
      setParsing(false);
    }
  }

  function updateDraft(patch: Partial<AngebotDraft>) {
    setDraft((currentDraft) => (currentDraft ? { ...currentDraft, ...patch } : currentDraft));
  }

  function updateItem(itemId: string, patch: Partial<AngebotDraftItem>) {
    setDraft((currentDraft) =>
      currentDraft
        ? {
            ...currentDraft,
            items: currentDraft.items.map((item) => {
              if (item.id !== itemId) {
                return item;
              }

              const nextItem = { ...item, ...patch };

              if ((patch.quantity !== undefined || patch.unitPrice !== undefined) && patch.totalPrice === undefined) {
                nextItem.totalPrice = calculateTotalPrice(nextItem.quantity, nextItem.unitPrice);
              }

              if (patch.itemType === "production_item" && item.itemType !== "production_item") {
                nextItem.verifiedQuantity = false;
                nextItem.verifiedSize = false;
                nextItem.verifiedFinishing = false;
              }

              return nextItem;
            }),
          }
        : currentDraft
    );
  }

  function addItem() {
    setDraft((currentDraft) =>
      currentDraft
        ? {
            ...currentDraft,
            items: [...currentDraft.items, createEmptyItem(currentDraft.items.length)],
          }
        : currentDraft
    );
  }

  function removeItem(itemId: string) {
    setDraft((currentDraft) =>
      currentDraft
        ? {
            ...currentDraft,
            items: currentDraft.items.filter((item) => item.id !== itemId),
          }
        : currentDraft
    );
  }

  async function createOrder() {
    if (!draft) {
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      const result = await onCreateOrder(draft);

      if (!result.ok) {
        setSaveMessage(result.error ?? "Bestellung konnte nicht erstellt werden.");
      }
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }

      setSaveMessage("Bestellung konnte nicht erstellt werden.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="outline" className="rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800">
        <Link href="/orders">
          <ArrowLeft className="h-4 w-4" />
          Zurueck zu Auftraegen
        </Link>
      </Button>

      <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-200">Angebot PDF</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-5xl">Angebot importieren</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            PDF hochladen, Daten pruefen, Positionen klassifizieren und danach eine lokale Bestellung erstellen.
          </p>
        </div>
        <Button type="button" onClick={createOrder} disabled={!draft || saving} className="rounded-xl bg-cyan-200 px-5 text-slate-950 hover:bg-cyan-100">
          <PlusCircle className="h-4 w-4" />
          {saving ? "Speichern..." : "Bestellung erstellen"}
        </Button>
      </header>

      <Section title="PDF hochladen">
        <form onSubmit={parsePdf} className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <Field label="Angebot PDF">
            <input name="pdf" type="file" accept="application/pdf,.pdf" className={inputClass} />
          </Field>
          <Button type="submit" disabled={parsing} className="rounded-xl bg-cyan-200 px-5 text-slate-950 hover:bg-cyan-100">
            <UploadCloud className="h-4 w-4" />
            {parsing ? "Lese PDF..." : "PDF auslesen"}
          </Button>
        </form>
        {parseMessage ? (
          <p className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">{parseMessage}</p>
        ) : null}
      </Section>

      {draft ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_24rem]">
          <div className="space-y-5">
            <Section title="Auftrag">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="Bestellnummer" uncertain={draft.uncertainFields.includes("offerNumber")}>
                  <input value={draft.orderNumber} onChange={(event) => updateDraft({ orderNumber: event.target.value })} className={fieldClass(draft.uncertainFields.includes("offerNumber"))} />
                </Field>
                <Field label="Angebotsnummer">
                  <input value={draft.offerNumber} onChange={(event) => updateDraft({ offerNumber: event.target.value })} className={inputClass} />
                </Field>
                <Field label="Angebotsdatum">
                  <input type="date" value={draft.offerDate} onChange={(event) => updateDraft({ offerDate: event.target.value })} className={inputClass} />
                </Field>
                <Field label="Betrag">
                  <input value={draft.amount} onChange={(event) => updateDraft({ amount: event.target.value })} placeholder="0,00" className={inputClass} />
                </Field>
                <Field label="PDF">
                  <input value={draft.sourceFileName} onChange={(event) => updateDraft({ sourceFileName: event.target.value })} className={inputClass} />
                </Field>
              </div>
            </Section>

            <Section title="Kunde und Adressen">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="Kunde" uncertain={draft.uncertainFields.includes("customerName")}>
                  <input value={draft.customerName} onChange={(event) => updateDraft({ customerName: event.target.value })} className={fieldClass(draft.uncertainFields.includes("customerName"))} />
                </Field>
                <Field label="E-Mail" uncertain={draft.uncertainFields.includes("customerEmail")}>
                  <input value={draft.customerEmail} onChange={(event) => updateDraft({ customerEmail: event.target.value })} className={fieldClass(draft.uncertainFields.includes("customerEmail"))} />
                </Field>
                <Field label="Telefon">
                  <input value={draft.customerPhone} onChange={(event) => updateDraft({ customerPhone: event.target.value })} className={inputClass} />
                </Field>
                <Field label="Rechnung Firma">
                  <input value={draft.billingCompany} onChange={(event) => updateDraft({ billingCompany: event.target.value })} className={inputClass} />
                </Field>
                <Field label="Rechnung Name">
                  <input value={draft.billingName} onChange={(event) => updateDraft({ billingName: event.target.value })} className={inputClass} />
                </Field>
                <Field label="Strasse">
                  <input value={draft.billingStreet} onChange={(event) => updateDraft({ billingStreet: event.target.value })} className={inputClass} />
                </Field>
                <Field label="PLZ">
                  <input value={draft.billingPostalCode} onChange={(event) => updateDraft({ billingPostalCode: event.target.value })} className={inputClass} />
                </Field>
                <Field label="Stadt">
                  <input value={draft.billingCity} onChange={(event) => updateDraft({ billingCity: event.target.value })} className={inputClass} />
                </Field>
                <Field label="Land">
                  <input value={draft.billingCountry} onChange={(event) => updateDraft({ billingCountry: event.target.value })} className={inputClass} />
                </Field>
                <Field label="Lieferung Firma">
                  <input value={draft.shippingCompany} onChange={(event) => updateDraft({ shippingCompany: event.target.value })} placeholder="Leer = Rechnungsadresse" className={inputClass} />
                </Field>
                <Field label="Lieferung Name">
                  <input value={draft.shippingName} onChange={(event) => updateDraft({ shippingName: event.target.value })} placeholder="Leer = Rechnungsadresse" className={inputClass} />
                </Field>
                <Field label="Lieferung Strasse">
                  <input value={draft.shippingStreet} onChange={(event) => updateDraft({ shippingStreet: event.target.value })} placeholder="Leer = Rechnungsadresse" className={inputClass} />
                </Field>
                <Field label="Lieferung PLZ">
                  <input value={draft.shippingPostalCode} onChange={(event) => updateDraft({ shippingPostalCode: event.target.value })} placeholder="Leer = Rechnungsadresse" className={inputClass} />
                </Field>
                <Field label="Lieferung Stadt">
                  <input value={draft.shippingCity} onChange={(event) => updateDraft({ shippingCity: event.target.value })} placeholder="Leer = Rechnungsadresse" className={inputClass} />
                </Field>
                <Field label="Lieferung Land">
                  <input value={draft.shippingCountry} onChange={(event) => updateDraft({ shippingCountry: event.target.value })} placeholder="Leer = Rechnungsadresse" className={inputClass} />
                </Field>
              </div>
            </Section>

            <Section title="Positionen pruefen">
              <div className="space-y-4">
                {draft.items.map((item, index) => (
                  <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">Position {index + 1}</p>
                        <p className="mt-1 text-xs text-slate-500">{itemTypeLabels[item.itemType]}</p>
                      </div>
                      <Button type="button" variant="outline" onClick={() => removeItem(item.id)} className="rounded-xl border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800">
                        Entfernen
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                      <Field label="Typ">
                        <select value={item.itemType} onChange={(event) => updateItem(item.id, { itemType: event.target.value as OrderItemType })} className={inputClass}>
                          {Object.entries(itemTypeLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Produkt" uncertain={item.uncertainFields.includes("productName")}>
                        <input value={item.productName} onChange={(event) => updateItem(item.id, { productName: event.target.value })} className={fieldClass(item.uncertainFields.includes("productName"))} />
                      </Field>
                      <Field label="Stueck" uncertain={item.uncertainFields.includes("quantity")}>
                        <input value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: event.target.value })} className={fieldClass(item.uncertainFields.includes("quantity"))} />
                      </Field>
                      <Field label="SKU">
                        <input value={item.sku} onChange={(event) => updateItem(item.id, { sku: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Groesse" uncertain={item.uncertainFields.includes("size")}>
                        <input value={item.size} onChange={(event) => updateItem(item.id, { size: event.target.value })} className={fieldClass(item.uncertainFields.includes("size"))} />
                      </Field>
                      <Field label="Material" uncertain={item.uncertainFields.includes("material")}>
                        <input value={item.material} onChange={(event) => updateItem(item.id, { material: event.target.value })} className={fieldClass(item.uncertainFields.includes("material"))} />
                      </Field>
                      <Field label="Konfektion">
                        <input value={item.finishing} onChange={(event) => updateItem(item.id, { finishing: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Einzelpreis">
                        <input value={item.unitPrice} onChange={(event) => updateItem(item.id, { unitPrice: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Gesamt">
                        <input value={item.totalPrice} onChange={(event) => updateItem(item.id, { totalPrice: event.target.value })} className={inputClass} />
                      </Field>
                      <Field label="Notiz">
                        <input value={item.notes} onChange={(event) => updateItem(item.id, { notes: event.target.value })} className={inputClass} />
                      </Field>
                    </div>
                    {item.itemType === "production_item" ? (
                      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-800 pt-4 md:grid-cols-3">
                        <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300">
                          <input
                            type="checkbox"
                            checked={item.verifiedQuantity}
                            onChange={(event) => updateItem(item.id, { verifiedQuantity: event.target.checked })}
                            className="mt-1 h-4 w-4 accent-cyan-200"
                          />
                          <span>
                            <span className="block font-medium text-white">Stueckzahl geprueft</span>
                            <span className="text-xs text-slate-500">Menge bewusst kontrolliert.</span>
                          </span>
                        </label>
                        <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300">
                          <input
                            type="checkbox"
                            checked={item.verifiedSize}
                            onChange={(event) => updateItem(item.id, { verifiedSize: event.target.checked })}
                            className="mt-1 h-4 w-4 accent-cyan-200"
                          />
                          <span>
                            <span className="block font-medium text-white">Groesse geprueft</span>
                            <span className="text-xs text-slate-500">Format bewusst kontrolliert.</span>
                          </span>
                        </label>
                        <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300">
                          <input
                            type="checkbox"
                            checked={item.verifiedFinishing}
                            onChange={(event) => updateItem(item.id, { verifiedFinishing: event.target.checked })}
                            className="mt-1 h-4 w-4 accent-cyan-200"
                          />
                          <span>
                            <span className="block font-medium text-white">Konfektion geprueft</span>
                            <span className="text-xs text-slate-500">Befestigung bewusst kontrolliert.</span>
                          </span>
                        </label>
                      </div>
                    ) : null}
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addItem} className="rounded-xl border-slate-800 bg-slate-900 text-white hover:bg-slate-800">
                  <PlusCircle className="h-4 w-4" />
                  Position hinzufuegen
                </Button>
              </div>
            </Section>
          </div>

          <aside className="space-y-5">
            <Section title="Import Uebersicht">
              <div className="space-y-3">
                {Object.entries(itemTypeLabels).map(([type, label]) => (
                  <div key={type} className="flex items-center justify-between rounded-xl bg-slate-900/70 p-3 text-sm">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-medium text-white">{itemCounts[type as OrderItemType]}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs leading-5 text-slate-500">
                Nur Produktionsartikel erscheinen spaeter auf der Production page. Zubehoer, Service und Versand bleiben nur in der Bestellung.
              </p>
            </Section>

            <Section title="Notizen">
              <textarea value={draft.notes} onChange={(event) => updateDraft({ notes: event.target.value })} rows={6} className={inputClass} />
            </Section>

            <Card className="rounded-xl border-slate-800 bg-slate-950/70 shadow-none backdrop-blur-xl">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-cyan-200">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">V1 Parser</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Keine KI: PDF Text wird extrahiert und mit Regeln vorbefuellt. Amber Felder bitte pruefen.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {saveMessage ? <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{saveMessage}</p> : null}

            <Button type="button" onClick={createOrder} disabled={saving} className="w-full rounded-xl bg-cyan-200 text-slate-950 hover:bg-cyan-100">
              <PlusCircle className="h-4 w-4" />
              {saving ? "Speichern..." : "Bestellung erstellen"}
            </Button>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
