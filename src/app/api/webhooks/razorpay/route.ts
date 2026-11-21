import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { getIntegrations } from "@/server/integrations";
import { verifyWebhookSignature } from "@/server/payments/razorpay";
import { confirmRazorpayPayment, markRazorpayPaymentFailed } from "@/server/orders/service";

// Razorpay → Admin → Integrations shows this URL. Events: payment.captured, payment.failed, order.paid.
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const secret = (await getIntegrations()).razorpay?.webhookSecret;
  if (!secret) return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
  if (!signature || !verifyWebhookSignature(raw, signature, secret)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  let event: { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string; method?: string; error_description?: string } } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }
  const eventId = req.headers.get("x-razorpay-event-id") ?? `${event.event}:${event.payload?.payment?.entity?.id}`;
  // Redelivered events are recorded once and processed once.
  try {
    await db.paymentEvent.create({ data: { provider: "razorpay", providerEventId: eventId, type: event.event ?? "unknown", payload: JSON.parse(raw) } });
  } catch {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const pay = event.payload?.payment?.entity;
  try {
    if ((event.event === "payment.captured" || event.event === "order.paid") && pay?.id && pay.order_id) {
      await confirmRazorpayPayment({ razorpayOrderId: pay.order_id, razorpayPaymentId: pay.id, method: pay.method });
    } else if (event.event === "payment.failed" && pay?.order_id) {
      await markRazorpayPaymentFailed(pay.order_id, pay.error_description ?? "Payment failed");
    }
    await db.paymentEvent.update({ where: { provider_providerEventId: { provider: "razorpay", providerEventId: eventId } }, data: { processedAt: new Date() } });
  } catch (err) {
    console.error("[webhook razorpay]", err);
    // Let Razorpay retry: remove the record so the redelivery is processed.
    await db.paymentEvent.delete({ where: { provider_providerEventId: { provider: "razorpay", providerEventId: eventId } } }).catch(() => undefined);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
