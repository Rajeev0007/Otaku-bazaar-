import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff, can } from "@/server/auth/session";
import { db } from "@/server/db";
import { nextStatuses } from "@/server/orders/service";
import { ORDER_STATUS_LABEL } from "@/lib/checkout";
import { formatMoney } from "@/lib/money";
import { Card, PageHeader } from "@/components/admin/ui";
import { ActionButton, SimpleForm } from "@/components/admin/simple-form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { addOrderNoteAction, adminCancelOrderAction, refreshTrackingAction, retryRefundAction, shipWithShiprocketAction, updateOrderStatusAction } from "@/app/admin/actions";
import { getIntegrations } from "@/server/integrations";

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireStaff("orders.read", `/admin/orders/${id}`);
  const o = await db.order.findUnique({
    where: { id },
    include: { items: true, events: { orderBy: { createdAt: "desc" } }, payments: true, refunds: true, shipments: true, user: { select: { id: true, name: true } } },
  });
  if (!o) notFound();
  const a = o.shippingAddress as Record<string, string>;
  const c = o.currency;
  const next = nextStatuses(o.status);
  const canWrite = can(staff, "orders.write");
  const canRefund = can(staff, "orders.refund");
  const cancellable = ["PENDING_PAYMENT", "PLACED", "PAYMENT_CONFIRMED", "PROCESSING"].includes(o.status);
  const s = o.shipments[0];
  const shiprocketOn = !!(await getIntegrations()).shiprocket;

  return (
    <>
      <PageHeader
        title={`Order ${o.number}`}
        description={`${ORDER_STATUS_LABEL[o.status]} · ${o.paymentMethod === "cod" ? "Cash on delivery" : "Online"} (${o.paymentStatus.toLowerCase()}) · ${o.createdAt.toLocaleString("en-IN")}`}
        back={{ href: "/admin/orders", label: "Orders" }}
        actions={
          <>
            <Link href={`/admin/orders/${o.id}/print?kind=packing`} target="_blank" className="rounded-full border border-line px-4 py-2 text-sm hover:bg-surface-2">Packing slip</Link>
            <Link href={`/admin/orders/${o.id}/print?kind=invoice`} target="_blank" className="rounded-full border border-line px-4 py-2 text-sm hover:bg-surface-2">Invoice</Link>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title="Items">
            <ul className="divide-y divide-line text-sm">
              {o.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 py-2">
                  <span>{i.quantity} × {i.productName} <span className="text-muted">({i.variantTitle}) · {i.sku}</span></span>
                  <span className="tabular-nums">{formatMoney(i.total, c)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
              {[["Subtotal", o.subtotal], ["Discount" + (o.couponCode ? ` (${o.couponCode})` : ""), -o.discountTotal], ["Delivery" + (o.shippingMethod ? ` (${o.shippingMethod})` : ""), o.shippingTotal], ["Gift wrap", o.giftWrapTotal], ["COD fee", o.codFeeTotal], ["Reward points", -o.loyaltyTotal], ["Gift card", -o.giftCardTotal]]
                .filter(([k, v]) => k === "Subtotal" || v !== 0)
                .map(([k, v]) => <div key={String(k)} className="flex justify-between"><dt className="text-muted">{k}</dt><dd className="tabular-nums">{formatMoney(Number(v), c)}</dd></div>)}
              <div className="flex justify-between font-semibold"><dt>To collect / paid</dt><dd className="tabular-nums">{formatMoney(o.grandTotal, c)}</dd></div>
            </dl>
            {o.giftWrap && <p className="mt-3 rounded-xl bg-accent-soft p-3 text-sm">🎁 Gift wrap{o.giftMessage && <>: “{o.giftMessage}”</>}</p>}
            {o.notes && <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">Customer note: {o.notes}</p>}
          </Card>

          {canWrite && next.includes("SHIPPED") && shiprocketOn && (
            <Card title="Ship with Shiprocket" description="Books the cheapest available courier, schedules pickup, creates the label and marks the order shipped with tracking.">
              <ActionButton action={shipWithShiprocketAction.bind(null, o.id)} className="h-11 rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg disabled:opacity-60">Book courier &amp; ship</ActionButton>
            </Card>
          )}
          {canWrite && next.length > 0 && (
            <Card title={shiprocketOn && next.includes("SHIPPED") ? "Or update status manually" : "Update status"} description="The customer is emailed when the order ships, goes out for delivery, is delivered, or has a delivery problem.">
              <SimpleForm action={updateOrderStatusAction.bind(null, o.id)} submitLabel="Update order" className="grid gap-3 sm:grid-cols-2">
                <Field label="New status" htmlFor="status">
                  <Select id="status" name="status" defaultValue={next[0]}>
                    {next.map((x) => <option key={x} value={x}>{ORDER_STATUS_LABEL[x]}</option>)}
                  </Select>
                </Field>
                <Field label="Message (optional, shown to customer)" htmlFor="message"><Input id="message" name="message" /></Field>
                {next.includes("SHIPPED") && (
                  <>
                    <Field label="Courier (for Shipped)" htmlFor="carrier"><Input id="carrier" name="carrier" placeholder="Delhivery, Blue Dart, India Post…" /></Field>
                    <Field label="Tracking number" htmlFor="trackingNumber"><Input id="trackingNumber" name="trackingNumber" /></Field>
                    <Field label="Tracking link (optional)" htmlFor="trackingUrl" className="sm:col-span-2"><Input id="trackingUrl" name="trackingUrl" placeholder="https://" /></Field>
                  </>
                )}
              </SimpleForm>
            </Card>
          )}

          <Card title="Timeline">
            <ol className="space-y-3 border-l border-line pl-4 text-sm">
              {o.events.map((e) => (
                <li key={e.id}>
                  <p className="font-medium">{ORDER_STATUS_LABEL[e.status]} {!e.isPublic && <span className="ml-1 rounded bg-surface-3 px-1.5 text-[0.65rem] text-muted">internal</span>}</p>
                  {e.message && <p className={e.message.startsWith("⚠") ? "text-warning" : "text-muted"}>{e.message}</p>}
                  <p className="text-xs text-subtle">{e.createdAt.toLocaleString("en-IN")}</p>
                </li>
              ))}
            </ol>
            {canWrite && (
              <SimpleForm action={addOrderNoteAction.bind(null, o.id)} submitLabel="Add note" className="mt-4 space-y-2" resetOnSuccess>
                <Textarea name="note" rows={2} placeholder="Note or update…" aria-label="Note" />
                <Checkbox name="public" label="Show this update to the customer" />
              </SimpleForm>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Customer">
            <p className="text-sm">{a.fullName}{o.user && <Link href={`/admin/customers/${o.user.id}`} className="ml-2 text-xs text-accent hover:underline">profile</Link>}</p>
            <p className="text-sm text-muted">{o.email}<br />{o.phone}</p>
            <p className="mt-3 text-sm font-medium">Ship to</p>
            <p className="text-sm text-muted">{[a.line1, a.line2, a.landmark].filter(Boolean).join(", ")}<br />{a.city}, {a.state} {a.postalCode}<br />{a.phone}{a.instructions && <><br />“{a.instructions}”</>}</p>
          </Card>
          {s && (
            <Card title="Shipment">
              <p className="text-sm">{s.carrier} · <b>{s.trackingNumber}</b></p>
              {s.trackingUrl && <a href={s.trackingUrl} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">Open tracking ↗</a>}
              <p className="text-xs text-muted">Shipped {s.shippedAt?.toLocaleDateString("en-IN")}{s.deliveredAt && ` · delivered ${s.deliveredAt.toLocaleDateString("en-IN")}`}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {s.labelUrl && <a href={s.labelUrl} target="_blank" rel="noreferrer" className="rounded-full bg-fg px-3 py-1.5 text-xs font-semibold text-bg">Print shipping label</a>}
                {shiprocketOn && s.providerRef?.startsWith("shiprocket:") && canWrite && <ActionButton action={refreshTrackingAction.bind(null, o.id)} className="rounded-full border border-line px-3 py-1.5 text-xs">Refresh tracking</ActionButton>}
              </div>
            </Card>
          )}
          <Card title="Payments & refunds">
            {o.payments.map((p) => (
              <div key={p.id} className="text-sm">
                <p>{p.provider === "cod" ? "Cash on delivery" : "Razorpay"} · {formatMoney(p.amount, p.currency)} · <b>{p.status.toLowerCase()}</b></p>
                {p.providerPaymentId && <p className="font-mono text-xs text-muted">{p.providerPaymentId}</p>}
                {p.failureReason && <p className="text-xs text-danger">Last attempt failed: {p.failureReason}</p>}
              </div>
            ))}
            {o.refunds.map((r) => (
              <div key={r.id} className="mt-2 flex items-center justify-between gap-2 text-sm">
                <span>Refund {formatMoney(r.amount, r.currency)} · {r.status.toLowerCase()}</span>
                {r.status === "FAILED" && canRefund && <ActionButton action={retryRefundAction.bind(null, r.id)} className="rounded-full border border-line px-3 py-1 text-xs">Retry</ActionButton>}
              </div>
            ))}
          </Card>
          {canRefund && cancellable && (
            <Card title="Cancel order" description={o.paymentStatus === "CAPTURED" ? "Returns stock and refunds the full amount to the customer's payment method." : "Returns or releases the stock."}>
              <SimpleForm action={adminCancelOrderAction.bind(null, o.id)} submitLabel="Cancel order">
                <Input name="reason" placeholder="Reason (shown to customer)" aria-label="Reason" />
              </SimpleForm>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
