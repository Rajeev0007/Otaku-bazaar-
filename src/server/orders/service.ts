// Order lifecycle: placement, stock reservation, payment confirmation, expiry, cancellation and refunds.
// Every money/stock change runs inside a database transaction, and payment confirmation is idempotent so
// the checkout callback and the Razorpay webhook can both arrive without double-counting anything.
import { InventoryReason, Prisma, type OrderStatus } from "@prisma/client";
import { db, type Tx } from "@/server/db";
import { randomToken, sha256 } from "@/server/security/crypto";
import { buildQuote, type Quote } from "@/server/checkout/pricing";
import { syncProductAggregates } from "@/server/catalog/sync";
import { createRazorpayOrder, refundRazorpayPayment } from "@/server/payments/razorpay";
import type { CartWithItems } from "@/server/cart/service";
import type { CheckoutInput } from "@/lib/checkout";

export const RESERVATION_MINUTES = 30;

export class OrderError extends Error {}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function orderNumber() {
  const d = new Date();
  const date = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const bytes = randomToken(8);
  let suffix = "";
  for (let i = 0; i < 5; i++) suffix += ALPHABET[bytes.charCodeAt(i) % ALPHABET.length];
  return `OB${date}-${suffix}`;
}

export type PlaceOrderResult = {
  orderId: string;
  number: string;
  accessToken: string | null; // only returned once, for the confirmation link
  next: { type: "done" } | { type: "razorpay"; razorpayOrderId: string; amount: number; currency: string };
};

/** Decrements stock for a line (COD, or late payment after reservation expired). Returns false if not enough stock. */
async function takeStock(tx: Tx, variantId: string, qty: number, orderId: string) {
  const rows = await tx.$queryRaw<{ id: string; onHand: number; productId: string }[]>(Prisma.sql`
    UPDATE "InventoryItem" i SET "onHand" = i."onHand" - ${qty}, "updatedAt" = now()
    FROM "ProductVariant" v
    WHERE i."variantId" = ${variantId} AND v."id" = i."variantId" AND (i."allowBackorder" OR i."onHand" - i."reserved" >= ${qty})
    RETURNING i."id", i."onHand", v."productId"`);
  const r = rows[0];
  if (!r) return false;
  await tx.inventoryTransaction.create({ data: { inventoryId: r.id, delta: -qty, onHandAfter: r.onHand, reason: InventoryReason.SALE, refType: "Order", refId: orderId } });
  return true;
}

