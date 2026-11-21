import Link from "next/link";
import { requireStaff } from "@/server/auth/session";
import { formatMoney } from "@/lib/money";
import { Card, PageHeader, Stat, Table } from "@/components/admin/ui";
import { abandonedCarts, couponUsage, dailySales, funnel, mostViewed, periodStart, repeatCustomers, salesSummary, searches, topProducts, trafficSources } from "@/server/analytics/reports";

const RANGES = [7, 30, 90] as const;
const inr = (p: number) => formatMoney(p, "INR");
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10}%` : "–");

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireStaff("dashboard.view", "/admin/analytics");
  const raw = Number((await searchParams).days);
  const days = (RANGES as readonly number[]).includes(raw) ? raw : 30;
  const since = periodStart(days);

  const [summary, daily, steps, sellers, viewed, search, coupons, sources, repeat, carts] = await Promise.all([
    salesSummary(since),
    dailySales(days),
    funnel(since),
    topProducts(since),
    mostViewed(since),
    searches(since),
    couponUsage(since),
    trafficSources(since),
    repeatCustomers(since),
    abandonedCarts(since),
  ]);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Sales count placed orders that weren't cancelled. Visitor numbers come from the store's own cookie-free tracking."
        actions={
          <div className="flex rounded-full border border-line p-1 text-sm">
            {RANGES.map((d) => (
              <Link key={d} href={`/admin/analytics?days=${d}`} className={`rounded-full px-3 py-1.5 ${d === days ? "bg-fg font-semibold text-bg" : "text-muted hover:text-fg"}`} aria-current={d === days ? "page" : undefined}>
                {d} days
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sales" value={inr(summary.revenue)} hint={`${summary.orders} order${summary.orders === 1 ? "" : "s"}`} />
        <Stat label="Avg. order value" value={inr(summary.aov)} />
        <Stat label="Refunded" value={inr(summary.refunds)} tone={summary.refunds ? "warning" : undefined} hint={`Net ${inr(summary.revenue - summary.refunds)}`} />
        <Stat label="Repeat customers" value={pct(repeat.repeat, repeat.customers)} hint={`${repeat.repeat} of ${repeat.customers} customers`} />
        <Stat label="Coupon discounts" value={inr(summary.discounts)} />
        <Stat label="Gift cards redeemed" value={inr(summary.giftCards)} />
        <Stat label="Points redeemed" value={inr(summary.points)} />
        <Stat label="Abandoned carts" value={carts.count} hint="Idle for over an hour" tone={carts.count ? "warning" : undefined} />
      </div>

      <Card title="Sales by day" className="mt-6">
        <SalesChart data={daily} />
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Conversion funnel" description="Unique browsing sessions reaching each step.">
          <ul className="space-y-3">
            {steps.map((s, i) => {
              const top = steps[0]!.count || 1;
              return (
                <li key={s.step}>
                  <div className="flex justify-between text-sm">
                    <span>{s.step}</span>
                    <span className="tabular-nums text-muted">
                      {s.count.toLocaleString("en-IN")}
                      {i > 0 && <span className="ml-2 text-xs">{pct(s.count, steps[i - 1]!.count)} of previous</span>}
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-surface-2">
                    <div className="h-2 rounded-full bg-accent" style={{ width: `${Math.min(100, (s.count / top) * 100)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="Traffic sources" description="From utm_source tags, then the referring website.">
          <Table head={["Source", "Sessions"]} empty={!sources.length ? <Empty>No visits recorded yet.</Empty> : undefined}>
            {sources.map((s) => (
              <tr key={s.source}>
                <td className="px-4 py-2.5">{s.source}</td>
                <td className="px-4 py-2.5 tabular-nums">{s.sessions.toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card title="Best sellers">
          <Table head={["Product", "Units", "Sales"]} empty={!sellers.length ? <Empty>No orders in this period.</Empty> : undefined}>
            {sellers.map((p) => (
              <tr key={(p.productId ?? "") + p.name}>
                <td className="px-4 py-2.5">{p.productId ? <Link href={`/admin/products/${p.productId}`} className="hover:underline">{p.name}</Link> : p.name}</td>
                <td className="px-4 py-2.5 tabular-nums">{p.units}</td>
                <td className="px-4 py-2.5 tabular-nums">{inr(p.revenue)}</td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card title="Most viewed">
          <Table head={["Product", "Views", "Add to cart"]} empty={!viewed.length ? <Empty>No product views recorded yet.</Empty> : undefined}>
            {viewed.map((p) => (
              <tr key={p.productId}>
                <td className="px-4 py-2.5"><Link href={`/admin/products/${p.productId}`} className="hover:underline">{p.name}</Link></td>
                <td className="px-4 py-2.5 tabular-nums">{p.views}</td>
                <td className="px-4 py-2.5 tabular-nums">{p.addToCarts} <span className="text-xs text-muted">({pct(p.addToCarts, p.views)})</span></td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card title="Top searches">
          <Table head={["Search", "Times", "Avg. results"]} empty={!search.top.length ? <Empty>No searches yet.</Empty> : undefined}>
            {search.top.map((s) => (
              <tr key={s.query}>
                <td className="px-4 py-2.5">{s.query}</td>
                <td className="px-4 py-2.5 tabular-nums">{s.count}</td>
                <td className="px-4 py-2.5 tabular-nums">{s.avgResults}</td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card title="Searches with no results" description="Products or keywords shoppers wanted but couldn't find.">
          <Table head={["Search", "Times"]} empty={!search.zero.length ? <Empty>None. Every search found something.</Empty> : undefined}>
            {search.zero.map((s) => (
              <tr key={s.query}>
                <td className="px-4 py-2.5">{s.query}</td>
                <td className="px-4 py-2.5 tabular-nums">{s.count}</td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card title="Coupon usage">
          <Table head={["Code", "Uses", "Discount given"]} empty={!coupons.length ? <Empty>No coupons used in this period.</Empty> : undefined}>
            {coupons.map((c) => (
              <tr key={c.code}>
                <td className="px-4 py-2.5 font-mono text-xs">{c.code}</td>
                <td className="px-4 py-2.5 tabular-nums">{c.uses}</td>
                <td className="px-4 py-2.5 tabular-nums">{inr(c.discount)}</td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card title="Recent abandoned carts">
          <Table head={["Shopper", "Items", "Last active"]} empty={!carts.recent.length ? <Empty>No abandoned carts.</Empty> : undefined}>
            {carts.recent.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2.5">{c.who}</td>
                <td className="px-4 py-2.5 tabular-nums">{c.items}</td>
                <td className="px-4 py-2.5 text-xs text-muted">{c.lastActivityAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

/** Simple server-rendered bar chart; no chart library needed. */
function SalesChart({ data }: { data: { day: string; revenue: number; orders: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.revenue));
  const w = 720;
  const h = 200;
  const gap = data.length > 40 ? 1 : 3;
  const bw = (w - gap * (data.length - 1)) / data.length;
  const label = (day: string) => new Date(`${day}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  const every = Math.ceil(data.length / 7);
  if (!data.some((d) => d.revenue)) return <p className="text-sm text-muted">No sales in this period yet.</p>;
  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${h + 22}`} className="h-auto w-full" role="img" aria-label="Sales per day">
        {data.map((d, i) => {
          const bh = Math.max(d.revenue ? 2 : 0, (d.revenue / max) * h);
          const x = i * (bw + gap);
          return (
            <g key={d.day}>
              <rect x={x} y={h - bh} width={bw} height={bh} rx={Math.min(3, bw / 3)} className="fill-accent">
                <title>{`${label(d.day)}: ${formatMoney(d.revenue, "INR")} · ${d.orders} order${d.orders === 1 ? "" : "s"}`}</title>
              </rect>
              {i % every === 0 && (
                <text x={x + bw / 2} y={h + 16} textAnchor="middle" className="fill-current text-[10px] text-muted">
                  {label(d.day)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 text-xs text-muted">Highest day: {formatMoney(max, "INR")}. Hover a bar for details.</figcaption>
    </figure>
  );
}
