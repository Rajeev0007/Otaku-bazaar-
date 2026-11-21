import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { addItem, findActiveCart, getOrCreateCart } from "@/server/cart/service";
import { confirmRazorpayPayment, placeOrder, updateOrderStatus } from "@/server/orders/service";
import { requestReturn, returnableItems, updateReturn } from "@/server/returns/service";
import { saveIntegrations } from "@/server/integrations";
import { applyTrackingUpdate, mapShiprocketStatus, shipWithShiprocket, _resetShiprocketToken } from "@/server/shipping/shiprocket";
import { saveProduct } from "@/server/admin/products";
import { randomToken } from "@/server/security/crypto";
import { makeProduct, makeUser } from "./helpers";
import type { CheckoutInput } from "@/lib/checkout";

const calls: { url: string; body: unknown }[] = [];
let awbCounter = 0;

beforeAll(async () => {
  process.env.RAZORPAY_KEY_ID = "rzp_test_ABC123";
  process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret_value";
  const market = await db.market.upsert({ where: { code: "IN" }, create: { code: "IN", name: "India", currency: "INR", countries: ["IN"], isActive: true, isDefault: true }, update: { isActive: true } });
  const zone = (await db.shippingZone.findFirst({ where: { marketId: market.id } })) ?? (await db.shippingZone.create({ data: { name: "All India", marketId: market.id, countries: ["IN"] } }));
  await db.shippingRate.upsert({ where: { zoneId_code: { zoneId: zone.id, code: "standard" } }, create: { zoneId: zone.id, code: "standard", name: "Standard", baseRate: 4900, minDays: 4, maxDays: 7 }, update: {} });
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, body });
    const ok = (j: unknown) => new Response(JSON.stringify(j), { status: 200 });
    if (url.endsWith("/orders")) return ok({ id: `order_${randomToken(6)}`, amount: body.amount, currency: "INR" });
    if (url.includes("/refund")) return ok({ id: `rfnd_${randomToken(6)}`, status: "processed", amount: body.amount });
    if (url.endsWith("/auth/login")) return ok({ token: "sr-token" });
    if (url.endsWith("/orders/create/adhoc")) return ok({ order_id: 111, shipment_id: 222, status: "NEW" });
    if (url.endsWith("/courier/assign/awb")) return ok({ awb_assign_status: 1, response: { data: { awb_code: `AWB${Date.now()}${awbCounter++}`, courier_name: "Delhivery Surface" } } });
    if (url.endsWith("/courier/generate/label")) return ok({ label_url: "https://example.com/label.pdf" });
    return ok({});
  });
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await db.$disconnect();
});

const address = { fullName: "Asha Rao", phone: "+91 98765 43210", line1: "12 MG Road", line2: "", landmark: "", city: "Bengaluru", state: "Karnataka" as const, postalCode: "560001", country: "IN" as const, instructions: "" };
const input = (over: Partial<CheckoutInput> = {}): CheckoutInput => ({ email: `b-${randomToken(4).toLowerCase()}@test.local`, phone: "+91 98765 43210", shipping: address, billingSameAsShipping: true, shippingMethod: "standard", paymentMethod: "cod", couponCode: "", notes: "", saveAddress: false, marketingOptIn: false, idempotencyKey: randomToken(16), ...over });
async function deliveredOrder(paymentMethod: "cod" | "razorpay", stock = 5, qty = 2) {
  const { variants } = await makeProduct({ stock: [stock], price: 50_000 });
  const { cart, newGuestToken } = await getOrCreateCart({});
  await addItem(cart.id, variants[0]!.id, qty);
  const r = await placeOrder(input({ paymentMethod }), (await findActiveCart({ guestToken: newGuestToken }))!, { userId: null });
  if (r.next.type === "razorpay") await confirmRazorpayPayment({ razorpayOrderId: r.next.razorpayOrderId, razorpayPaymentId: `pay_${randomToken(8).replace(/[^a-z0-9]/gi, "x")}` });
  const o = await db.order.findUniqueOrThrow({ where: { number: r.number } });
  const admin = await makeUser();
  await updateOrderStatus(o.id, "SHIPPED", { actorId: admin.id, carrier: "Test", trackingNumber: `T${randomToken(6)}` });
  await updateOrderStatus(o.id, "DELIVERED", { actorId: admin.id });
  return { order: o, variant: variants[0]!, admin };
}

