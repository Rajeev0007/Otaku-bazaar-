// Coupon engine. Always evaluated on the server against database prices.
import type { Coupon } from "@prisma/client";
import { db } from "@/server/db";

export type PricedLine = { productId: string; categoryId: string; franchiseId: string | null; unitPrice: number; quantity: number };

export type CouponResult =
  | { ok: true; coupon: Coupon; discount: number; freeShipping: boolean; label: string }
  | { ok: false; error: string };

export async function evaluateCoupon(rawCode: string, ctx: { lines: PricedLine[]; email?: string | null; userId?: string | null; now?: Date }): Promise<CouponResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter a coupon code." };
  const coupon = await db.coupon.findUnique({ where: { code } });
  const now = ctx.now ?? new Date();
  if (!coupon || !coupon.isActive) return { ok: false, error: "This coupon code isn't valid." };
  if (coupon.startsAt && coupon.startsAt > now) return { ok: false, error: "This coupon isn't active yet." };
  if (coupon.endsAt && coupon.endsAt <= now) return { ok: false, error: "This coupon has expired." };
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return { ok: false, error: "This coupon has reached its usage limit." };
  if (coupon.type === "BUNDLE") return { ok: false, error: "This coupon can't be used online." };

  const email = ctx.email?.trim().toLowerCase();
  if (coupon.perCustomerLimit !== null || coupon.firstOrderOnly) {
    if (!email) return { ok: false, error: "Enter your email first to use this coupon." };
  }
  if (coupon.perCustomerLimit !== null && email) {
    const used = await db.couponRedemption.count({ where: { couponId: coupon.id, email } });
    if (used >= coupon.perCustomerLimit) return { ok: false, error: "You've already used this coupon." };
  }
  if (coupon.firstOrderOnly && email) {
    const prior = await db.order.count({ where: { email, status: { notIn: ["PENDING_PAYMENT", "CANCELLED"] } } });
    if (prior > 0) return { ok: false, error: "This coupon is for first orders only." };
  }

  const subtotal = ctx.lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0);
  if (subtotal < coupon.minSubtotal) {
    return { ok: false, error: `Add items worth ₹${Math.ceil((coupon.minSubtotal - subtotal) / 100)} more to use this coupon.` };
  }
  const restricted = coupon.productIds.length || coupon.categoryIds.length || coupon.franchiseIds.length;
  const eligible = restricted
    ? ctx.lines.filter((l) => coupon.productIds.includes(l.productId) || coupon.categoryIds.includes(l.categoryId) || (!!l.franchiseId && coupon.franchiseIds.includes(l.franchiseId)))
    : ctx.lines;
  if (!eligible.length && coupon.type !== "FREE_SHIPPING") return { ok: false, error: "This coupon doesn't apply to the items in your cart." };
  const eligibleSubtotal = eligible.reduce((n, l) => n + l.unitPrice * l.quantity, 0);

  let discount = 0;
  let label = coupon.code;
  switch (coupon.type) {
    case "PERCENT":
      discount = Math.floor((eligibleSubtotal * Math.min(100, coupon.value)) / 100);
      label = `${coupon.value}% off`;
      break;
    case "FIXED":
      discount = Math.min(coupon.value, eligibleSubtotal);
      label = `₹${coupon.value / 100} off`;
      break;
    case "FREE_SHIPPING":
      label = "Free shipping";
      break;
    case "BOGO": {
      // Buy one, get one: in each pair of eligible units, the cheaper one is free.
      const units = eligible.flatMap((l) => Array.from({ length: l.quantity }, () => l.unitPrice)).sort((a, b) => b - a);
      discount = units.reduce((n, p, i) => (i % 2 === 1 ? n + p : n), 0);
      if (!discount) return { ok: false, error: "Add at least two eligible items to use this offer." };
      label = "Buy 1 get 1";
      break;
    }
  }
  if (coupon.maxDiscount !== null) discount = Math.min(discount, coupon.maxDiscount);
  return { ok: true, coupon, discount, freeShipping: coupon.type === "FREE_SHIPPING", label };
}
