import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff, can } from "@/server/auth/session";
import { db } from "@/server/db";
import { formatMoney } from "@/lib/money";
import { Card, PageHeader, StatusPill } from "@/components/admin/ui";
import { SimpleForm } from "@/components/admin/simple-form";
import { Input } from "@/components/ui/field";
import { CustomerStatusControl } from "@/components/admin/customer-status";
import { adjustPointsAction, setCustomerTagsAction } from "@/app/admin/actions";
import { pointsBalance } from "@/server/rewards/service";

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireStaff("customers.read", `/admin/customers/${id}`);
  const u = await db.user.findUnique({
    where: { id },
    include: {
      addresses: true,
      sessions: { where: { expiresAt: { gt: new Date() } }, select: { id: true, lastSeenAt: true, userAgent: true } },
      wishlists: { include: { items: { include: { product: { select: { name: true, slug: true } } }, take: 20, orderBy: { addedAt: "desc" } } } },
      carts: { where: { status: "ACTIVE" }, include: { items: { include: { variant: { select: { title: true, price: true, product: { select: { name: true, currency: true } } } } } } } },
      reviews: { orderBy: { createdAt: "desc" }, take: 10, include: { product: { select: { name: true } } } },
      orders: { orderBy: { createdAt: "desc" }, take: 10, select: { id: true, number: true, grandTotal: true, currency: true, status: true, createdAt: true } },
      _count: { select: { orders: true } },
    },
  });
  if (!u) notFound();
  const history = await db.auditLog.findMany({ where: { entityType: "User", entityId: id }, orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { email: true } } } });
  const [points, pointHistory] = await Promise.all([pointsBalance(u.id), db.loyaltyTransaction.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 8 })]);
  const ltv = u.orders.reduce((n, o) => n + o.grandTotal, 0);
  const writable = can(staff, "customers.write");
  const cart = u.carts[0];
  const wishlist = u.wishlists.flatMap((w) => w.items);

  return (
    <>
      <PageHeader title={u.name ?? u.email} description={u.email} back={{ href: "/admin/customers", label: "Customers" }} />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Orders", u._count.orders], ["Lifetime value", formatMoney(ltv, "INR")], ["Wishlist", wishlist.length], ["Reviews", u.reviews.length]].map(([l, v]) => (
              <div key={String(l)} className="rounded-2xl border border-line bg-surface p-4">
                <p className="text-xs uppercase tracking-wider text-muted">{l}</p>
                <p className="mt-1 text-xl font-semibold">{v}</p>
              </div>
            ))}
          </div>
          <Card title="Orders">
            {u.orders.length ? (
              <ul className="divide-y divide-line text-sm">
                {u.orders.map((o) => (
                  <li key={o.id} className="flex justify-between py-2">
                    <span>#{o.number} · {o.createdAt.toLocaleDateString("en-IN")}</span>
                    <span>{formatMoney(o.grandTotal, o.currency)} · {o.status.toLowerCase()}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No orders yet.</p>
            )}
          </Card>
          <Card title="Cart right now">
            {cart?.items.length ? (
              <ul className="space-y-1 text-sm">
                {cart.items.map((i) => (
                  <li key={i.id} className="flex justify-between">
                    <span>{i.quantity} × {i.variant.product.name} <span className="text-muted">({i.variant.title})</span>{i.savedForLater && <span className="text-muted"> · saved</span>}</span>
                    <span>{formatMoney(i.variant.price * i.quantity, i.variant.product.currency)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Empty.</p>
            )}
          </Card>
          <Card title="Wishlist">
            {wishlist.length ? (
              <ul className="flex flex-wrap gap-2 text-sm">
                {wishlist.map((w) => (
                  <li key={w.id}><Link href={`/p/${w.product.slug}`} className="rounded-full border border-line px-3 py-1 hover:border-fg">{w.product.name}</Link></li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Empty.</p>
            )}
          </Card>
          <Card title="Reviews">
            {u.reviews.length ? (
              <ul className="divide-y divide-line text-sm">
                {u.reviews.map((r) => (
                  <li key={r.id} className="py-2">{"★".repeat(r.rating)} <span className="text-muted">on {r.product.name} · {r.status.toLowerCase()}</span><p className="line-clamp-2 text-muted">{r.body}</p></li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">None.</p>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Account">
            <dl className="space-y-2 text-sm">
              <Row k="Status" v={<StatusPill status={u.status} />} />
              <Row k="Email verified" v={u.emailVerifiedAt ? u.emailVerifiedAt.toLocaleDateString("en-IN") : "No"} />
              <Row k="Phone" v={u.phone ?? "—"} />
              <Row k="Marketing emails" v={u.marketingOptIn ? "Opted in" : "No"} />
              <Row k="Joined" v={u.createdAt.toLocaleDateString("en-IN")} />
              <Row k="Last sign-in" v={u.lastLoginAt?.toLocaleString("en-IN") ?? "—"} />
              <Row k="Active sessions" v={u.sessions.length} />
              <Row k="Staff" v={u.isStaff ? "Yes" : "No"} />
            </dl>
          </Card>
          {writable && !u.isStaff && (
            <Card title="Manage" description="Suspending or banning signs the customer out everywhere and blocks sign-in.">
              <CustomerStatusControl userId={u.id} status={u.status} />
            </Card>
          )}
          <Card title={`Reward points · ${points}`}>
            {pointHistory.length > 0 && (
              <ul className="mb-3 space-y-1 text-xs text-muted">
                {pointHistory.map((p) => <li key={p.id} className="flex justify-between"><span>{p.reason.toLowerCase().replace("_", " ")} · {p.createdAt.toLocaleDateString("en-IN")}</span><span className={p.points > 0 ? "text-success" : ""}>{p.points > 0 ? "+" : ""}{p.points}</span></li>)}
              </ul>
            )}
            {writable && (
              <SimpleForm action={adjustPointsAction.bind(null, u.id)} submitLabel="Adjust points" className="grid grid-cols-2 gap-2" resetOnSuccess>
                <Input name="points" type="number" placeholder="+50 / -20" aria-label="Points" />
                <Input name="note" placeholder="Reason" aria-label="Reason" />
              </SimpleForm>
            )}
          </Card>
          <Card title="Tags" description="Internal labels, e.g. vip, wholesale, fraud-check.">
            {writable ? (
              <SimpleForm action={setCustomerTagsAction.bind(null, u.id)}>
                <Input name="tags" defaultValue={u.tags.join(", ")} placeholder="vip, collector" aria-label="Tags" />
              </SimpleForm>
            ) : (
              <p className="text-sm">{u.tags.join(", ") || "—"}</p>
            )}
          </Card>
          <Card title="Addresses">
            {u.addresses.length ? u.addresses.map((a) => <p key={a.id} className="text-sm text-muted">{a.fullName}, {a.line1}, {a.city} {a.postalCode}</p>) : <p className="text-sm text-muted">None saved.</p>}
          </Card>
          <Card title="History">
            {history.length ? (
              <ul className="space-y-1.5 text-xs text-muted">
                {history.map((h) => <li key={h.id}>{h.createdAt.toLocaleDateString("en-IN")} · {h.action} · {h.actor?.email ?? "system"}</li>)}
              </ul>
            ) : (
              <p className="text-sm text-muted">No admin actions.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
