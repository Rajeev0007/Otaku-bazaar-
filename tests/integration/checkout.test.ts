import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { db } from "@/server/db";
import { addItem, findActiveCart, getOrCreateCart } from "@/server/cart/service";
import { buildQuote } from "@/server/checkout/pricing";
import { evaluateCoupon } from "@/server/checkout/coupons";
import { cancelOrder, confirmRazorpayPayment, placeOrder, releaseExpiredReservations, updateOrderStatus } from "@/server/orders/service";
import { verifyCheckoutSignature, verifyWebhookSignature } from "@/server/payments/razorpay";
import { randomToken } from "@/server/security/crypto";
import { makeProduct, makeUser } from "./helpers";
import type { CheckoutInput } from "@/lib/checkout";

const KEY_SECRET = "rzp_test_secret_value";
let rzpCalls: { url: string; body: unknown }[] = [];

beforeAll(async () => {
  process.env.RAZORPAY_KEY_ID = "rzp_test_ABC123";
  process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_test";
  const market = await db.market.upsert({ where: { code: "IN" }, create: { code: "IN", name: "India", currency: "INR", countries: ["IN"], isActive: true, isDefault: true }, update: { isActive: true } });
  const zone = (await db.shippingZone.findFirst({ where: { marketId: market.id } })) ?? (await db.shippingZone.create({ data: { name: "All India", marketId: market.id, countries: ["IN"] } }));
  for (const r of [{ code: "standard", name: "Standard", baseRate: 4900, freeOver: 99900, minDays: 4, maxDays: 7 }, { code: "express", name: "Express", baseRate: 14900, minDays: 2, maxDays: 3 }]) {
    await db.shippingRate.upsert({ where: { zoneId_code: { zoneId: zone.id, code: r.code } }, create: { zoneId: zone.id, ...r }, update: {} });
  }
  await db.setting.deleteMany({ where: { key: "store" } }); // defaults: COD on, ₹5000 limit, free shipping over ₹999
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    rzpCalls.push({ url, body });
    if (url.endsWith("/orders")) return new Response(JSON.stringify({ id: `order_${randomToken(6)}`, amount: body.amount, currency: body.currency, status: "created" }), { status: 200 });
    if (url.includes("/refund")) return new Response(JSON.stringify({ id: `rfnd_${randomToken(6)}`, status: "processed", amount: body.amount }), { status: 200 });
    return new Response(JSON.stringify({}), { status: 200 }); // email etc.
  });
});
afterEach(() => {
  rzpCalls = [];
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await db.$disconnect();
});

const address = { fullName: "Asha Rao", phone: "+91 98765 43210", line1: "12 MG Road", line2: "", landmark: "", city: "Bengaluru", state: "Karnataka" as const, postalCode: "560001", country: "IN" as const, instructions: "" };
function input(over: Partial<CheckoutInput> = {}): CheckoutInput {
  return { email: `buyer-${randomToken(4).toLowerCase()}@test.local`, phone: "+91 98765 43210", shipping: address, billingSameAsShipping: true, shippingMethod: "standard", paymentMethod: "cod", couponCode: "", notes: "", saveAddress: false, marketingOptIn: false, idempotencyKey: randomToken(16), ...over };
}

async function cartWith(variantId: string, qty: number) {
  const { cart, newGuestToken } = await getOrCreateCart({});
  await addItem(cart.id, variantId, qty);
  return (await findActiveCart({ guestToken: newGuestToken }))!;
}

const onHand = async (variantId: string) => db.inventoryItem.findUniqueOrThrow({ where: { variantId } });

