import Link from "next/link";
import { OrderStatus, Prisma } from "@prisma/client";
import { requireStaff } from "@/server/auth/session";
import { db } from "@/server/db";
import { releaseExpiredReservations } from "@/server/orders/service";
import { ORDER_STATUS_LABEL } from "@/lib/checkout";
import { formatMoney } from "@/lib/money";
import { PageHeader, Stat, Table } from "@/components/admin/ui";
import { Pagination } from "@/components/ui/misc";
import { AdminProductSearch } from "@/components/admin/product-list-client";

const PER_PAGE = 40;
const TABS: [string, OrderStatus[] | undefined][] = [
  ["To fulfil", ["PLACED", "PAYMENT_CONFIRMED", "PROCESSING", "PACKED"]],
  ["Shipped", ["SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELAYED"]],
  ["Delivered", ["DELIVERED"]],
  ["Problems", ["DELIVERY_FAILED", "RETURNED"]],
  ["Awaiting payment", ["PENDING_PAYMENT"]],
  ["Cancelled", ["CANCELLED", "REFUNDED"]],
  ["All", undefined],
];

export default async function OrdersAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff("orders.read", "/admin/orders");
  await releaseExpiredReservations();
  const sp = await searchParams;
  const tab = TABS.find(([l]) => l === sp.tab) ?? TABS[0]!;
  const q = sp.q?.trim().slice(0, 80);
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.OrderWhereInput = {
    ...(tab[1] ? { status: { in: tab[1] } } : {}),
    ...(q ? { OR: [{ number: { contains: q.toUpperCase() } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {}),
  };
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const [total, orders, counts, todayAgg, codDue] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { _count: { select: { items: true } } } }),
    db.order.groupBy({ by: ["status"], _count: true }),
    db.order.aggregate({ where: { placedAt: { gte: today }, status: { notIn: ["CANCELLED", "PENDING_PAYMENT"] } }, _sum: { grandTotal: true }, _count: true }),
    db.order.aggregate({ where: { paymentMethod: "cod", paymentStatus: "PENDING", status: { notIn: ["CANCELLED", "PENDING_PAYMENT", "RETURNED"] } }, _sum: { grandTotal: true } }),
  ]);
  const n = (ss?: OrderStatus[]) => counts.filter((c) => !ss || ss.includes(c.status)).reduce((a, c) => a + c._count, 0);

  return (
    <>
      <PageHeader title="Orders" description="Fulfil, ship, cancel and refund orders." actions={<a href="/api/admin/export/orders" className="rounded-full border border-line px-4 py-2 text-sm hover:bg-surface-2">Export CSV</a>} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Today" value={formatMoney(todayAgg._sum.grandTotal ?? 0, "INR")} hint={`${todayAgg._count} orders`} />
        <Stat label="To fulfil" value={n(TABS[0]![1])} tone={n(TABS[0]![1]) ? "warning" : undefined} />
        <Stat label="COD to collect" value={formatMoney(codDue._sum.grandTotal ?? 0, "INR")} />
        <Stat label="Problems" value={n(TABS[3]![1])} tone={n(TABS[3]![1]) ? "danger" : undefined} />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map(([label, ss]) => (
          <Link key={label} href={`/admin/orders?tab=${encodeURIComponent(label)}`} className={`rounded-full px-3 py-1.5 text-sm ${tab[0] === label ? "bg-fg text-bg" : "border border-line text-muted hover:text-fg"}`}>
            {label} <span className="opacity-60">{n(ss)}</span>
          </Link>
        ))}
        <div className="ml-auto w-full sm:w-72"><AdminProductSearch initial={q ?? ""} /></div>
      </div>
      <Table head={["Order", "Customer", "Status", "Payment", "Items", "Total", "Date"]} empty={!orders.length && <p className="p-6 text-center text-sm text-muted">No orders here.</p>}>
        {orders.map((o) => {
          const a = o.shippingAddress as { fullName?: string; city?: string };
          return (
            <tr key={o.id} className="hover:bg-surface-2/50">
              <td className="px-4 py-3"><Link href={`/admin/orders/${o.id}`} className="font-mono font-medium hover:underline">{o.number}</Link></td>
              <td className="px-4 py-3">{a.fullName}<span className="block text-xs text-muted">{o.email} · {a.city}</span></td>
              <td className="px-4 py-3 text-xs">{ORDER_STATUS_LABEL[o.status]}</td>
              <td className="px-4 py-3 text-xs">{o.paymentMethod === "cod" ? "COD" : "Online"} · <span className="text-muted">{o.paymentStatus.toLowerCase()}</span></td>
              <td className="px-4 py-3 tabular-nums">{o._count.items}</td>
              <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums">{formatMoney(o.grandTotal, o.currency)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{o.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
            </tr>
          );
        })}
      </Table>
      <div className="mt-6"><Pagination page={page} pageCount={Math.ceil(total / PER_PAGE)} hrefFor={(p) => `/admin/orders?${new URLSearchParams({ tab: tab[0], ...(q ? { q } : {}), page: String(p) })}`} /></div>
    </>
  );
}