/** Holds stock for an unpaid online order. Returns false if not enough is available. */
async function reserveStock(tx: Tx, variantId: string, qty: number, orderId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    UPDATE "InventoryItem" SET "reserved" = "reserved" + ${qty}, "updatedAt" = now()
    WHERE "variantId" = ${variantId} AND ("allowBackorder" OR "onHand" - "reserved" >= ${qty})
    RETURNING "id"`);
  const r = rows[0];
  if (!r) return false;
  await tx.inventoryReservation.create({ data: { inventoryId: r.id, orderId, quantity: qty, expiresAt: new Date(Date.now() + RESERVATION_MINUTES * 60_000) } });
  return true;
}

async function syncProductsForOrder(tx: Tx, orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId }, select: { variant: { select: { productId: true } } } });
  for (const pid of new Set(items.map((i) => i.variant?.productId).filter((x): x is string => !!x))) await syncProductAggregates(pid, tx);
}

export async function placeOrder(input: CheckoutInput, cart: CartWithItems, ctx: { userId: string | null }): Promise<PlaceOrderResult> {
  // Same idempotency key (double click, network retry) returns the same order.
  const existing = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
  if (existing) return resumeResult(existing.id);

  await releaseExpiredReservations();

  const quote = await buildQuote(cart, {
    email: input.email,
    postalCode: input.shipping.postalCode,
    shippingMethod: input.shippingMethod,
    paymentMethod: input.paymentMethod,
    couponCode: input.couponCode,
    userId: ctx.userId,
  });
  if (quote.problems.length) throw new OrderError(quote.problems[0]!);
  if (quote.shippingError || !quote.shippingMethod) throw new OrderError(quote.shippingError ?? "Choose a delivery option.");
  if (input.couponCode && quote.couponError) throw new OrderError(quote.couponError);
  if (input.paymentMethod === "cod" && !quote.payment.cod) throw new OrderError(quote.payment.codReason ?? "Cash on delivery isn't available for this order.");
  if (input.paymentMethod === "razorpay" && !quote.payment.razorpay) throw new OrderError("Online payment isn't available right now. Choose cash on delivery.");

  const accessToken = randomToken();
  const isCod = input.paymentMethod === "cod";
  const billing = input.billingSameAsShipping ? null : input.billing ?? null;

  const order = await db.$transaction(
    async (tx) => {
      const o = await tx.order.create({
        data: {
          number: orderNumber(),
          userId: ctx.userId,
          email: input.email,
          phone: input.phone,
          status: isCod ? "PLACED" : "PENDING_PAYMENT",
          paymentStatus: "PENDING",
          paymentMethod: input.paymentMethod,
          currency: quote.currency,
          subtotal: quote.subtotal,
          discountTotal: quote.discount,
          shippingTotal: quote.shipping,
          taxTotal: quote.tax,
          taxInclusive: quote.taxInclusive,
          giftWrapTotal: quote.giftWrap,
          codFeeTotal: quote.codFee,
          grandTotal: quote.total,
          couponCode: quote.coupon?.code ?? null,
          shippingMethod: quote.shippingMethod,
          shippingAddress: input.shipping as Prisma.InputJsonValue,
          billingAddress: (billing ?? undefined) as Prisma.InputJsonValue | undefined,
          giftWrap: quote.giftWrap > 0,
          giftMessage: cart.giftMessage,
          notes: input.notes || null,
          accessTokenHash: sha256(accessToken),
          idempotencyKey: input.idempotencyKey,
          cartId: cart.id,
          placedAt: isCod ? new Date() : null,
          items: { create: allocateDiscount(quote) },
          events: { create: { status: isCod ? "PLACED" : "PENDING_PAYMENT", message: isCod ? "Order placed (cash on delivery)" : "Waiting for payment" } },
        },
      });
      for (const l of quote.lines) {
        const ok = isCod ? await takeStock(tx, l.variantId, l.quantity, o.id) : await reserveStock(tx, l.variantId, l.quantity, o.id);
        if (!ok) throw new OrderError(`${l.name} (${l.variantTitle}) just sold out. Update your cart and try again.`);
      }
      await tx.payment.create({
        data: { orderId: o.id, provider: input.paymentMethod, amount: quote.total, currency: quote.currency, idempotencyKey: `${o.id}:1`, method: isCod ? "cod" : null },
      });
      if (isCod) await finalizeOrder(tx, o.id);
      if (input.saveAddress && ctx.userId) {
        const count = await tx.address.count({ where: { userId: ctx.userId } });
        await tx.address.create({ data: { ...input.shipping, userId: ctx.userId, isDefault: count === 0 } });
      }
      if (input.marketingOptIn) {
        await tx.newsletterSubscriber.upsert({ where: { email: input.email }, create: { email: input.email, source: "checkout", confirmedAt: new Date() }, update: { unsubscribedAt: null } });
      }
      if (!isCod) for (const l of quote.lines) await syncProductAggregates(l.productId, tx);
      return o;
    },
    { timeout: 20_000, isolationLevel: "ReadCommitted" },
  );

  if (isCod) {
    await sendOrderConfirmation(order.id, accessToken);
    return { orderId: order.id, number: order.number, accessToken, next: { type: "done" } };
  }

  try {
    const rzp = await createRazorpayOrder({ amount: quote.total, currency: quote.currency, receipt: order.number, notes: { order_number: order.number } });
    await db.payment.updateMany({ where: { orderId: order.id }, data: { providerOrderId: rzp.id } });
    return { orderId: order.id, number: order.number, accessToken, next: { type: "razorpay", razorpayOrderId: rzp.id, amount: rzp.amount, currency: rzp.currency } };
  } catch (err) {
    // Couldn't reach the gateway: release the hold so stock isn't stuck.
    await cancelOrder(order.id, { reason: "Payment could not be started", actorId: null, internal: true });
    throw err;
  }
}

/** Spreads the order discount across lines (proportionally) so invoices and refunds stay consistent. */
function allocateDiscount(q: Quote) {
  let left = q.discount;
  return q.lines.map((l, i) => {
    const share = i === q.lines.length - 1 ? left : Math.floor((q.discount * l.lineTotal) / Math.max(1, q.subtotal));
    left -= share;
    return {
      variantId: l.variantId,
      productName: l.name,
      variantTitle: l.variantTitle,
      sku: l.sku,
      imageUrl: l.imageUrl,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      discount: share,
      total: l.lineTotal - share,
    };
  });
}

async function resumeResult(orderId: string): Promise<PlaceOrderResult> {
  const o = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
  const p = o.payments[0];
  if (o.status === "PENDING_PAYMENT" && p?.providerOrderId) {
    return { orderId: o.id, number: o.number, accessToken: null, next: { type: "razorpay", razorpayOrderId: p.providerOrderId, amount: p.amount, currency: p.currency } };
  }
  return { orderId: o.id, number: o.number, accessToken: null, next: { type: "done" } };
}

/** Coupon usage, sales counters and cart conversion: done once, when an order becomes real. */
async function finalizeOrder(tx: Tx, orderId: string) {
  const o = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  if (o.couponCode) {
    const coupon = await tx.coupon.findUnique({ where: { code: o.couponCode } });
    if (coupon) {
      await tx.couponRedemption.upsert({
        where: { couponId_orderId: { couponId: coupon.id, orderId } },
        create: { couponId: coupon.id, orderId, userId: o.userId, email: o.email, amount: o.discountTotal },
        update: {},
      });
      await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
    }
  }
  for (const i of o.items) {
    if (!i.variantId) continue;
    const v = await tx.productVariant.findUnique({ where: { id: i.variantId }, select: { productId: true } });
    if (v) await tx.product.update({ where: { id: v.productId }, data: { salesCount: { increment: i.quantity } } });
  }
  if (o.cartId) {
    await tx.cartItem.deleteMany({ where: { cartId: o.cartId, savedForLater: false } });
    await tx.cart.update({ where: { id: o.cartId }, data: { giftWrap: false, giftMessage: null, couponCode: null, recoveredOrderId: orderId } }).catch(() => undefined);
  }
  await syncProductsForOrder(tx, orderId);
}

/**
 * Marks a Razorpay payment as captured and confirms the order. Idempotent: calling it again (webhook after
 * checkout callback, or webhook redelivery) does nothing.
 */
export async function confirmRazorpayPayment(input: { razorpayOrderId: string; razorpayPaymentId: string; method?: string | null }) {
  const result = await db.$transaction(
    async (tx) => {
      // Conditional update = row lock + exactly-once transition.
      const claimed = await tx.payment.updateMany({
        where: { providerOrderId: input.razorpayOrderId, provider: "razorpay", status: { in: ["PENDING", "FAILED", "AUTHORIZED"] } },
        data: { status: "CAPTURED", providerPaymentId: input.razorpayPaymentId, method: input.method ?? undefined, failureReason: null },
      });
      const payment = await tx.payment.findFirst({ where: { providerOrderId: input.razorpayOrderId, provider: "razorpay" } });
      if (!payment) throw new OrderError("Unknown payment.");
      if (claimed.count === 0) return { orderId: payment.orderId, changed: false };

      const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId }, include: { items: true, reservations: { where: { releasedAt: null } } } });
      let stockIssue = false;
      if (order.reservations.length) {
        // Normal path: convert the hold into a sale.
        for (const r of order.reservations) {
          const rows = await tx.$queryRaw<{ onHand: number }[]>(Prisma.sql`
            UPDATE "InventoryItem" SET "onHand" = "onHand" - ${r.quantity}, "reserved" = GREATEST("reserved" - ${r.quantity}, 0), "updatedAt" = now()
            WHERE "id" = ${r.inventoryId} RETURNING "onHand"`);
          await tx.inventoryReservation.update({ where: { id: r.id }, data: { releasedAt: new Date() } });
          await tx.inventoryTransaction.create({ data: { inventoryId: r.inventoryId, delta: -r.quantity, onHandAfter: rows[0]?.onHand ?? 0, reason: InventoryReason.SALE, refType: "Order", refId: order.id } });
        }
      } else {
        // Paid after the hold expired (or after cancellation): take stock if it's still there.
        for (const i of order.items) {
          if (i.variantId && !(await takeStock(tx, i.variantId, i.quantity, order.id))) stockIssue = true;
        }
      }
      await tx.order.update({
        where: { id: order.id },
        data: { status: "PAYMENT_CONFIRMED", paymentStatus: "CAPTURED", placedAt: order.placedAt ?? new Date(), cancelledAt: null },
      });
      await tx.orderEvent.create({ data: { orderId: order.id, status: "PAYMENT_CONFIRMED", message: "Payment received" } });
      if (stockIssue) {
        await tx.orderEvent.create({ data: { orderId: order.id, status: "PAYMENT_CONFIRMED", isPublic: false, message: "⚠ Paid after the stock hold expired and some items are no longer in stock. Restock or refund." } });
      }
      await finalizeOrder(tx, order.id);
      return { orderId: order.id, changed: true };
    },
    { timeout: 20_000 },
  );
  if (result.changed) await sendOrderConfirmation(result.orderId, null);
  return result;
}

export async function markRazorpayPaymentFailed(razorpayOrderId: string, reason: string) {
  await db.payment.updateMany({ where: { providerOrderId: razorpayOrderId, status: "PENDING" }, data: { status: "FAILED", failureReason: reason.slice(0, 300) } });
}

/** Cancels unpaid online orders whose stock hold has expired, and frees the stock. */
export async function releaseExpiredReservations(now = new Date()) {
  const expired = await db.inventoryReservation.findMany({ where: { releasedAt: null, expiresAt: { lt: now }, order: { status: "PENDING_PAYMENT" } }, select: { orderId: true }, distinct: ["orderId"], take: 100 });
  for (const r of expired) {
    await cancelOrder(r.orderId, { reason: "Payment wasn't completed in time", actorId: null, internal: true }).catch((e) => console.error("[orders] expire", e));
  }
  return expired.length;
}

const CANCELLABLE: OrderStatus[] = ["PENDING_PAYMENT", "PLACED", "PAYMENT_CONFIRMED", "PROCESSING"];

/** Cancels an order, returns stock, and refunds captured online payments in full. */
export async function cancelOrder(orderId: string, opts: { reason: string; actorId: string | null; internal?: boolean; byCustomer?: boolean }) {
  const outcome = await db.$transaction(
    async (tx) => {
      const o = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, reservations: { where: { releasedAt: null } }, payments: true } });
      if (!CANCELLABLE.includes(o.status)) {
        throw new OrderError(opts.byCustomer ? "This order has already been packed or shipped, so it can't be cancelled. You can request a return after delivery." : `Orders in status ${o.status} can't be cancelled.`);
      }
      // Holds (unpaid online orders) → release. Sold stock (COD or paid) → return to stock.
      for (const r of o.reservations) {
        await tx.$executeRaw`UPDATE "InventoryItem" SET "reserved" = GREATEST("reserved" - ${r.quantity}, 0), "updatedAt" = now() WHERE "id" = ${r.inventoryId}`;
        await tx.inventoryReservation.update({ where: { id: r.id }, data: { releasedAt: new Date() } });
      }
      const sold = o.status !== "PENDING_PAYMENT";
      if (sold) {
        for (const i of o.items) {
          if (!i.variantId) continue;
          const rows = await tx.$queryRaw<{ id: string; onHand: number }[]>`
            UPDATE "InventoryItem" SET "onHand" = "onHand" + ${i.quantity}, "updatedAt" = now() WHERE "variantId" = ${i.variantId} RETURNING "id", "onHand"`;
          if (rows[0]) await tx.inventoryTransaction.create({ data: { inventoryId: rows[0].id, delta: i.quantity, onHandAfter: rows[0].onHand, reason: InventoryReason.RELEASE, refType: "Order", refId: o.id, note: "Order cancelled" } });
        }
        if (o.couponCode) {
          const c = await tx.coupon.findUnique({ where: { code: o.couponCode } });
          if (c) {
            const del = await tx.couponRedemption.deleteMany({ where: { couponId: c.id, orderId: o.id } });
            if (del.count) await tx.coupon.update({ where: { id: c.id }, data: { usedCount: { decrement: 1 } } });
          }
        }
      }
      const captured = o.payments.find((p) => p.provider === "razorpay" && p.status === "CAPTURED" && p.providerPaymentId);
      let refundId: string | null = null;
      if (captured) {
        const refundable = captured.amount - captured.refundedAmount;
        if (refundable > 0) {
          const r = await tx.refund.create({ data: { orderId: o.id, paymentId: captured.id, amount: refundable, currency: captured.currency, method: "original", status: "PENDING", reason: opts.reason, idempotencyKey: `cancel:${o.id}`, actorId: opts.actorId } });
          refundId = r.id;
        }
      }
      await tx.order.update({ where: { id: o.id }, data: { status: "CANCELLED", cancelledAt: new Date(), paymentStatus: o.paymentStatus === "PENDING" ? "FAILED" : o.paymentStatus } });
      await tx.orderEvent.create({ data: { orderId: o.id, status: "CANCELLED", message: opts.internal ? opts.reason : `Cancelled: ${opts.reason}`, actorId: opts.actorId } });
      await syncProductsForOrder(tx, o.id);
      return { refundId, email: o.email, sold };
    },
    { timeout: 20_000 },
  );
  if (outcome.refundId) await processRefund(outcome.refundId);
  if (outcome.sold) await sendStatusEmail(orderId, "CANCELLED");
  return outcome;
}

