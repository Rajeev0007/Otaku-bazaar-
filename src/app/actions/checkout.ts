"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { checkoutSchema, quoteSchema } from "@/lib/checkout";
import { buildQuote, type Quote } from "@/server/checkout/pricing";
import { getCurrentCart } from "@/server/shopper";
import { getCurrentUser } from "@/server/auth/session";
import { cancelOrder, confirmRazorpayPayment, markRazorpayPaymentFailed, OrderError, placeOrder } from "@/server/orders/service";
import { PaymentGatewayError, razorpaySecrets, verifyCheckoutSignature } from "@/server/payments/razorpay";
import { enforceRateLimit, RateLimitError } from "@/server/security/rate-limit";
import { clientIp } from "@/server/request";
import { db } from "@/server/db";
import { sign } from "@/server/security/crypto";
import { getAuthSecret } from "@/server/secrets";
import { fieldErrors } from "@/lib/validation";
import { orderAccessCookie } from "@/server/orders/access";

export async function quoteAction(raw: unknown): Promise<Quote> {
  const input = quoteSchema.parse(raw);
  const user = await getCurrentUser();
  return buildQuote(await getCurrentCart(), { ...input, email: input.email || user?.email, userId: user?.id });
}

export type PlaceOrderResponse =
  | { ok: true; number: string; token: string | null; next: { type: "done" } | { type: "razorpay"; keyId: string; razorpayOrderId: string; amount: number; currency: string } }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function placeOrderAction(raw: unknown): Promise<PlaceOrderResponse> {
  try {
    await enforceRateLimit(`checkout:${await clientIp()}`, 20, 10 * 60);
    const input = checkoutSchema.parse(raw);
    const user = await getCurrentUser();
    const cart = await getCurrentCart();
    if (!cart) return { ok: false, error: "Your cart is empty." };
    const r = await placeOrder(input, cart, { userId: user?.id ?? null });
    // Lets this browser view the order page even without the emailed link.
    await grantOrderAccess(r.number);
    if (r.next.type === "razorpay") {
      const { keyId } = await razorpaySecrets();
      return { ok: true, number: r.number, token: r.accessToken, next: { ...r.next, keyId } };
    }
    return { ok: true, number: r.number, token: r.accessToken, next: { type: "done" } };
  } catch (err) {
    if (err instanceof z.ZodError) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: fieldErrors(err) };
    if (err instanceof OrderError || err instanceof PaymentGatewayError || err instanceof RateLimitError) return { ok: false, error: err.message };
    console.error("[checkout]", err);
    return { ok: false, error: "We couldn't place your order. Nothing was charged. Please try again." };
  }
}

async function grantOrderAccess(number: string) {
  const c = orderAccessCookie(number);
  (await cookies()).set(c.name, sign(number, await getAuthSecret()), c.options);
}

const verifySchema = z.object({
  razorpay_order_id: z.string().min(5).max(64),
  razorpay_payment_id: z.string().min(5).max(64),
  razorpay_signature: z.string().min(16).max(256),
});

/** Called by the browser after Razorpay checkout succeeds. The signature proves Razorpay sent it. */
export async function verifyPaymentAction(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const p = verifySchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "Invalid payment response." };
  const { keySecret } = await razorpaySecrets();
  if (!verifyCheckoutSignature(p.data.razorpay_order_id, p.data.razorpay_payment_id, p.data.razorpay_signature, keySecret)) {
    return { ok: false, error: "We couldn't verify this payment. If money was debited, it will be confirmed automatically or refunded." };
  }
  await confirmRazorpayPayment({ razorpayOrderId: p.data.razorpay_order_id, razorpayPaymentId: p.data.razorpay_payment_id });
  return { ok: true };
}

export async function paymentFailedAction(razorpayOrderId: string, reason: string) {
  await markRazorpayPaymentFailed(z.string().max(64).parse(razorpayOrderId), z.string().max(300).catch("Payment failed").parse(reason));
}

/** Re-opens Razorpay for an unpaid order (same Razorpay order, so no duplicate charge). */
export async function resumePaymentAction(number: string): Promise<PlaceOrderResponse> {
  const user = await getCurrentUser();
  const { canViewOrder } = await import("@/server/orders/access");
  const order = await canViewOrder(number, user);
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status !== "PENDING_PAYMENT") return { ok: false, error: "This order doesn't need payment." };
  const p = order.payments.find((x) => x.provider === "razorpay" && x.providerOrderId);
  if (!p?.providerOrderId) return { ok: false, error: "Payment can't be resumed. Please place the order again." };
  const { keyId } = await razorpaySecrets();
  return { ok: true, number, token: null, next: { type: "razorpay", keyId, razorpayOrderId: p.providerOrderId, amount: p.amount, currency: p.currency } };
}

export async function customerCancelAction(number: string, reason: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  try {
    const user = await getCurrentUser();
    const { canViewOrder } = await import("@/server/orders/access");
    const order = await canViewOrder(number, user);
    if (!order) return { ok: false, error: "Order not found." };
    const r = await cancelOrder(order.id, { reason: z.string().trim().min(3, "Tell us why you're cancelling").max(300).parse(reason), actorId: user?.id ?? null, byCustomer: true });
    const { sendDueStockAlerts } = await import("@/server/inventory/alerts");
    await sendDueStockAlerts().catch(() => undefined);
    return { ok: true, message: r.refundId ? "Order cancelled. Your refund has been started and reaches your account in 5–7 business days." : "Order cancelled." };
  } catch (err) {
    if (err instanceof OrderError) return { ok: false, error: err.message };
    if (err instanceof z.ZodError) return { ok: false, error: err.issues[0]?.message ?? "Invalid reason." };
    throw err;
  }
}

/** Guest order lookup with order number + email. Rate limited; grants access via a signed cookie. */
export async function trackOrderAction(_: unknown, form: FormData): Promise<{ error?: string; number?: string } | null> {
  try {
    await enforceRateLimit(`track:${await clientIp()}`, 10, 15 * 60);
  } catch (err) {
    if (err instanceof RateLimitError) return { error: err.message };
    throw err;
  }
  const number = String(form.get("number") ?? "").trim().toUpperCase();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const order = /^OB\d{6}-[A-Z0-9]{5}$/.test(number) ? await db.order.findUnique({ where: { number }, select: { email: true } }) : null;
  if (!order || order.email !== email) return { error: "We couldn't find an order with that number and email." };
  await grantOrderAccess(number);
  return { number };
}


export async function requestReturnAction(number: string, raw: unknown): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const { requestReturn, ReturnError } = await import("@/server/returns/service");
  const { canViewOrder } = await import("@/server/orders/access");
  try {
    await enforceRateLimit(`return:${await clientIp()}`, 10, 60 * 60);
    const user = await getCurrentUser();
    const order = await canViewOrder(number, user);
    if (!order) return { ok: false, error: "Order not found." };
    const r = await requestReturn(order.id, raw, user?.id ?? null);
    return { ok: true, message: `Request ${r.number} sent. We'll email you within 2 business days.` };
  } catch (err) {
    if (err instanceof ReturnError || err instanceof RateLimitError) return { ok: false, error: err.message };
    if (err instanceof z.ZodError) return { ok: false, error: err.issues[0]?.message ?? "Please check the form." };
    throw err;
  }
}