describe("returns", () => {
  it("COD: partial return → receive with restock → manual refund", async () => {
    const { order, variant, admin } = await deliveredOrder("cod", 5, 2);
    const { items } = await returnableItems(order.id);
    expect(items[0]!.maxQty).toBe(2);
    const rr = await requestReturn(order.id, { kind: "RETURN", reason: "Wrong size / fit", items: [{ orderItemId: items[0]!.orderItemId, quantity: 1 }] }, null);
    await expect(requestReturn(order.id, { kind: "RETURN", reason: "Other", items: [{ orderItemId: items[0]!.orderItemId, quantity: 2 }] }, null)).rejects.toThrow(/at most 1/);
    await expect(updateReturn(rr.id, "REFUNDED", { actorId: admin.id })).rejects.toThrow(/Can't move/);
    await updateReturn(rr.id, "APPROVED", { actorId: admin.id });
    await updateReturn(rr.id, "RECEIVED", { actorId: admin.id, restock: true });
    expect((await db.inventoryItem.findUniqueOrThrow({ where: { variantId: variant.id } })).onHand).toBe(4); // 5 - 2 sold + 1 back
    await updateReturn(rr.id, "REFUNDED", { actorId: admin.id });
    const refund = await db.refund.findFirstOrThrow({ where: { returnId: rr.id } });
    expect(refund).toMatchObject({ amount: 50_000, method: "bank_transfer", status: "SUCCEEDED" });
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("DELIVERED"); // one unit still kept
  });

  it("prepaid: full return refunds via Razorpay and marks the order returned", async () => {
    const { order, admin } = await deliveredOrder("razorpay", 3, 1);
    const { items } = await returnableItems(order.id);
    const rr = await requestReturn(order.id, { kind: "RETURN", reason: "Damaged or defective", items: [{ orderItemId: items[0]!.orderItemId, quantity: 1 }] }, null);
    await updateReturn(rr.id, "APPROVED", { actorId: admin.id });
    await updateReturn(rr.id, "RECEIVED", { actorId: admin.id, restock: false });
    await updateReturn(rr.id, "REFUNDED", { actorId: admin.id, refundAmount: 40_000 });
    expect(calls.some((c) => c.url.includes("/refund") && (c.body as { amount: number }).amount === 40_000)).toBe(true);
    const o = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect([o.status, o.paymentStatus]).toEqual(["RETURNED", "PARTIALLY_REFUNDED"]);
  });

  it("refuses returns outside the window or before delivery", async () => {
    const { order } = await deliveredOrder("cod", 3, 1);
    await db.shipment.updateMany({ where: { orderId: order.id }, data: { deliveredAt: new Date(Date.now() - 30 * 86_400_000) } });
    const { items } = await returnableItems(order.id);
    expect(items[0]!.maxQty).toBe(0);
    expect(items[0]!.reason).toMatch(/window ended/);
  });
});

describe("Shiprocket", () => {
  it("books courier, marks shipped with AWB, and applies webhook updates in order", async () => {
    await saveIntegrations({ shiprocketEmail: "api@test.local", shiprocketPassword: "pw", shiprocketPickup: "Primary" });
    _resetShiprocketToken();
    const { variants } = await makeProduct({ stock: [5], price: 50_000 });
    const { cart, newGuestToken } = await getOrCreateCart({});
    await addItem(cart.id, variants[0]!.id, 1);
    const r = await placeOrder(input(), (await findActiveCart({ guestToken: newGuestToken }))!, { userId: null });
    const o = await db.order.findUniqueOrThrow({ where: { number: r.number } });
    const res = await shipWithShiprocket(o.id, (await makeUser()).id);
    const create = calls.find((c) => c.url.endsWith("/orders/create/adhoc"))!.body as Record<string, unknown>;
    expect(create).toMatchObject({ order_id: o.number, payment_method: "COD", billing_pincode: "560001", pickup_location: "Primary" });
    const shipped = await db.order.findUniqueOrThrow({ where: { id: o.id }, include: { shipments: true } });
    expect(shipped.status).toBe("SHIPPED");
    expect(shipped.shipments[0]).toMatchObject({ trackingNumber: res.awb, carrier: "Delhivery Surface", labelUrl: "https://example.com/label.pdf" });

    expect((await applyTrackingUpdate(res.awb, "IN TRANSIT")).applied).toBe(true);
    expect((await applyTrackingUpdate(res.awb, "IN TRANSIT")).applied).toBe(false); // duplicate
    expect((await applyTrackingUpdate(res.awb, "OUT FOR DELIVERY")).applied).toBe(true);
    expect((await applyTrackingUpdate(res.awb, "DELIVERED")).applied).toBe(true);
    const done = await db.order.findUniqueOrThrow({ where: { id: o.id } });
    expect([done.status, done.paymentStatus]).toEqual(["DELIVERED", "CAPTURED"]); // COD collected
    expect((await applyTrackingUpdate("NOPE", "DELIVERED")).applied).toBe(false);
  });

  it("maps courier status text", () => {
    expect(mapShiprocketStatus("Out For Delivery")).toBe("OUT_FOR_DELIVERY");
    expect(mapShiprocketStatus("RTO INITIATED")).toBe("DELIVERY_FAILED");
    expect(mapShiprocketStatus("RTO DELIVERED")).toBe("RETURNED");
    expect(mapShiprocketStatus("PICKED UP")).toBe("IN_TRANSIT");
    expect(mapShiprocketStatus("NEW")).toBeNull();
  });
});

describe("simpler product editor rules", () => {
  it("generates SKUs, allows empty description, and records stock edits", async () => {
    const admin = await makeUser();
    const { category } = await makeProduct();
    const run = Date.now().toString(36);
    const p = await saveProduct({ name: `Easy Hoodie ${run}`, categoryId: category.id, status: "ACTIVE", variants: [{ size: "M", color: "Black", price: "1499", stock: 3 }, { size: "L", color: "Black", price: "1499", stock: 2 }] }, admin.id);
    const vs = await db.productVariant.findMany({ where: { productId: p.id }, include: { inventory: true }, orderBy: { position: "asc" } });
    expect(vs.map((v) => v.sku)).toEqual([expect.stringMatching(/^OB-EASY-HOODIE-.*-BLA-M-[A-Z0-9]{3}$/), expect.stringMatching(/-BLA-L-/)]);
    await saveProduct({ name: `Easy Hoodie ${run}`, categoryId: category.id, status: "ACTIVE", variants: vs.map((v, i) => ({ id: v.id, sku: v.sku, size: v.size!, color: v.color!, price: "1499", stock: i === 0 ? 10 : undefined })) }, admin.id, p.id);
    const after = await db.inventoryItem.findUniqueOrThrow({ where: { variantId: vs[0]!.id }, include: { transactions: { orderBy: { createdAt: "desc" }, take: 1 } } });
    expect(after.onHand).toBe(10);
    expect(after.transactions[0]).toMatchObject({ delta: 7, reason: "CORRECTION", note: "Updated in product editor" });
    expect((await db.inventoryItem.findUniqueOrThrow({ where: { variantId: vs[1]!.id } })).onHand).toBe(2); // untouched
  });
});
