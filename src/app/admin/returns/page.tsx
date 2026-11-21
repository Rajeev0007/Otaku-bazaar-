import Link from "next/link";
import { ReturnStatus } from "@prisma/client";
import { requireStaff, can } from "@/server/auth/session";
import { db } from "@/server/db";
import { nextReturnStatuses, suggestedRefund } from "@/server/returns/service";
import { formatMoney } from "@/lib/money";
import { Card, PageHeader } from "@/components/admin/ui";
import { SimpleForm } from "@/components/admin/simple-form";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { updateReturnAction } from "@/app/admin/actions";

const LABEL: Record<string, string> = {
  APPROVED: "Approve",
  REJECTED: "Reject",
  PICKUP_SCHEDULED: "Pickup scheduled",
  RECEIVED: "Item received",
  REFUNDED: "Refund customer",
  EXCHANGED: "Exchange / replacement sent",
  CLOSED: "Close",
};
const TABS: [string, ReturnStatus[]][] = [
  ["To review", ["REQUESTED"]],
  ["In progress", ["APPROVED", "PICKUP_SCHEDULED", "RECEIVED"]],
  ["Done", ["REFUNDED", "EXCHANGED", "CLOSED", "REJECTED"]],
];

export default async function ReturnsAdmin({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const staff = await requireStaff("orders.read", "/admin/returns");
  const sp = await searchParams;
  const tab = TABS.find(([l]) => l === sp.tab) ?? TABS[0]!;
  const [returns, counts] = await Promise.all([
    db.returnRequest.findMany({
      where: { status: { in: tab[1] } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { items: { include: { orderItem: true } }, order: { select: { id: true, number: true, email: true, paymentMethod: true, currency: true } }, refunds: true },
    }),
    db.returnRequest.groupBy({ by: ["status"], _count: true }),
  ]);
  const n = (ss: ReturnStatus[]) => counts.filter((c) => ss.includes(c.status)).reduce((a, c) => a + c._count, 0);
  const suggestions = new Map(await Promise.all(returns.map(async (r) => [r.id, await suggestedRefund(r.id)] as const)));
  const canWrite = can(staff, "orders.write");
  const canRefund = can(staff, "orders.refund");

  return (
    <>
      <PageHeader title="Returns & exchanges" description="Review requests, receive items back (optionally restock), then refund or send the exchange. Customers are emailed at every step." />
      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map(([l, ss]) => (
          <Link key={l} href={`/admin/returns?tab=${encodeURIComponent(l)}`} className={`rounded-full px-3 py-1.5 text-sm ${tab[0] === l ? "bg-fg text-bg" : "border border-line text-muted hover:text-fg"}`}>
            {l} <span className="opacity-60">{n(ss)}</span>
          </Link>
        ))}
      </div>
      {!returns.length && <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">Nothing here.</p>}
      <div className="space-y-4">
        {returns.map((r) => {
          const next = nextReturnStatuses(r.status).filter((s) => (s === "REFUNDED" ? r.kind === "RETURN" && canRefund : s === "EXCHANGED" ? r.kind !== "RETURN" && canWrite : canWrite));
          return (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {r.number} · {r.kind === "RETURN" ? "Refund" : r.kind === "EXCHANGE" ? "Exchange" : "Replacement"}
                    <span className="ml-2 rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium">{r.status.toLowerCase().replace("_", " ")}</span>
                  </p>
                  <p className="text-xs text-muted">
                    Order <Link href={`/admin/orders/${r.order.id}`} className="font-mono hover:underline">{r.order.number}</Link> · {r.order.email} · {r.order.paymentMethod === "cod" ? "COD" : "prepaid"} · {r.createdAt.toLocaleDateString("en-IN")}
                  </p>
                </div>
                <p className="text-sm">Suggested refund <b>{formatMoney(suggestions.get(r.id) ?? 0, r.order.currency)}</b></p>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {r.items.map((i) => <li key={i.id}>{i.quantity} × {i.orderItem.productName} <span className="text-muted">({i.orderItem.variantTitle})</span></li>)}
              </ul>
              <p className="mt-2 text-sm"><b>Reason:</b> {r.reason}{r.details && <span className="text-muted"> · “{r.details}”</span>}</p>
              {r.adminNote && <p className="mt-1 text-xs text-muted">Note: {r.adminNote}</p>}
              {r.refunds.map((f) => <p key={f.id} className="mt-1 text-xs">Refund {formatMoney(f.amount, f.currency)} ({f.method === "original" ? "Razorpay" : "bank transfer"}): {f.status.toLowerCase()}</p>)}
              {next.length > 0 && (
                <SimpleForm action={updateReturnAction.bind(null, r.id)} submitLabel="Update" className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
                  <Field label="Next step" htmlFor={`s-${r.id}`}>
                    <Select id={`s-${r.id}`} name="status" defaultValue={next[0]}>
                      {next.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
                    </Select>
                  </Field>
                  <Field label="Note to customer (optional)" htmlFor={`n-${r.id}`}><Input id={`n-${r.id}`} name="note" /></Field>
                  {next.includes("PICKUP_SCHEDULED") && <Field label="Pickup tracking no. (for pickup step)" htmlFor={`t-${r.id}`}><Input id={`t-${r.id}`} name="trackingNumber" /></Field>}
                  {next.includes("REFUNDED") && (
                    <Field label="Refund amount ₹ (for refund step)" htmlFor={`a-${r.id}`} hint={r.order.paymentMethod === "cod" ? "Send this by bank transfer/UPI, then record it here." : "Refunded to the original payment via Razorpay."}>
                      <Input id={`a-${r.id}`} name="refundAmount" type="number" step="0.01" defaultValue={(suggestions.get(r.id) ?? 0) / 100} />
                    </Field>
                  )}
                  {next.includes("RECEIVED") && <Checkbox name="restock" defaultChecked label="Put the items back in stock (when receiving)" className="self-end pb-3" />}
                </SimpleForm>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
