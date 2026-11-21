import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { addItem, findActiveCart, getOrCreateCart } from "@/server/cart/service";
import { cancelOrder, placeOrder, updateOrderStatus } from "@/server/orders/service";
import { buildQuote } from "@/server/checkout/pricing";
import { addPoints, checkGiftCard, issueGiftCard, pointsBalance } from "@/server/rewards/service";
import { sendDueStockAlerts } from "@/server/inventory/alerts";
import { setStock } from "@/server/inventory/service";
import { addMessage, createTicket } from "@/server/support/service";
import { deleteAccount, exportUserData } from "@/server/account/privacy";
import { cleanPath, eventSchema, recordEvent, referrerHost } from "@/server/analytics/events";
import { dailySales, funnel, periodStart, salesSummary, topProducts } from "@/server/analytics/reports";
import { randomToken } from "@/server/security/crypto";
import { makeProduct, makeUser } from "./helpers";
import type { CheckoutInput } from "@/lib/checkout";

beforeAll(async () => {
  const market = await db.market.upsert({ where: { code: "IN" }, create: { code: "IN", name: "India", currency: "INR", countries: ["IN"], isActive: true, isDefault: true }, update: { isActive: true } });
  const zone = (await db.shippingZone.findFirst({ where: { marketId: market.id } })) ?? (await db.shippingZone.create({ data: { name: "All India", marketId: market.id, countries: ["IN"] } }));
  await db.shippingRate.upsert({ where: { zoneId_code: { zoneId: zone.id, code: "standard" } }, create: { zoneId: zone.id, code: "standard", name: "Standard", baseRate: 4900, minDays: 4, maxDays: 7 }, update: {} });
});
afterAll(async () => {
  await db.$disconnect();
});

const address = { fullName: "Asha Rao", phone: "+91 98765 43210", line1: "12 MG Road", line2: "", landmark: "", city: "Bengaluru", state: "Karnataka" as const, postalCode: "560001", country: "IN" as const, instructions: "" };
const input = (over: Partial<CheckoutInput> = {}): CheckoutInput => ({ email: `p6-${randomToken(4).toLowerCase()}@test.local`, phone: "+91 98765 43210", shipping: address, billingSameAsShipping: true, shippingMethod: "standard", paymentMethod: "cod", giftCardCode: "", usePoints: false, couponCode: "", notes: "", saveAddress: false, marketingOptIn: false, idempotencyKey: randomToken(16), ...over });

async function cartFor(userId: string | null, price: number, qty = 1, stock = 5) {
  const { variants } = await makeProduct({ stock: [stock], price });
  const owner = userId ? { userId } : {};
  const { cart, newGuestToken } = await getOrCreateCart(owner);
  await addItem(cart.id, variants[0]!.id, qty);
  const active = (await findActiveCart(userId ? { userId } : { guestToken: newGuestToken }))!;
  return { cart: active, variant: variants[0]! };
}

describe("gift cards", () => {
  it("covers the whole order, confirms it immediately, and is restored on cancel", async () => {
    const { code } = await issueGiftCard({ amount: 500_000 });
    const { cart, variant } = await cartFor(null, 100_000);
    const quote = await buildQuote(cart, { postalCode: "560001", shippingMethod: "standard", paymentMethod: "cod", giftCardCode: code });
    expect(quote.giftCard?.applied).toBe(quote.grossTotal);
    expect(quote.total).toBe(0);

    const r = await placeOrder(input({ giftCardCode: code }), cart, { userId: null });
    expect(r.next.type).toBe("done");
    const o = await db.order.findUniqueOrThrow({ where: { id: r.orderId } });
    expect(o).toMatchObject({ paymentMethod: "giftcard", grandTotal: 0, status: "PAYMENT_CONFIRMED" });
    const after = await checkGiftCard(code);
    expect(after.ok && after.balance).toBe(500_000 - o.giftCardTotal);
    expect((await db.inventoryItem.findUniqueOrThrow({ where: { variantId: variant.id } })).onHand).toBe(4);

    await cancelOrder(o.id, { reason: "Changed my mind", actorId: null, byCustomer: true });
    const restored = await checkGiftCard(code);
    expect(restored.ok && restored.balance).toBe(500_000);
    expect((await db.inventoryItem.findUniqueOrThrow({ where: { variantId: variant.id } })).onHand).toBe(5);
  });

  it("rejects disabled, expired and unknown codes", async () => {
    const { giftCard, code } = await issueGiftCard({ amount: 10_000, expiresAt: new Date(Date.now() - 1000) });
    expect((await checkGiftCard(code)).ok).toBe(false);
    await db.giftCard.update({ where: { id: giftCard.id }, data: { expiresAt: null, isActive: false } });
    expect(await checkGiftCard(code)).toMatchObject({ ok: false, error: expect.stringMatching(/disabled/) });
    expect((await checkGiftCard("OBGC-AAAA-BBBB-CCCC")).ok).toBe(false);
  });
});

