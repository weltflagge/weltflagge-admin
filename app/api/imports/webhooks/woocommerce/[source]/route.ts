import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { importWebhookOrder } from "@/src/lib/import-sync";
import { mapWooOrder, getWooSourceConfig, type WooCommerceSourceId, type WooOrder } from "@/src/lib/woocommerce";

function parseSource(value: string): WooCommerceSourceId | null {
  if (value === "weltflagge" || value === "woocommerce-weltflagge") {
    return "woocommerce-weltflagge";
  }

  if (value === "flaggeshop" || value === "woocommerce-partner") {
    return "woocommerce-partner";
  }

  return null;
}

function hasValidSignature(body: string, signature: string | null, secret: string | undefined) {
  if (!secret) {
    return false;
  }

  if (!signature) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(body, "utf8").digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  return expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer);
}

export async function POST(request: Request, context: { params: Promise<{ source: string }> }) {
  const { source: sourceParam } = await context.params;
  const source = parseSource(sourceParam);

  if (!source) {
    return NextResponse.json({ ok: false, error: "Unknown WooCommerce source." }, { status: 404 });
  }

  const body = await request.text();
  const config = getWooSourceConfig(source);

  if (!hasValidSignature(body, request.headers.get("x-wc-webhook-signature"), config.webhookSecret)) {
    return NextResponse.json({ ok: false, error: "Invalid webhook signature." }, { status: 401 });
  }

  try {
    const wooOrder = JSON.parse(body) as WooOrder;
    const payload = mapWooOrder(wooOrder, source);
    const result = await importWebhookOrder(source, payload);

    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Webhook failed." }, { status: 400 });
  }
}
