// Shiprocket adapter (courier aggregator for India): create shipment → assign AWB → schedule pickup → label,
// plus tracking via webhook or on-demand refresh. API reference: https://apidocs.shiprocket.in
import type { OrderStatus } from "@prisma/client";
import { db } from "@/server/db";
import { getIntegrations } from "@/server/integrations";
import { safeEqual } from "@/server/security/crypto";
import { nextStatuses, updateOrderStatus } from "@/server/orders/service";

const API = "https://apiv2.shiprocket.in/v1/external";

export class ShippingError extends Error {}

let token: { value: string; expires: number; email: string } | null = null;

async function config() {
  const c = (await getIntegrations()).shiprocket;
  if (!c) throw new ShippingError("Shiprocket isn't connected. Admin → Integrations → Shipping.");
  return c;
}

async function auth() {
  const c = await config();
  if (token && token.email === c.email && token.expires > Date.now()) return token.value;
  const res = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: c.email, password: c.password }), signal: AbortSignal.timeout(15_000) });
  const json = (await res.json().catch(() => ({}))) as { token?: string; message?: string };
  if (!res.ok || !json.token) throw new ShippingError(`Shiprocket sign-in failed: ${json.message ?? res.status}. Check the API user email/password.`);
  token = { value: json.token, expires: Date.now() + 8 * 86_400_000, email: c.email }; // tokens last 10 days
  return json.token;
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const t = await auth();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => ({}))) as T & { message?: string; errors?: unknown };
  if (!res.ok) {
    console.error("[shiprocket]", path, res.status, JSON.stringify(json).slice(0, 500));
    throw new ShippingError(`Shiprocket: ${json.message ?? `error ${res.status}`}`);
  }
  return json;
}

/** Books the courier for an order and marks it shipped with the AWB tracking number. */
export async function shipWithShiprocket(orderId: string, actorId: string) {
  const c = await config();
  const o = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: { include: { variant: { select: { weightGrams: true, product: { select: { weightGrams: true } } } } } } } });
  if (!nextStatuses(o.status).includes("SHIPPED")) throw new ShippingError(`This order is ${o.status.toLowerCase()} and can't be shipped.`);
  const a = o.shippingAddress as Record<string, string>;
  const [first, ...rest] = (a.fullName ?? "").trim().split(/\s+/);
  const weightKg = Math.max(0.1, o.items.reduce((n, i) => n + (i.variant?.weightGrams ?? i.variant?.product.weightGrams ?? 250) * i.quantity, 0) / 1000);
  const phone = (a.phone || o.phone).replace(/\D/g, "").slice(-10);

  const created = await call<{ order_id: number; shipment_id: number; status?: string }>("POST", "/orders/create/adhoc", {
    order_id: o.number,
    order_date: (o.placedAt ?? o.createdAt).toISOString().slice(0, 16).replace("T", " "),
    pickup_location: c.pickupLocation,
    billing_customer_name: first ?? "Customer",
    billing_last_name: rest.join(" "),
    billing_address: [a.line1, a.line2].filter(Boolean).join(", "),
    billing_address_2: a.landmark ?? "",
    billing_city: a.city,
    billing_pincode: a.postalCode,
    billing_state: a.state,
    billing_country: "India",
    billing_email: o.email,
    billing_phone: phone,
    shipping_is_billing: true,
    order_items: o.items.map((i) => ({ name: `${i.productName}${i.variantTitle !== "Default" ? ` (${i.variantTitle})` : ""}`.slice(0, 120), sku: i.sku, units: i.quantity, selling_price: (i.total / i.quantity / 100).toFixed(2) })),
    payment_method: o.paymentMethod === "cod" ? "COD" : "Prepaid",
    shipping_charges: o.shippingTotal / 100,
    giftwrap_charges: o.giftWrapTotal / 100,
    total_discount: 0,
    sub_total: o.grandTotal / 100,
    length: c.pkg.length,
    breadth: c.pkg.breadth,
    height: c.pkg.height,
    weight: Number(weightKg.toFixed(2)),
  });
  if (!created.shipment_id) throw new ShippingError("Shiprocket didn't return a shipment. Check the order in your Shiprocket panel.");

  const awb = await call<{ awb_assign_status?: number; response?: { data?: { awb_code?: string; courier_name?: string } }; message?: string }>("POST", "/courier/assign/awb", { shipment_id: created.shipment_id });
  const code = awb.response?.data?.awb_code;
  if (!code) throw new ShippingError(`Shiprocket couldn't assign a courier${awb.message ? `: ${awb.message}` : ""}. Check your Shiprocket wallet balance and pickup address.`);
  const courier = awb.response?.data?.courier_name ?? "Shiprocket";

  await call("POST", "/courier/generate/pickup", { shipment_id: [created.shipment_id] }).catch((e) => console.error("[shiprocket] pickup", e));
  const label = await call<{ label_url?: string }>("POST", "/courier/generate/label", { shipment_id: [created.shipment_id] }).catch(() => ({ label_url: undefined }));

  await updateOrderStatus(o.id, "SHIPPED", {
    actorId,
    carrier: courier,
    trackingNumber: code,
    trackingUrl: `https://shiprocket.co/tracking/${code}`,
    labelUrl: label.label_url,
    providerRef: `shiprocket:${created.shipment_id}`,
    message: `Shipped with ${courier}`,
  });
  return { awb: code, courier, labelUrl: label.label_url ?? null };
}