describe("reward points", () => {
  it("earns on delivery, redeems at checkout (capped) and refunds points on cancel", async () => {
    const user = await makeUser();
    const admin = await makeUser();
    // Earn: ₹1,000 order at 2 pts / ₹100 → 20 pts (shipping included in what was paid).
    const first = await cartFor(user.id, 100_000);
    const r1 = await placeOrder(input({ email: user.email }), first.cart, { userId: user.id });
    await updateOrderStatus(r1.orderId, "SHIPPED", { actorId: admin.id, carrier: "Test", trackingNumber: `T${randomToken(6)}` });
    await updateOrderStatus(r1.orderId, "DELIVERED", { actorId: admin.id });
    const o1 = await db.order.findUniqueOrThrow({ where: { id: r1.orderId } });
    const earned = Math.floor((o1.grandTotal / 10_000) * 2);
    expect(await pointsBalance(user.id)).toBe(earned);

    // Top up so the 20% cap is what limits redemption.
    await db.$transaction((tx) => addPoints(tx, user.id, 1000, "ADJUST"));
    const second = await cartFor(user.id, 100_000);
    const quote = await buildQuote(second.cart, { userId: user.id, postalCode: "560001", shippingMethod: "standard", paymentMethod: "cod", usePoints: true });
    expect(quote.points?.value).toBeGreaterThan(0);
    expect(quote.points!.value).toBeLessThanOrEqual(Math.floor(quote.grossTotal * 0.2));
    const before = await pointsBalance(user.id);
    const r2 = await placeOrder(input({ email: user.email, usePoints: true }), second.cart, { userId: user.id });
    const o2 = await db.order.findUniqueOrThrow({ where: { id: r2.orderId } });
    expect(o2.loyaltyTotal).toBe(quote.points!.value);
    expect(await pointsBalance(user.id)).toBe(before - quote.points!.applied);

    await cancelOrder(o2.id, { reason: "Ordered by mistake", actorId: null, byCustomer: true });
    expect(await pointsBalance(user.id)).toBe(before);
  });

  it("can't spend more points than the balance", async () => {
    const user = await makeUser();
    await expect(db.$transaction((tx) => addPoints(tx, user.id, -5, "REDEEM"))).rejects.toThrow(/Not enough/);
  });
});

describe("back-in-stock alerts", () => {
  it("emails each sign-up once when stock returns", async () => {
    const { variants } = await makeProduct({ stock: [0] });
    const v = variants[0]!;
    const email = `alert-${randomToken(4).toLowerCase()}@test.local`;
    await db.stockAlert.create({ data: { variantId: v.id, email } });
    await sendDueStockAlerts();
    expect(await db.notification.count({ where: { recipient: email, template: "stock.back_in_stock" } })).toBe(0);
    const admin = await makeUser();
    await setStock(v.id, 3, admin.id);
    await sendDueStockAlerts();
    await sendDueStockAlerts();
    expect(await db.notification.count({ where: { recipient: email, template: "stock.back_in_stock" } })).toBe(1);
  });
});

describe("support tickets", () => {
  it("creates a ticket, links only the sender's own order, and tracks reply status", async () => {
    const { cart } = await cartFor(null, 50_000);
    const email = `sup-${randomToken(4).toLowerCase()}@test.local`;
    const r = await placeOrder(input({ email }), cart, { userId: null });
    const base = { name: "Asha Rao", category: "order", subject: "Where is my parcel?", message: "It has been a week and no update yet." };

    const other = await createTicket({ ...base, email: "someone-else@test.local", orderNumber: r.number }, null);
    expect(other.orderId).toBeNull();
    const mine = await createTicket({ ...base, email, orderNumber: r.number.toLowerCase() }, null);
    expect(mine).toMatchObject({ orderId: r.orderId, priority: "HIGH", status: "OPEN" });

    const staff = await makeUser();
    await addMessage(mine.id, "It's with the courier, arriving tomorrow.", { userId: staff.id, isStaff: true });
    expect((await db.supportTicket.findUniqueOrThrow({ where: { id: mine.id } })).status).toBe("PENDING_CUSTOMER");
    expect(await db.notification.count({ where: { recipient: email, template: "support.reply" } })).toBe(1);
    await addMessage(mine.id, "Thanks!", { userId: null, isStaff: false });
    expect((await db.supportTicket.findUniqueOrThrow({ where: { id: mine.id } })).status).toBe("PENDING_STAFF");

    await db.supportTicket.update({ where: { id: mine.id }, data: { status: "CLOSED" } });
    await expect(addMessage(mine.id, "One more thing", { userId: null, isStaff: false })).rejects.toThrow(/closed/);
    await expect(createTicket({ ...base, email, message: "short" }, null)).rejects.toThrow();
  });
});

