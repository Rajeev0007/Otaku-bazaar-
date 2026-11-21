// Razorpay adapter. Card/UPI details are entered in Razorpay's hosted checkout and never reach our servers.
// Docs: Orders API, Payment signature verification, Webhook signature verification, Refunds API.
import { createHmac } from "node:crypto";
import { safeEqual } from "@/server/security/crypto";
import { getIntegrations } from "@/server/integrations";

const API = "https://api.razorpay.com/v1";

export class PaymentGatewayError extends Error {}

async function creds() {
  const r = (await getIntegrations()).razorpay;
  if (!r) throw new PaymentGatewayError("Online payments are not connected yet. Choose cash on delivery or try again later.");
  return r;
}

async function call<T>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
  const { keyId, keySecret } = await creds();
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "X-Razorpay-Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!res.ok) {
    console.error("[razorpay]", path, res.status, json?.error?.description);
    throw new PaymentGatewayError(json?.error?.description ?? `Payment provider error (${res.status}).`);
  }
  return json;
}

export async function createRazorpayOrder(input: { amount: number; currency: string; receipt: string; notes?: Record<string, string> }) {
  // payment_capture=1 captures automatically, so money is not auto-refunded after a few days.
  return call<{ id: string; amount: number; currency: string; status: string }>("/orders", { ...input, payment_capture: 1 });
}

export async function refundRazorpayPayment(paymentId: string, amount: number, idempotencyKey: string, notes?: Record<string, string>) {
  return call<{ id: string; status: string; amount: number }>(`/payments/${encodeURIComponent(paymentId)}/refund`, { amount, speed: "normal", notes }, idempotencyKey);
}

/** Checkout handler signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, keySecret: string) {
  const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqual(expected, signature);
}

/** Webhook signature: HMAC_SHA256(raw request body, webhook_secret), sent in X-Razorpay-Signature. */
export function verifyWebhookSignature(rawBody: string, signature: string, webhookSecret: string) {
  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}

export async function razorpayPublicConfig() {
  const r = (await getIntegrations()).razorpay;
  return r ? { keyId: r.keyId, mode: r.mode } : null;
}

export async function razorpaySecrets() {
  return creds();
}
