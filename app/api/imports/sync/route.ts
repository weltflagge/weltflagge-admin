import { NextResponse } from "next/server";
import { syncAllImportSources, syncImportSource, type ImportSourceId } from "@/src/lib/import-sync";

function isAuthorized(request: Request) {
  const secret = process.env.IMPORT_SYNC_SECRET;

  if (!secret) {
    return false;
  }

  const url = new URL(request.url);
  return request.headers.get("x-import-sync-secret") === secret || url.searchParams.get("secret") === secret;
}

function parseSource(value: string | null): ImportSourceId | null {
  if (value === "woocommerce-weltflagge" || value === "woocommerce-partner" || value === "ebay") {
    return value;
  }

  return null;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const source = parseSource(url.searchParams.get("source"));
  const results = source ? [await syncImportSource(source)] : await syncAllImportSources();

  return NextResponse.json({ ok: results.every((result) => result.ok), results });
}

export async function GET(request: Request) {
  return POST(request);
}