describe("privacy", () => {
  it("exports a user's data without secrets and anonymises on delete while keeping orders", async () => {
    const user = await makeUser();
    await db.user.update({ where: { id: user.id }, data: { passwordHash: "scrypt$secret" } });
    const { cart } = await cartFor(user.id, 50_000);
    const r = await placeOrder(input({ email: user.email }), cart, { userId: user.id });
    await createTicket({ name: "Test User", email: user.email, category: "account", subject: "Delete me", message: "Please remove my account soon." }, user.id);

    const data = await exportUserData(user.id);
    expect(JSON.stringify(data)).not.toContain("scrypt$secret");
    expect(data.orders.map((o) => o.number)).toContain(r.number);
    expect(data.supportTickets).toHaveLength(1);

    await deleteAccount(user.id);
    const u = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(u).toMatchObject({ status: "DELETED", name: null, passwordHash: null });
    expect(u.email).toMatch(/@deleted\.invalid$/);
    const o = await db.order.findUniqueOrThrow({ where: { id: r.orderId } });
    expect(o.userId).toBeNull();
    expect(await db.supportTicket.count({ where: { email: user.email } })).toBe(0);

    const staff = await db.user.create({ data: { email: `st-${randomToken(4).toLowerCase()}@test.local`, isStaff: true } });
    await expect(deleteAccount(staff.id)).rejects.toThrow(/Staff/);
  });
});

describe("analytics", () => {
  it("validates events and strips personal data from paths and referrers", async () => {
    expect(eventSchema.safeParse({ name: "drop_table" }).success).toBe(false);
    expect(cleanPath("/reset-password?token=abc#x")).toBe("/reset-password");
    expect(cleanPath("https://evil.example/")).toBeNull();
    expect(referrerHost("https://www.instagram.com/p/123?u=me", "shop.test")).toBe("instagram.com");
    expect(referrerHost("https://shop.test/cart", "shop.test")).toBeNull();

    const { product, variants } = await makeProduct();
    const sessionId = `s${randomToken(8).replace(/[^a-zA-Z0-9]/g, "x")}`;
    await recordEvent(eventSchema.parse({ name: "add_to_cart", sessionId, variantId: variants[0]!.id, quantity: 2, path: "/shop?q=x", utmSource: "Instagram" }), { ownHost: "shop.test" });
    const e = await db.analyticsEvent.findFirstOrThrow({ where: { sessionId } });
    expect(e).toMatchObject({ productId: product.id, path: "/shop", utmSource: "instagram", value: 2 });
  });

  it("reports counted orders (COD included, cancelled excluded) and the funnel", async () => {
    const since = periodStart(1);
    const before = await salesSummary(since);
    const a = await cartFor(null, 70_000);
    const placed = await placeOrder(input(), a.cart, { userId: null });
    const b = await cartFor(null, 30_000);
    const cancelled = await placeOrder(input(), b.cart, { userId: null });
    await cancelOrder(cancelled.orderId, { reason: "Test", actorId: null, byCustomer: true });
    const after = await salesSummary(since);
    const placedTotal = (await db.order.findUniqueOrThrow({ where: { id: placed.orderId } })).grandTotal;
    expect(after.orders - before.orders).toBe(1);
    expect(after.revenue - before.revenue).toBe(placedTotal);

    const days = await dailySales(7);
    expect(days).toHaveLength(7);
    expect(days.at(-1)!.revenue).toBeGreaterThanOrEqual(placedTotal);
    expect((await topProducts(since, 100)).some((p) => p.productId === a.variant.productId)).toBe(true);
    const steps = await funnel(since);
    expect(steps.map((s) => s.step)).toEqual(["Visited the store", "Viewed a product", "Added to cart", "Started checkout", "Placed an order"]);
    expect(steps[2]!.count).toBeGreaterThanOrEqual(1);
  });
});
