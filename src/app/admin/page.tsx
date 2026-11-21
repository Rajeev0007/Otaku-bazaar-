import Link from "next/link";
import { requireStaff } from "@/server/auth/session";
import { db } from "@/server/db";
import { lowStockVariants } from "@/server/inventory/service";
import { formatMoney } from "@/lib/money";
import { Card, PageHeader, Stat, Table } from "@/components/admin/ui";
import { getSetupStatus } from "@/server/admin/setup-status";
import { COUNTED_ORDER } from "@/server/analytics/reports";

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  await requireStaff("dashboard.view", "/admin");
  const welcome = (await searchParams).welcome === "owner";
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const [revenue, toFulfil, customers, newCustomers, activeProducts, outOfStock, low, subscribers, activity, topViewed, pendingQuestions, carts] = await Promise.all([
    db.order.aggregate({ where: { ...COUNTED_ORDER, placedAt: { gte: since30 } }, _sum: { grandTotal: true }, _count: true }),
    db.order.count({ where: { status: { in: ["PLACED", "PAYMENT_CONFIRMED", "PROCESSING", "PACKED"] } } }),
    db.user.count({ where: { isStaff: false, status: "ACTIVE" } }),
    db.user.count({ where: { isStaff: false, createdAt: { gte: since30 } } }),
    db.product.count({ where: { status: "ACTIVE" } }),
    db.product.count({ where: { status: "ACTIVE", inStock: false } }),
    lowStockVariants(8),
    db.newsletterSubscriber.count({ where: { unsubscribedAt: null } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { actor: { select: { name: true, email: true } } } }),
    db.product.findMany({ where: { status: "ACTIVE" }, orderBy: { viewCount: "desc" }, take: 5, select: { id: true, name: true, viewCount: true, salesCount: true } }),
    db.productQuestion.count({ where: { status: "PENDING" } }),
    db.cart.count({ where: { status: "ACTIVE", items: { some: {} } } }),
  ]);
  const aov = revenue._count ? Math.round((revenue._sum.grandTotal ?? 0) / revenue._count) : 0;
  const setup = await getSetupStatus();
  const pending = setup.filter((i) => !i.ok && i.required);

  return (
    <>
      <PageHeader title="Dashboard" description="Last 30 days unless noted." />
      {welcome && (
        <div className="mb-6 rounded-2xl border border-success/30 bg-success/10 p-5 text-sm">
          <p className="font-semibold text-success">Welcome, your store is live.</p>
          <p className="mt-1 text-muted">Everything is managed from here: products, homepage, pages, customers, integrations and settings. Work through the launch checklist below.</p>
        </div>
      )}
      {pending.length > 0 && (
        <details className="mb-6 rounded-2xl border border-warning/30 bg-warning/5 p-5" open={pending.length > 3}>
          <summary className="cursor-pointer font-semibold">
            Launch setup: {setup.filter((i) => i.ok).length} of {setup.length} done <span className="text-sm font-normal text-warning">· {pending.length} required item{pending.length === 1 ? "" : "s"} left</span>
          </summary>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {setup.map((i) => (
              <li key={i.label} className="flex items-start gap-2.5 text-sm">
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.65rem] font-bold ${i.ok ? "bg-success/20 text-success" : i.required ? "bg-warning/20 text-warning" : "bg-surface-3 text-muted"}`}>{i.ok ? "✓" : i.required ? "!" : "–"}</span>
                <span>
                  <span className={i.ok ? "text-muted" : "font-medium"}>{i.label}</span>
                  {!i.ok && (i.href ? <Link href={i.href} className="block text-xs text-muted underline-offset-2 hover:text-fg hover:underline">{i.fix}</Link> : <span className="block text-xs text-muted">{i.fix}</span>)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sales (30d)" value={formatMoney(revenue._sum.grandTotal ?? 0, "INR")} hint={<Link href="/admin/analytics" className="hover:underline">{revenue._count} order{revenue._count === 1 ? "" : "s"} · full report →</Link>} />
        <Stat label="Avg. order value" value={formatMoney(aov, "INR")} hint="Placed orders, incl. COD" />
        <Stat label="To fulfil" value={toFulfil} tone={toFulfil ? "warning" : undefined} hint={<Link href="/admin/orders" className="hover:underline">Placed, not yet shipped →</Link>} />
        <Stat label="Customers" value={customers.toLocaleString("en-IN")} hint={`${newCustomers} new in 30 days · ${subscribers} newsletter`} />
        <Stat label="Active carts" value={carts.toLocaleString("en-IN")} hint="Carts with items" />
        <Stat label="Active products" value={activeProducts} hint={`${outOfStock} fully out of stock`} tone={outOfStock ? "warning" : undefined} />
        <Stat label="Low-stock variants" value={low.length >= 8 ? "8+" : low.length} tone={low.length ? "warning" : "success"} hint="At or below alert threshold" />
        <Stat label="Questions to answer" value={pendingQuestions} tone={pendingQuestions ? "warning" : undefined} hint="Product Q&A awaiting reply" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Low stock" description="Restock these variants soon." actions={<Link href="/admin/inventory?filter=low" className="text-xs text-muted hover:text-fg">View all →</Link>}>
          {low.length ? (
            <ul className="divide-y divide-line text-sm">
              {low.map((v) => (
                <li key={v.variantId} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/admin/products/${v.productId}`} className="min-w-0 hover:underline">
                    <span className="block truncate">{v.productName}</span>
                    <span className="text-xs text-muted">{v.title} · {v.sku}</span>
                  </Link>
                  <span className={v.available <= 0 ? "font-semibold text-danger" : "font-semibold text-warning"}>{v.available <= 0 ? "Out" : v.available}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Everything is well stocked.</p>
          )}
        </Card>
        <Card title="Most viewed products">
          <Table head={["Product", "Views", "Sales"]}>
            {topViewed.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2.5"><Link href={`/admin/products/${p.id}`} className="hover:underline">{p.name}</Link></td>
                <td className="px-4 py-2.5 tabular-nums">{p.viewCount}</td>
                <td className="px-4 py-2.5 tabular-nums">{p.salesCount}</td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Recent activity" className="xl:col-span-2">
          {activity.length ? (
            <ul className="divide-y divide-line text-sm">
              {activity.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span>
                    <span className="font-medium">{a.actor?.name ?? a.actor?.email ?? "System"}</span> <span className="text-muted">{a.action.replace(/[._]/g, " ")}</span>
                    {a.data && typeof a.data === "object" && "name" in a.data ? <span className="text-muted"> · {String((a.data as { name: unknown }).name)}</span> : null}
                  </span>
                  <time className="text-xs text-subtle">{a.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No admin activity yet.</p>
          )}
        </Card>
      </div>
    </>
  );
}