export async function processRefund(refundId: string) {
  const r = await db.refund.findUniqueOrThrow({ where: { id: refundId }, include: { payment: true } });
  if (r.status === "SUCCEEDED" || !r.payment?.providerPaymentId) return r;
  await db.refund.update({ where: { id: r.id }, data: { status: "PROCESSING" } });
  try {
    const res = await refundRazorpayPayment(r.payment.providerPaymentId, r.amount, r.idempotencyKey, { order_id: r.orderId });
    return db.$transaction(async (tx) => {
      const done = await tx.refund.update({ where: { id: r.id }, data: { status: "SUCCEEDED", providerRefundId: res.id } });
      const p = await tx.payment.update({ where: { id: r.paymentId! }, data: { refundedAmount: { increment: r.amount } } });
      const full = p.refundedAmount >= p.amount;
      await tx.payment.update({ where: { id: p.id }, data: { status: full ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
      await tx.order.update({ where: { id: r.orderId }, data: { paymentStatus: full ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
      const ord = await tx.order.findUniqueOrThrow({ where: { id: r.orderId }, select: { status: true } });
      await tx.orderEvent.create({ data: { orderId: r.orderId, status: full ? "REFUNDED" : ord.status, message: `Refund of ₹${r.amount / 100} issued to the original payment method (5–7 business days)` } });
      return done;
    });
  } catch (err) {
    await db.refund.update({ where: { id: r.id }, data: { status: "FAILED" } });
    const ord = await db.order.findUniqueOrThrow({ where: { id: r.orderId }, select: { status: true } });
    await db.orderEvent.create({ data: { orderId: r.orderId, status: ord.status, isPublic: false, message: `⚠ Refund failed: ${err instanceof Error ? err.message : "unknown error"}. Retry from the admin.` } });
    return db.refund.findUniqueOrThrow({ where: { id: r.id } });
  }
}

// ── Fulfilment (admin) ──

const NEXT: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PLACED: ["PROCESSING", "PACKED", "SHIPPED"],
  PAYMENT_CONFIRMED: ["PROCESSING", "PACKED", "SHIPPED"],
  PROCESSING: ["PACKED", "SHIPPED"],
  PACKED: ["SHIPPED"],
  SHIPPED: ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "DELAYED", "DELIVERY_FAILED"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "DELIVERED", "DELAYED", "DELIVERY_FAILED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "DELIVERY_FAILED", "DELAYED"],
  DELAYED: ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "DELIVERY_FAILED"],
  DELIVERY_FAILED: ["OUT_FOR_DELIVERY", "RETURNED"],
};

export function nextStatuses(s: OrderStatus): OrderStatus[] {
  return NEXT[s] ?? [];
}

export async function updateOrderStatus(orderId: string, to: OrderStatus, opts: { actorId: string | null; message?: string; carrier?: string; trackingNumber?: string; trackingUrl?: string; labelUrl?: string; providerRef?: string; location?: string }) {
  await db.$transaction(async (tx) => {
    const o = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { shipments: true, payments: true } });
    if (!nextStatuses(o.status).includes(to)) throw new OrderError(`Can't move an order from ${o.status} to ${to}.`);
    if (to === "SHIPPED") {
      if (!opts.carrier || !opts.trackingNumber) throw new OrderError("Enter the courier and tracking number to mark as shipped.");
      await tx.shipment.create({
        data: { orderId, carrier: opts.carrier, trackingNumber: opts.trackingNumber, trackingUrl: opts.trackingUrl || null, labelUrl: opts.labelUrl ?? null, providerRef: opts.providerRef ?? null, status: "SHIPPED", shippedAt: new Date(), events: { create: { status: "SHIPPED", occurredAt: new Date(), message: "Handed to courier" } } },
      });
    } else if (o.shipments[0]) {
      await tx.shipment.update({ where: { id: o.shipments[0].id }, data: { status: to, ...(to === "DELIVERED" ? { deliveredAt: new Date() } : {}), events: { create: { status: to, occurredAt: new Date(), message: opts.message, location: opts.location } } } });
    }
    // COD: money is collected on delivery.
    if (to === "DELIVERED" && o.paymentMethod === "cod") {
      await tx.payment.updateMany({ where: { orderId, provider: "cod", status: "PENDING" }, data: { status: "CAPTURED" } });
      await tx.order.update({ where: { id: orderId }, data: { paymentStatus: "CAPTURED" } });
    }
    await tx.order.update({ where: { id: orderId }, data: { status: to } });
    await tx.orderEvent.create({ data: { orderId, status: to, message: opts.message || null, actorId: opts.actorId } });
  });
  if (["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "DELAYED", "DELIVERY_FAILED"].includes(to)) await sendStatusEmail(orderId, to);
}

// ── Access ──

/** An order is visible to its signed-in owner, staff, or anyone holding its secret confirmation token. */
export async function findOrderForViewer(number: string, viewer: { userId: string | null; isStaff: boolean; token?: string | null; verifiedEmail?: string | null }) {
  if (!/^OB\d{6}-[A-Z0-9]{5}$/.test(number)) return null;
  const order = await db.order.findUnique({
    where: { number },
    include: {
      items: { include: { variant: { select: { product: { select: { slug: true } } } } } },
      events: { where: { isPublic: true }, orderBy: { createdAt: "asc" } },
      shipments: { orderBy: { createdAt: "desc" } },
      payments: { orderBy: { createdAt: "desc" } },
      refunds: true,
    },
  });
  if (!order) return null;
  const owns = (!!viewer.userId && order.userId === viewer.userId) || viewer.isStaff || (!!viewer.verifiedEmail && !order.userId && order.email === viewer.verifiedEmail);
  const hasToken = !!viewer.token && !!order.accessTokenHash && sha256(viewer.token) === order.accessTokenHash;
  return owns || hasToken ? order : null;
}

// ── Emails ──

async function sendOrderConfirmation(orderId: string, token: string | null) {
  try {
    const { sendEmail, emailLayout, esc, button } = await import("@/server/email");
    const { appUrl } = await import("@/lib/utils");
    const { formatMoney } = await import("@/lib/money");
    const o = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    const link = appUrl(`/order/${o.number}${token ? `?t=${encodeURIComponent(token)}` : ""}`);
    const rows = o.items.map((i) => `<tr><td style="padding:4px 0">${esc(i.productName)} <span style="color:#888">(${esc(i.variantTitle)}) × ${i.quantity}</span></td><td align="right">${formatMoney(i.total, o.currency)}</td></tr>`).join("");
    await sendEmail({
      to: o.email,
      userId: o.userId,
      template: "order.confirmation",
      subject: `Order ${o.number} confirmed`,
      text: `Thanks for your order ${o.number}. Total ${formatMoney(o.grandTotal, o.currency)}${o.paymentMethod === "cod" ? " (pay on delivery)" : ""}. Track it: ${link}`,
      html: emailLayout(
        `Thanks! Order ${o.number} is confirmed`,
        `<table width="100%" style="font-size:14px">${rows}<tr><td style="padding-top:8px"><b>Total</b></td><td align="right"><b>${formatMoney(o.grandTotal, o.currency)}</b></td></tr></table>${o.paymentMethod === "cod" ? "<p>Please keep the amount ready for cash on delivery.</p>" : ""}${button(link, "View or track your order")}`,
      ),
    });
  } catch (err) {
    console.error("[orders] confirmation email failed", err);
  }
}

async function sendStatusEmail(orderId: string, status: OrderStatus) {
  try {
    const { sendEmail, emailLayout, button } = await import("@/server/email");
    const { appUrl } = await import("@/lib/utils");
    const { ORDER_STATUS_LABEL } = await import("@/lib/checkout");
    const o = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { shipments: { take: 1, orderBy: { createdAt: "desc" } } } });
    const label = ORDER_STATUS_LABEL[status] ?? status;
    const s = o.shipments[0];
    const extra = status === "SHIPPED" && s ? `<p>Courier: ${s.carrier} · Tracking number: <b>${s.trackingNumber}</b></p>` : "";
    await sendEmail({
      to: o.email,
      userId: o.userId,
      template: `order.${status.toLowerCase()}`,
      subject: `Order ${o.number}: ${label}`,
      text: `Your order ${o.number} is now: ${label}. ${s?.trackingNumber ? `Tracking: ${s.carrier} ${s.trackingNumber}. ` : ""}Track it: ${appUrl(`/track?order=${o.number}`)}`,
      html: emailLayout(`${label}`, `<p>Your order <b>${o.number}</b> is now <b>${label.toLowerCase()}</b>.</p>${extra}${button(appUrl(`/track?order=${o.number}`), "Track your order")}`),
    });
  } catch (err) {
    console.error("[orders] status email failed", err);
  }
}