/** Maps Shiprocket's status text to our order status. */
export function mapShiprocketStatus(raw: string): OrderStatus | null {
  const s = raw.toUpperCase().replace(/_/g, " ").trim();
  if (s === "DELIVERED") return "DELIVERED";
  if (s.includes("OUT FOR DELIVERY")) return "OUT_FOR_DELIVERY";
  if (s.includes("RTO DELIVERED")) return "RETURNED";
  if (s.includes("UNDELIVERED") || s.includes("RTO") || s.includes("LOST") || s.includes("DAMAGED")) return "DELIVERY_FAILED";
  if (s.includes("DELAY") || s.includes("MISROUTED")) return "DELAYED";
  if (s.includes("PICKED UP") || s.includes("IN TRANSIT") || s.includes("SHIPPED") || s.includes("REACHED") || s.includes("HUB")) return "IN_TRANSIT";
  return null;
}

/** Applies a tracking update if it moves the order forward; records it on the shipment either way. */
export async function applyTrackingUpdate(awb: string, rawStatus: string, extra: { location?: string; at?: Date } = {}) {
  const shipment = await db.shipment.findFirst({ where: { trackingNumber: awb }, include: { order: { select: { id: true, status: true } } } });
  if (!shipment) return { applied: false, reason: "unknown awb" };
  const to = mapShiprocketStatus(rawStatus);
  if (!to) return { applied: false, reason: `ignored status ${rawStatus}` };
  const dup = await db.trackingEvent.findFirst({ where: { shipmentId: shipment.id, status: to, message: rawStatus } });
  if (dup) return { applied: false, reason: "duplicate" };
  if (shipment.order.status !== to && nextStatuses(shipment.order.status).includes(to)) {
    await updateOrderStatus(shipment.order.id, to, { actorId: null, message: rawStatus.charAt(0) + rawStatus.slice(1).toLowerCase(), location: extra.location });
    return { applied: true, status: to };
  }
  await db.trackingEvent.create({ data: { shipmentId: shipment.id, status: to, message: rawStatus, location: extra.location, occurredAt: extra.at ?? new Date() } });
  return { applied: false, reason: "no status change" };
}

export async function refreshTracking(orderId: string) {
  const s = await db.shipment.findFirst({ where: { orderId, trackingNumber: { not: null } }, orderBy: { createdAt: "desc" } });
  if (!s?.trackingNumber) throw new ShippingError("This order has no tracking number yet.");
  const t = await call<{ tracking_data?: { shipment_track?: { current_status?: string; destination?: string }[] } }>("GET", `/courier/track/awb/${encodeURIComponent(s.trackingNumber)}`);
  const cur = t.tracking_data?.shipment_track?.[0];
  if (!cur?.current_status) return { applied: false, reason: "no data yet" };
  return applyTrackingUpdate(s.trackingNumber, cur.current_status, { location: cur.destination });
}

export async function verifyShiprocketWebhook(headerToken: string | null) {
  const c = (await getIntegrations()).shiprocket;
  return !!c?.webhookToken && !!headerToken && safeEqual(c.webhookToken, headerToken);
}

export function _resetShiprocketToken() {
  token = null;
}
