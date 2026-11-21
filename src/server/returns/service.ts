// Returns, exchanges and replacements: request → approve/reject → receive (restock) → refund or exchange.
import { InventoryReason, type ReturnStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/server/db";
import { randomToken } from "@/server/security/crypto";
import { processRefund } from "@/server/orders/service";

export class ReturnError extends Error {}

const DEFAULT_WINDOW_DAYS = 7;

export const RETURN_REASONS = ["Wrong size / fit", "Damaged or defective", "Wrong item received", "Not as described", "Quality not as expected", "Changed my mind", "Other"] as const;

export type ReturnableItem = { orderItemId: string; name: string; variantTitle: string; imageUrl: string | null; maxQty: number; unitRefund: number; deadline: Date | null; reason: string | null };

/** What can still be returned from an order, and until when. */
export async function returnableItems(orderId: string): Promise<{ items: ReturnableItem[]; deliveredAt: Date | null }> {
  const o = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      items: { include: { variant: { include: { product: { include: { category: { select: { returnWindowDays: true } } } } } } } },
      shipments: { orderBy: { createdAt: "desc" }, take: 1 },
      events: { where: { status: "DELIVERED" }, orderBy: { createdAt: "asc" }, take: 1 },
      returns: { where: { status: { notIn: ["REJECTED", "CLOSED"] } }, include: { items: true } },
    },
  });
  const deliveredAt = o.shipments[0]?.deliveredAt ?? o.events[0]?.createdAt ?? null;
  const pending = new Map<string, number>();
  for (const r of o.returns) if (!["RECEIVED", "REFUNDED", "EXCHANGED"].includes(r.status)) for (const i of r.items) pending.set(i.orderItemId, (pending.get(i.orderItemId) ?? 0) + i.quantity);

  const items = o.items.map((i) => {
    const product = i.variant?.product;
    const days = product?.returnWindowDays ?? product?.category.returnWindowDays ?? DEFAULT_WINDOW_DAYS;
    const deadline = deliveredAt ? new Date(deliveredAt.getTime() + days * 86_400_000) : null;
    const left = i.quantity - i.returnedQty - (pending.get(i.id) ?? 0);
    let reason: string | null = null;
    if (!["DELIVERED", "RETURNED"].includes(o.status) || !deliveredAt) reason = "Returns open after delivery";
    else if (product && !product.returnable) reason = "This item can't be returned";
    else if (days <= 0) reason = "This item can't be returned";
    else if (deadline && deadline < new Date()) reason = `Return window ended ${deadline.toLocaleDateString("en-IN")}`;
    else if (left <= 0) reason = "Already returned or requested";
    return { orderItemId: i.id, name: i.productName, variantTitle: i.variantTitle, imageUrl: i.imageUrl, maxQty: reason ? 0 : left, unitRefund: Math.floor(i.total / i.quantity), deadline, reason };
  });
  return { items, deliveredAt };
}

export const returnRequestSchema = z.object({
  kind: z.enum(["RETURN", "EXCHANGE", "REPLACEMENT"]),
  reason: z.enum(RETURN_REASONS),
  details: z.string().trim().max(1000).optional().default(""),
  items: z.array(z.object({ orderItemId: z.string().max(40), quantity: z.coerce.number().int().min(1).max(50) })).min(1, "Choose at least one item"),
  photos: z.array(z.string().max(500)).max(6).optional().default([]),
});

export async function requestReturn(orderId: string, raw: unknown, userId: string | null) {
  const input = returnRequestSchema.parse(raw);
  const { items } = await returnableItems(orderId);
  for (const r of input.items) {
    const it = items.find((x) => x.orderItemId === r.orderItemId);
    if (!it) throw new ReturnError("Item not found in this order.");
    if (r.quantity > it.maxQty) throw new ReturnError(it.reason ?? `You can return at most ${it.maxQty} of ${it.name}.`);
  }
  const o = await db.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true, paymentMethod: true } });
  const rr = await db.$transaction(async (tx) => {
    const created = await tx.returnRequest.create({
      data: {
        number: `RT-${randomToken(6).toUpperCase().replace(/[^A-Z0-9]/g, "X").slice(0, 7)}`,
        orderId,
        userId,
        kind: input.kind,
        reason: input.reason,
        details: input.details || null,
        photos: input.photos,
        refundMethod: input.kind === "RETURN" ? (o.paymentMethod === "cod" ? "bank_transfer" : "original") : null,
        items: { create: input.items.map((i) => ({ orderItemId: i.orderItemId, quantity: i.quantity })) },
      },
    });
    await tx.orderEvent.create({ data: { orderId, status: o.status, message: `${input.kind === "RETURN" ? "Return" : input.kind === "EXCHANGE" ? "Exchange" : "Replacement"} requested (${created.number}): ${input.reason}` } });
    return created;
  });
  await notify(rr.id, "requested");
  return rr;
}

/** Amount to refund for a return: the price actually paid for those units (after discount). */
export async function suggestedRefund(returnId: string) {
  const r = await db.returnRequest.findUniqueOrThrow({ where: { id: returnId }, include: { items: { include: { orderItem: true } } } });
  return r.items.reduce((n, i) => n + Math.floor((i.orderItem.total * i.quantity) / i.orderItem.quantity), 0);
}

const ALLOWED: Record<string, ReturnStatus[]> = {
  REQUESTED: ["APPROVED", "REJECTED"],
  APPROVED: ["PICKUP_SCHEDULED", "RECEIVED", "REJECTED"],
  PICKUP_SCHEDULED: ["RECEIVED"],
  RECEIVED: ["REFUNDED", "EXCHANGED", "CLOSED"],
};

