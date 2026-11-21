// Checkout quote: the single source of truth for what the customer pays. Never trusts client prices.
import type { CartWithItems } from "@/server/cart/service";
import { availableQuantity } from "@/server/inventory/service";
import { estimateDelivery, type DeliveryOption } from "@/server/shipping/estimate";
import { evaluateCoupon, type PricedLine } from "@/server/checkout/coupons";
import { getStoreSettings } from "@/server/settings";
import { getIntegrations } from "@/server/integrations";
import { inclusiveTax } from "@/lib/money";
import type { PaymentMethod } from "@/lib/checkout";
import { checkGiftCard, redeemablePoints } from "@/server/rewards/service";

export type QuoteLine = PricedLine & {
  variantId: string;
  name: string;
  variantTitle: string;
  sku: string;
  slug: string;
  imageUrl: string | null;
  lineTotal: number;
  available: number;
};

export type Quote = {
  currency: string;
  lines: QuoteLine[];
  itemCount: number;
  subtotal: number;
  discount: number;
  coupon: { code: string; label: string } | null;
  couponError: string | null;
  shippingOptions: DeliveryOption[];
  shippingMethod: string | null;
  shipping: number;
  shippingError: string | null;
  giftWrap: number;
  codFee: number;
  tax: number;
  taxInclusive: boolean;
  taxLabel: string;
  /** Amount the customer still pays after gift card and points. */
  total: number;
  grossTotal: number;
  points: { balance: number; available: number; availableValue: number; applied: number; value: number; reason: string | null; earn: number } | null;
  giftCard: { id: string; last4: string; applied: number; remaining: number } | null;
  giftCardError: string | null;
  payment: { razorpay: boolean; razorpayMode: "test" | "live" | null; cod: boolean; codReason: string | null };
  problems: string[];
};

export async function buildQuote(
  cart: CartWithItems | null,
  input: { email?: string; postalCode?: string; shippingMethod?: string; paymentMethod?: PaymentMethod; couponCode?: string; userId?: string | null; giftCardCode?: string; usePoints?: boolean },
): Promise<Quote> {
  const s = await getStoreSettings();
  const integ = await getIntegrations();
  const problems: string[] = [];
  const currency = cart?.currency ?? s.baseCurrency;

  const lines: QuoteLine[] = (cart?.items ?? [])
    .filter((i) => !i.savedForLater)
    .map((i) => {
      const v = i.variant;
      const available = v.product.status === "ACTIVE" && v.isActive ? Math.min(availableQuantity(v.inventory), s.maxQtyPerLine) : 0;
      if (available <= 0) problems.push(`${v.product.name} (${v.title}) is no longer available. Remove it to continue.`);
      else if (i.quantity > available) problems.push(`Only ${available} of ${v.product.name} (${v.title}) available. Reduce the quantity to continue.`);
      return {
        variantId: v.id,
        productId: v.product.id,
        categoryId: v.product.categoryId,
        franchiseId: v.product.franchiseId,
        name: v.product.name,
        variantTitle: v.title,
        sku: v.sku,
        slug: v.product.slug,
        imageUrl: v.product.images[0]?.url ?? null,
        unitPrice: v.price,
        quantity: i.quantity,
        lineTotal: v.price * i.quantity,
        available,
      };
    });
  if (!lines.length) problems.push("Your cart is empty.");

  const subtotal = lines.reduce((n, l) => n + l.lineTotal, 0);

  let discount = 0;
  let freeShipping = false;
  let coupon: Quote["coupon"] = null;
  let couponError: string | null = null;
  if (input.couponCode && lines.length) {
    const r = await evaluateCoupon(input.couponCode, { lines, email: input.email, userId: input.userId });
    if (r.ok) {
      discount = Math.min(r.discount, subtotal);
      freeShipping = r.freeShipping;
      coupon = { code: r.coupon.code, label: r.label };
    } else couponError = r.error;
  }
  const merchandise = subtotal - discount;

  let shippingOptions: DeliveryOption[] = [];
  let shippingError: string | null = null;
  if (input.postalCode) {
    const est = await estimateDelivery({ country: "IN", postalCode: input.postalCode, subtotal: merchandise });
    // Free-shipping coupons cover standard delivery; faster options keep their price.
    if (est.ok) shippingOptions = est.options.map((o) => (freeShipping && o.code === "standard" ? { ...o, cost: 0, free: true } : o));
    else shippingError = est.error;
  }
  const chosen = shippingOptions.find((o) => o.code === input.shippingMethod) ?? shippingOptions[0] ?? null;
  const shipping = chosen?.cost ?? 0;

  const giftWrap = cart?.giftWrap && lines.length ? s.giftWrapPrice : 0;
  const taxInclusive = s.taxInclusive;
  const tax = taxInclusive ? inclusiveTax(merchandise, s.taxRateBps) : Math.round((merchandise * s.taxRateBps) / 10_000);

  // Cash on delivery eligibility
  let codReason: string | null = null;
  if (!s.cod.enabled) codReason = "Cash on delivery isn't offered right now.";
  const preCodTotal = merchandise + shipping + giftWrap + (taxInclusive ? 0 : tax);
  if (!codReason && s.cod.maxOrder > 0 && preCodTotal > s.cod.maxOrder) codReason = `Cash on delivery is available for orders up to ₹${s.cod.maxOrder / 100}.`;
  const cod = !codReason;
  const razorpay = !!integ.razorpay;
  if (!razorpay && !cod) problems.push("No payment method is available right now. Please contact us.");

  // Reward points, then gift card, reduce what's left to pay.
  let points: Quote["points"] = null;
  let left = preCodTotal;
  if (input.userId && s.loyalty.enabled) {
    const r = await redeemablePoints(input.userId, preCodTotal);
    const applied = input.usePoints ? r.points : 0;
    left -= applied * s.loyalty.pointValue;
    points = { balance: r.balance, available: r.points, availableValue: r.value, applied, value: applied * s.loyalty.pointValue, reason: r.reason, earn: 0 };
  }
  let giftCard: Quote["giftCard"] = null;
  let giftCardError: string | null = null;
  if (input.giftCardCode) {
    const g = await checkGiftCard(input.giftCardCode, currency);
    if (g.ok) {
      const applied = Math.min(g.balance, left);
      left -= applied;
      giftCard = { id: g.id, last4: g.last4, applied, remaining: g.balance - applied };
    } else giftCardError = g.error;
  }
  const codFee = input.paymentMethod === "cod" && cod && left > 0 ? s.cod.fee : 0;
  const total = left + codFee;
  const grossTotal = preCodTotal + codFee;
  if (points && s.loyalty.pointsPer100) points.earn = Math.floor(((total + (giftCard?.applied ?? 0)) / 10_000) * s.loyalty.pointsPer100);

  if (input.postalCode && !chosen && !shippingError) shippingError = "Delivery isn't available to this PIN code.";

  return {
    currency,
    lines,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal,
    discount,
    coupon,
    couponError,
    shippingOptions,
    shippingMethod: chosen?.code ?? null,
    shipping,
    shippingError,
    giftWrap,
    codFee,
    tax,
    taxInclusive,
    taxLabel: s.taxLabel,
    total,
    grossTotal,
    points,
    giftCard,
    giftCardError,
    payment: { razorpay, razorpayMode: integ.razorpay?.mode ?? null, cod, codReason },
    problems,
  };
}
