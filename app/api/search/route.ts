import { getOrdersWithFallback } from "@/src/lib/orders-db";

export const dynamic = "force-dynamic";

type SearchResult = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  badges: string[];
};

function normalize(value: string | number | null | undefined) {
  return String(value ?? "").toLowerCase();
}

function compact(values: Array<string | number | null | undefined>) {
  return values.filter((value) => String(value ?? "").trim()).map(String);
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return Response.json({ results: [] satisfies SearchResult[] });
  }

  const needle = normalize(query);
  const { orders, source } = await getOrdersWithFallback();

  const results = orders
    .map((order) => {
      const itemMatches = order.items.filter((item) => {
        const printFiles = item.printFiles?.length ? item.printFiles : [item.printFile];
        const haystack = compact([
          item.name,
          item.sku,
          item.size,
          item.quantity,
          item.production.manufacturer,
          item.production.batchId,
          item.production.status,
          ...printFiles.flatMap((file) => [file.fileName, file.fileUrl, file.status, file.side]),
        ]).join(" ");

        return normalize(haystack).includes(needle);
      });

      const orderHaystack = compact([
        order.id,
        order.externalId,
        order.customer,
        order.email,
        order.phone,
        order.status,
        order.paymentStatus,
        order.carrier,
        order.trackingNumber,
        order.priority,
        order.amount,
        order.billingAddress.company,
        order.billingAddress.name,
        order.billingAddress.street,
        order.billingAddress.postalCode,
        order.billingAddress.city,
        order.shippingAddress.company,
        order.shippingAddress.name,
        order.shippingAddress.street,
        order.shippingAddress.postalCode,
        order.shippingAddress.city,
        order.notes,
        ...order.timeline.flatMap((entry) => [entry.actor, entry.message]),
      ]).join(" ");

      const orderMatches = normalize(orderHaystack).includes(needle);

      if (!orderMatches && itemMatches.length === 0) {
        return null;
      }

      const firstItem = itemMatches[0] ?? order.items[0];
      const matchLabel = itemMatches.length
        ? `${itemMatches.length} matching item${itemMatches.length === 1 ? "" : "s"}`
        : firstItem?.name ?? order.status;

      return {
        id: order.id,
        href: `/orders/${order.id}`,
        title: `${order.id} - ${order.customer}`,
        subtitle: compact([
          matchLabel,
          order.trackingNumber ? `Tracking ${order.trackingNumber}` : null,
          firstItem?.printFile.fileName ? `File ${firstItem.printFile.fileName}` : null,
        ]).join(" - "),
        badges: compact([order.status, order.carrier !== "-" ? order.carrier : null, source === "database" ? "DB" : "Mock"]),
      } satisfies SearchResult;
    })
    .filter((result): result is SearchResult => Boolean(result))
    .slice(0, 8);

  return Response.json({ results });
}