describe("coupons", () => {
  it("applies percent, fixed, BOGO and min/limit rules on the server", async () => {
    const tag = randomToken(4).toUpperCase().replace(/[^A-Z0-9]/g, "X");
    await db.coupon.createMany({
      data: [
        { code: `P10${tag}`, type: "PERCENT", value: 10, maxDiscount: 5000 },
        { code: `F100${tag}`, type: "FIXED", value: 10000, minSubtotal: 79900 },
        { code: `BOGO${tag}`, type: "BOGO" },
        { code: `OLD${tag}`, type: "PERCENT", value: 50, endsAt: new Date(Date.now() - 1000) },
        { code: `ONCE${tag}`, type: "PERCENT", value: 5, usageLimit: 1, usedCount: 1 },
      ],
    });
    const lines = [{ productId: "p", categoryId: "c", franchiseId: null, unitPrice: 60000, quantity: 1 }, { productId: "q", categoryId: "c", franchiseId: null, unitPrice: 40000, quantity: 1 }];
    const p10 = await evaluateCoupon(`p10${tag}`, { lines });
    expect(p10.ok && p10.discount).toBe(5000); // 10% of ₹1000 = ₹100, capped at ₹50
    const f = await evaluateCoupon(`F100${tag}`, { lines });
    expect(f.ok && f.discount).toBe(10000);
    const small = await evaluateCoupon(`F100${tag}`, { lines: [lines[1]!] });
    expect(small.ok).toBe(false);
    const bogo = await evaluateCoupon(`BOGO${tag}`, { lines });
    expect(bogo.ok && bogo.discount).toBe(40000); // cheaper item free
    expect((await evaluateCoupon(`OLD${tag}`, { lines })).ok).toBe(false);
    expect((await evaluateCoupon(`ONCE${tag}`, { lines })).ok).toBe(false);
    expect((await evaluateCoupon("NOPE", { lines })).ok).toBe(false);
  });
});

describe("checkout pricing", () => {
  it("computes totals from database prices, with free shipping, COD limit and inclusive GST", async () => {
    const { variants } = await makeProduct({ stock: [10], price: 59_900 });
    const cart = await cartWith(variants[0]!.id, 2); // ₹1198
    const q = await buildQuote(cart, { postalCode: "560001", shippingMethod: "standard", paymentMethod: "cod" });
    expect(q.subtotal).toBe(119_800);
    expect(q.shipping).toBe(0); // over ₹999
    expect(q.total).toBe(119_800);
    expect(q.tax).toBe(18_275); // GST included in ₹1198 at 18%
    expect(q.payment.cod).toBe(true);
    const express = await buildQuote(cart, { postalCode: "560001", shippingMethod: "express", paymentMethod: "razorpay" });
    expect(express.shipping).toBe(14_900);
    expect(express.total).toBe(134_700);
    const bad = await buildQuote(cart, { postalCode: "012345" });
    expect(bad.shippingError).toMatch(/PIN/);
  });
});