export function nextReturnStatuses(s: ReturnStatus): ReturnStatus[] {
  return ALLOWED[s] ?? [];
}

export async function updateReturn(
  returnId: string,
  to: ReturnStatus,
  opts: { actorId: string; note?: string; restock?: boolean; refundAmount?: number; trackingNumber?: string },
) {
  const r = await db.returnRequest.findUniqueOrThrow({ where: { id: returnId }, include: { items: { include: { orderItem: true } }, order: { include: { payments: true, items: true } } } });
  if (!nextReturnStatuses(r.status).includes(to)) throw new ReturnError(`Can't move a return from ${r.status} to ${to}.`);
  if (to === "REFUNDED" && r.kind !== "RETURN") throw new ReturnError("Exchanges and replacements are completed with “Exchanged”, not refunded.");

  let refundId: string | null = null;
  await db.$transaction(async (tx) => {
    if (to === "RECEIVED") {
      for (const i of r.items) {
        await tx.orderItem.update({ where: { id: i.orderItemId }, data: { returnedQty: { increment: i.quantity } } });
        if (opts.restock && i.orderItem.variantId) {
          const rows = await tx.$queryRaw<{ id: string; onHand: number }[]>`
            UPDATE "InventoryItem" SET "onHand" = "onHand" + ${i.quantity}, "updatedAt" = now() WHERE "variantId" = ${i.orderItem.variantId} RETURNING "id", "onHand"`;
          if (rows[0]) await tx.inventoryTransaction.create({ data: { inventoryId: rows[0].id, delta: i.quantity, onHandAfter: rows[0].onHand, reason: InventoryReason.RETURN, refType: "Return", refId: r.id, actorId: opts.actorId } });
        }
      }
      const items = await tx.orderItem.findMany({ where: { orderId: r.orderId } });
      if (items.every((i) => i.returnedQty >= i.quantity) && r.kind === "RETURN") {
        await tx.order.update({ where: { id: r.orderId }, data: { status: "RETURNED" } });
      }
    }
    if (to === "REFUNDED") {
      const amount = opts.refundAmount ?? (await suggestedRefund(r.id));
      const captured = r.order.payments.find((p) => p.provider === "razorpay" && (p.status === "CAPTURED" || p.status === "PARTIALLY_REFUNDED") && p.providerPaymentId);
      if (amount <= 0) throw new ReturnError("Refund amount must be more than ₹0.");
      if (captured) {
        if (amount > captured.amount - captured.refundedAmount) throw new ReturnError("That's more than the amount left to refund on this payment.");
        const ref = await tx.refund.create({ data: { orderId: r.orderId, paymentId: captured.id, returnId: r.id, amount, currency: r.order.currency, method: "original", status: "PENDING", reason: `Return ${r.number}`, idempotencyKey: `return:${r.id}`, actorId: opts.actorId } });
        refundId = ref.id;
      } else {
        // Cash on delivery: the owner pays the customer by bank transfer/UPI and records it here.
        await tx.refund.create({ data: { orderId: r.orderId, returnId: r.id, amount, currency: r.order.currency, method: "bank_transfer", status: "SUCCEEDED", reason: `Return ${r.number} (paid manually)`, idempotencyKey: `return:${r.id}`, actorId: opts.actorId } });
        await tx.orderEvent.create({ data: { orderId: r.orderId, status: r.order.status, message: `Refund of ₹${amount / 100} sent by bank transfer/UPI for return ${r.number}` } });
      }
    }
    await tx.returnRequest.update({ where: { id: r.id }, data: { status: to, adminNote: opts.note || undefined, trackingNumber: opts.trackingNumber || undefined } });
  });
  if (refundId) {
    const res = await processRefund(refundId);
    if (res.status !== "SUCCEEDED") throw new ReturnError("Razorpay refund failed. Check the order page and retry.");
  }
  await notify(r.id, to.toLowerCase());
  return db.returnRequest.findUniqueOrThrow({ where: { id: r.id } });
}

async function notify(returnId: string, what: string) {
  try {
    const { sendEmail, emailLayout, button } = await import("@/server/email");
    const { appUrl } = await import("@/lib/utils");
    const r = await db.returnRequest.findUniqueOrThrow({ where: { id: returnId }, include: { order: { select: { email: true, number: true, userId: true } } } });
    const msgs: Record<string, string> = {
      requested: "We've received your request and will review it within 2 business days.",
      approved: "Your request is approved. Please pack the item(s) with tags; we'll arrange a pickup or share return instructions.",
      rejected: `Unfortunately we couldn't approve this request.${r.adminNote ? ` Reason: ${r.adminNote}` : ""}`,
      pickup_scheduled: `A pickup has been scheduled${r.trackingNumber ? ` (tracking ${r.trackingNumber})` : ""}.`,
      received: "We've received the returned item(s) and are checking them.",
      refunded: "Your refund has been issued. Bank refunds usually take 5–7 business days to appear.",
      exchanged: "Your exchange/replacement is on its way.",
      closed: "This request is now closed.",
    };
    const link = appUrl(`/track?order=${r.order.number}`);
    await sendEmail({
      to: r.order.email,
      userId: r.order.userId,
      template: `return.${what}`,
      subject: `Return ${r.number} for order ${r.order.number}: ${what.replace("_", " ")}`,
      text: `${msgs[what] ?? ""} Order: ${link}`,
      html: emailLayout(`Return ${r.number}`, `<p>${msgs[what] ?? ""}</p>${button(link, "View order")}`),
    });
  } catch (err) {
    console.error("[returns] email failed", err);
  }
}
