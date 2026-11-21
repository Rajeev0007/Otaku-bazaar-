import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { canViewOrder } from "@/server/orders/access";
import { releaseExpiredReservations, RESERVATION_MINUTES } from "@/server/orders/service";
import { ORDER_STATUS_LABEL, TIMELINE } from "@/lib/checkout";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { FormSuccess } from "@/components/ui/field";
import { ProductImage } from "@/components/store/product-image";
import { CancelOrder, PayNow } from "@/components/checkout/order-actions";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string; placed?: string; unpaid?: string; verify?: string }> }) {
  const { number } = await params;
  const sp = await searchParams;
  await releaseExpiredReservations();
  const user = await getCurrentUser();
  const o = await canViewOrder(number, user, sp.t);
  if (!o) notFound();

  const addr = o.shippingAddress as { fullName: string; line1: string; line2?: string; landmark?: string; city: string; state: string; postalCode: string; phone: string };
  const c = o.currency;
  const reached = new Set(o.events.map((e) => e.status));
  const off = ["CANCELLED", "RETURNED", "REFUNDED", "DELIVERY_FAILED"].includes(o.status);
  const shipment = o.shipments[0];
  const canCancel = ["PLACED", "PAYMENT_CONFIRMED", "PROCESSING"].includes(o.status);
  const expiresAt = new Date(o.createdAt.getTime() + RESERVATION_MINUTES * 60_000);

  return (
    <div className="container-page max-w-5xl pb-16 pt-8">
      {sp.placed && o.status !== "PENDING_PAYMENT" && (
        <div className="mb-6 rounded-[var(--radius-card)] border border-success/30 bg-success/10 p-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-success/20 text-success"><Icon name="check" size={24} strokeWidth={2.4} /></div>
          <h1 className="text-2xl font-semibold">Thank you! Your order is confirmed.</h1>
          <p className="mt-1 text-sm text-muted">We've emailed the details to {o.email}. Bookmark this page to track your order.</p>
        </div>
      )}
      {sp.verify && <FormSuccess message="Payment received. Confirming it can take a minute; this page updates automatically when it's done." />}

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Order</p>
          <h2 className="text-2xl font-semibold">{o.number}</h2>
          <p className="text-sm text-muted">Placed {o.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
        </div>
        <div className="flex gap-2">
          {o.status !== "PENDING_PAYMENT" && o.status !== "CANCELLED" && (
            <Link href={`/order/${o.number}/invoice${sp.t ? `?t=${encodeURIComponent(sp.t)}` : ""}`} className="rounded-full border border-line px-4 py-2 text-sm hover:bg-surface-2">Invoice</Link>
          )}
          <span className={cn("rounded-full px-3 py-2 text-sm font-semibold", off ? "bg-danger/15 text-danger" : o.status === "PENDING_PAYMENT" ? "bg-warning/15 text-warning" : "bg-success/15 text-success")}>{ORDER_STATUS_LABEL[o.status]}</span>
        </div>
      </div>

      {o.status === "PENDING_PAYMENT" && (
        <div className="mb-6 rounded-[var(--radius-card)] border border-warning/30 bg-warning/5 p-5">
          <p className="font-semibold">Payment not completed</p>
          <p className="mt-1 text-sm text-muted">Your items are reserved until {expiresAt.toLocaleTimeString("en-IN", { timeStyle: "short" })}. Complete payment to confirm the order. If money was debited, it will be confirmed automatically.</p>
          <div className="mt-4"><PayNow number={o.number} total={formatMoney(o.grandTotal, c)} email={o.email} phone={o.phone} name={addr.fullName} /></div>
        </div>
      )}

      {!off && o.status !== "PENDING_PAYMENT" && (
        <section className="mb-6 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
          <h3 className="mb-5 font-semibold">Tracking</h3>
          <ol className="grid gap-4 sm:grid-cols-7 sm:gap-2">
            {TIMELINE.filter((s) => (o.paymentMethod === "cod" ? s !== "PAYMENT_CONFIRMED" : s !== "PLACED")).map((s, i, arr) => {
              const idx = arr.indexOf(o.status as (typeof TIMELINE)[number]);
              const done = reached.has(s) || (idx >= 0 && i <= idx) || (o.status === "DELIVERED");
              return (
                <li key={s} className="flex items-center gap-3 sm:flex-col sm:text-center">
                  <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-xs font-bold", done ? "border-success bg-success text-bg" : "border-line text-subtle")}>{done ? "✓" : i + 1}</span>
                  <span className={cn("text-xs", done ? "font-medium" : "text-muted")}>{ORDER_STATUS_LABEL[s]}</span>
                </li>
              );
            })}
          </ol>
          {shipment?.trackingNumber && (
            <p className="mt-5 rounded-xl bg-surface-2 p-3 text-sm">
              <Icon name="truck" size={15} className="mr-1.5 inline" /> {shipment.carrier} · Tracking <b>{shipment.trackingNumber}</b>
              {shipment.trackingUrl && <a href={shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="ml-2 font-medium text-accent hover:underline">Track on courier site ↗</a>}
            </p>
          )}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
          <h3 className="mb-4 font-semibold">Items</h3>
          <ul className="divide-y divide-line">
            {o.items.map((i) => (
              <li key={i.id} className="flex gap-3 py-3 text-sm">
                <div className="relative h-16 w-13 shrink-0 overflow-hidden rounded-xl bg-surface-2">{i.imageUrl && <ProductImage src={i.imageUrl} alt="" fill sizes="52px" className="object-cover" />}</div>
                <div className="min-w-0 flex-1">
                  {i.variant?.product.slug ? <Link href={`/p/${i.variant.product.slug}`} className="font-medium hover:underline">{i.productName}</Link> : <p className="font-medium">{i.productName}</p>}
                  <p className="text-xs text-muted">{i.variantTitle !== "Default" && `${i.variantTitle} · `}Qty {i.quantity} · {formatMoney(i.unitPrice, c)} each</p>
                </div>
                <p className="font-medium tabular-nums">{formatMoney(i.total, c)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <Row k="Subtotal" v={formatMoney(o.subtotal, c)} />
            {o.discountTotal > 0 && <Row k={`Discount${o.couponCode ? ` (${o.couponCode})` : ""}`} v={`−${formatMoney(o.discountTotal, c)}`} cls="text-success" />}
            <Row k="Delivery" v={o.shippingTotal ? formatMoney(o.shippingTotal, c) : "Free"} />
            {o.giftWrapTotal > 0 && <Row k="Gift wrap" v={formatMoney(o.giftWrapTotal, c)} />}
            {o.codFeeTotal > 0 && <Row k="COD fee" v={formatMoney(o.codFeeTotal, c)} />}
            {!o.taxInclusive && <Row k="Tax" v={formatMoney(o.taxTotal, c)} />}
            <div className="flex justify-between border-t border-line pt-3 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatMoney(o.grandTotal, c)}</dd></div>
            {o.taxInclusive && <p className="text-right text-xs text-muted">Includes {formatMoney(o.taxTotal, c)} GST</p>}
          </dl>
        </section>
        <aside className="space-y-4">
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 text-sm">
            <h3 className="mb-2 font-semibold">Delivering to</h3>
            <p>{addr.fullName}</p>
            <p className="text-muted">{[addr.line1, addr.line2, addr.landmark].filter(Boolean).join(", ")}<br />{addr.city}, {addr.state} {addr.postalCode}<br />{addr.phone}</p>
          </div>
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 text-sm">
            <h3 className="mb-2 font-semibold">Payment</h3>
            <p>{o.paymentMethod === "cod" ? "Cash on delivery" : "Online (Razorpay)"} · <span className="text-muted">{o.paymentStatus.toLowerCase().replace("_", " ")}</span></p>
            {o.refunds.map((r) => (
              <p key={r.id} className="mt-1 text-xs text-muted">Refund {formatMoney(r.amount, r.currency)}: {r.status.toLowerCase()}</p>
            ))}
          </div>
          {o.events.length > 0 && (
            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 text-sm">
              <h3 className="mb-3 font-semibold">History</h3>
              <ol className="space-y-2.5 border-l border-line pl-4">
                {[...o.events].reverse().map((e) => (
                  <li key={e.id}>
                    <p className="font-medium">{ORDER_STATUS_LABEL[e.status]}</p>
                    {e.message && <p className="text-xs text-muted">{e.message}</p>}
                    <p className="text-xs text-subtle">{e.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {canCancel && <CancelOrder number={o.number} />}
          <p className="text-center text-xs text-muted">Need help? <Link href="/pages/contact" className="underline">Contact us</Link> with your order number.</p>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v, cls }: { k: string; v: string; cls?: string }) {
  return (
    <div className={cn("flex justify-between", cls)}>
      <dt className={cls ? "" : "text-muted"}>{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}
