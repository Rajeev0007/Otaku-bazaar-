import Link from "next/link";
import { Prisma, UserStatus } from "@prisma/client";
import { requireStaff } from "@/server/auth/session";
import { db } from "@/server/db";
import { PageHeader, StatusPill, Table } from "@/components/admin/ui";
import { Pagination } from "@/components/ui/misc";
import { AdminProductSearch } from "@/components/admin/product-list-client";

const PER_PAGE = 40;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff("customers.read", "/admin/customers");
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 80);
  const status = sp.status && sp.status in UserStatus ? (sp.status as UserStatus) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.UserWhereInput = {
    isStaff: false,
    ...(status ? { status } : { status: { not: "DELETED" } }),
    ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { tags: { has: q.toLowerCase() } }] } : {}),
  };
  const [total, users, newThisMonth] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { _count: { select: { orders: true, reviews: true } }, wishlists: { select: { _count: { select: { items: true } } } } },
    }),
    db.user.count({ where: { isStaff: false, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } }),
  ]);
  const tabs: [string, string | undefined][] = [["All", undefined], ["Active", "ACTIVE"], ["Suspended", "SUSPENDED"], ["Banned", "BANNED"]];
  return (
    <>
      <PageHeader title="Customers" description={`${total} customer${total === 1 ? "" : "s"} · ${newThisMonth} new in the last 30 days`} actions={<a href="/api/admin/export/customers" className="rounded-full border border-line px-4 py-2 text-sm hover:bg-surface-2">Export CSV</a>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tabs.map(([label, s]) => (
          <Link key={label} href={`/admin/customers${s ? `?status=${s}` : ""}`} className={`rounded-full px-3 py-1.5 text-sm ${status === s ? "bg-fg text-bg" : "border border-line text-muted hover:text-fg"}`}>
            {label}
          </Link>
        ))}
        <div className="ml-auto w-full sm:w-72">
          <AdminProductSearch initial={q ?? ""} />
        </div>
      </div>
      <Table head={["Customer", "Status", "Joined", "Orders", "Wishlist", "Last sign-in"]} empty={!users.length && <p className="p-6 text-center text-sm text-muted">No customers found.</p>}>
        {users.map((u) => (
          <tr key={u.id} className="hover:bg-surface-2/50">
            <td className="px-4 py-3">
              <Link href={`/admin/customers/${u.id}`} className="font-medium hover:underline">{u.name ?? "—"}</Link>
              <span className="block text-xs text-muted">
                {u.email}
                {!u.emailVerifiedAt && <span className="ml-1.5 text-warning">unverified</span>}
              </span>
              {u.tags.length > 0 && <span className="mt-1 block text-[0.7rem] text-subtle">{u.tags.join(" · ")}</span>}
            </td>
            <td className="px-4 py-3"><StatusPill status={u.status} /></td>
            <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{u.createdAt.toLocaleDateString("en-IN")}</td>
            <td className="px-4 py-3 tabular-nums">{u._count.orders}</td>
            <td className="px-4 py-3 tabular-nums">{u.wishlists.reduce((n, w) => n + w._count.items, 0)}</td>
            <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{u.lastLoginAt?.toLocaleDateString("en-IN") ?? "—"}</td>
          </tr>
        ))}
      </Table>
      <div className="mt-6">
        <Pagination page={page} pageCount={Math.ceil(total / PER_PAGE)} hrefFor={(p) => `/admin/customers?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(p) })}`} />
      </div>
    </>
  );
}