describe("orders", () => {
  it("COD: places the order, deducts stock once, clears the cart and is idempotent", async () => {
    const { variants, product } = await makeProduct({ stock: [5], price: 49_900 });
    const cart = await cartWith(variants[0]!.id, 2);
    const inp = input();
    const r = await placeOrder(inp, cart, { userId: null });
    expect(r.next.type).toBe("done");
    const again = await placeOrder(inp, cart, { userId: null });
    expect(again.number).toBe(r.number);
    expect((await onHand(variants[0]!.id)).onHand).toBe(3);
    const o = await db.order.findUniqueOrThrow({ where: { number: r.number }, include: { items: true, payments: true } });
    expect(o).toMatchObject({ status: "PLACED", paymentMethod: "cod", grandTotal: 99_800 + 4_900 }); // ₹998 + ₹49 shipping
    expect(o.payments[0]!.status).toBe("PENDING");
    expect(await db.cartItem.count({ where: { cartId: cart.id } })).toBe(0);
    expect((await db.product.findUniqueOrThrow({ where: { id: product.id } })).salesCount).toBe(2);

    await updateOrderStatus(o.id, "SHIPPED", { actorId: (await makeUser()).id, carrier: "Delhivery", trackingNumber: "DL123" });
    await updateOrderStatus(o.id, "DELIVERED", { actorId: (await makeUser()).id });
    const delivered = await db.order.findUniqueOrThrow({ where: { id: o.id } });
    expect(delivered.paymentStatus).toBe("CAPTURED"); // cash collected on delivery
  });

  it("Razorpay: reserves stock, confirms once (callback + webhook), converts reservation to sale", async () => {
    const { variants } = await makeProduct({ stock: [3], price: 99_900 });
    const cart = await cartWith(variants[0]!.id, 1);
    const r = await placeOrder(input({ paymentMethod: "razorpay" }), cart, { userId: null });
    expect(r.next.type).toBe("razorpay");
    expect(rzpCalls[0]!.body).toMatchObject({ amount: 99_900, currency: "INR", payment_capture: 1 });
    let inv = await onHand(variants[0]!.id);
    expect([inv.onHand, inv.reserved]).toEqual([3, 1]);
    expect(await db.cartItem.count({ where: { cartId: cart.id } })).toBe(1); // cart kept until paid

    const rzpOrderId = r.next.type === "razorpay" ? r.next.razorpayOrderId : "";
    const payId = `pay_${randomToken(8).replace(/[^a-zA-Z0-9]/g, "x")}`;
    const first = await confirmRazorpayPayment({ razorpayOrderId: rzpOrderId, razorpayPaymentId: payId });
    const second = await confirmRazorpayPayment({ razorpayOrderId: rzpOrderId, razorpayPaymentId: payId });
    expect([first.changed, second.changed]).toEqual([true, false]);
    inv = await onHand(variants[0]!.id);
    expect([inv.onHand, inv.reserved]).toEqual([2, 0]);
    const o = await db.order.findUniqueOrThrow({ where: { number: r.number } });
    expect([o.status, o.paymentStatus]).toEqual(["PAYMENT_CONFIRMED", "CAPTURED"]);
    expect(await db.cartItem.count({ where: { cartId: cart.id } })).toBe(0);

    // Cancel → full refund via Razorpay and stock returned
    await cancelOrder(o.id, { reason: "Changed mind", actorId: null, byCustomer: true });
    expect(rzpCalls.some((c) => c.url.includes(`/payments/${payId}/refund`))).toBe(true);
    const refunded = await db.order.findUniqueOrThrow({ where: { id: o.id }, include: { refunds: true } });
    expect(refunded.paymentStatus).toBe("REFUNDED");
    expect(refunded.refunds[0]!.status).toBe("SUCCEEDED");
    expect((await onHand(variants[0]!.id)).onHand).toBe(3);
  });

  it("releases stock when payment isn't completed in time", async () => {
    const { variants } = await makeProduct({ stock: [2] });
    const cart = await cartWith(variants[0]!.id, 2);
    const r = await placeOrder(input({ paymentMethod: "razorpay" }), cart, { userId: null });
    expect((await onHand(variants[0]!.id)).reserved).toBe(2);
    await releaseExpiredReservations(new Date(Date.now() + 31 * 60_000));
    expect((await onHand(variants[0]!.id)).reserved).toBe(0);
    expect((await db.order.findUniqueOrThrow({ where: { number: r.number } })).status).toBe("CANCELLED");
  });

  it("never oversells the last unit to two simultaneous buyers", async () => {
    const { variants } = await makeProduct({ stock: [1] });
    const carts = [await cartWith(variants[0]!.id, 1), await cartWith(variants[0]!.id, 1), await cartWith(variants[0]!.id, 1)];
    const results = await Promise.allSettled(carts.map((c) => placeOrder(input(), c, { userId: null })));
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect((await onHand(variants[0]!.id)).onHand).toBe(0);
  });

  it("rejects COD above the limit and coupons that don't apply", async () => {
    const { variants } = await makeProduct({ stock: [20], price: 299_900 });
    const cart = await cartWith(variants[0]!.id, 2); // ₹5998 > ₹5000 COD limit
    await expect(placeOrder(input(), cart, { userId: null })).rejects.toThrow(/Cash on delivery/);
    await expect(placeOrder(input({ paymentMethod: "razorpay", couponCode: "DOESNOTEXIST" }), cart, { userId: null })).rejects.toThrow(/isn't valid/);
  });
});

describe("Razorpay signatures", () => {
  it("verifies checkout and webhook HMACs and rejects tampering", () => {
    const sig = createHmac("sha256", KEY_SECRET).update("order_1|pay_1").digest("hex");
    expect(verifyCheckoutSignature("order_1", "pay_1", sig, KEY_SECRET)).toBe(true);
    expect(verifyCheckoutSignature("order_1", "pay_2", sig, KEY_SECRET)).toBe(false);
    const body = JSON.stringify({ event: "payment.captured" });
    const wsig = createHmac("sha256", "whsec_test").update(body).digest("hex");
    expect(verifyWebhookSignature(body, wsig, "whsec_test")).toBe(true);
    expect(verifyWebhookSignature(body + " ", wsig, "whsec_test")).toBe(false);
  });
});
