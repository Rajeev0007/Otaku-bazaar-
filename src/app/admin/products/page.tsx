import Link from "next/link";
import { Prisma, ProductStatus } from "@prisma/client";
import { requireStaff, can } from "@/server/auth/session";
import { db } from "@/server/db";
import { formatMoney } from "@/lib/money";
import { PageHeader, StatusPill, Table } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Pagination } from "@/components/ui/misc";
import { ProductImage } from "@/components/store/product-image";
import { AdminProductSearch, BulkBar } from "@/components/admin/product-list-client";

const PER_PAGE = 30;

export default async function AdminProducts({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireStaff("products.read", "/admin/products");
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 80);
  const status = sp.status && sp.status in ProductStatus ? (sp.status as ProductStatus) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.ProductWhereInput = {
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { tags: { has: q.toLowerCase() } }, { variants: { some: { sku: { contains: q, mode: "insensitive" } } } }] } : {}),
  };
  const [total, products, counts] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        category: { select: { name: true } },
        franchise: { select: { name: true } },
        images: { take: 1, orderBy: { position: "asc" } },
        variants: { where: { isActive: true }, select: { inventory: { select: { onHand: true, reserved: true } } } },
      },
    }),
    db.product.groupBy({ by: ["status"], _count: true }),
  ]);
  const href = (p: number) => `/admin/products?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(p) })}`;
  const tabs: [string, string | undefined][] = [["All", undefined], ["Active", "ACTIVE"], ["Draft", "DRAFT"], ["Scheduled", "SCHEDULED"], ["Archived", "ARCHIVED"]];

  return (
    <>
      <PageHeader title="Products" description={`${total} product${total === 1 ? "" : "s"}`} actions={can(user, "products.write") && <ButtonLink href="/admin/products/new" size="md"><Icon name="plus" size={16} /> Add product</ButtonLink>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tabs.map(([label, s]) => {
          const n = s ? (counts.find((c) => c.status === s)?._count ?? 0) : counts.reduce((a, c) => a + c._count, 0);
          return (
            <Link key={label} href={`/admin/products${s ? `?status=${s}` : ""}`} className={`rounded-full px-3 py-1.5 text-sm ${status === s ? "bg-fg text-bg" : "border border-line text-muted hover:text-fg"}`}>
              {label} <span className="opacity-60">{n}</span>
            </Link>
          );
        })}
        <div className="ml-auto w-full sm:w-72">
          <AdminProductSearch initial={q ?? ""} />
        </div>
      </div>
      {/* Phones: simple cards */}
      <ul className="space-y-2 md:hidden">
        {products.map((p) => {
          const stock = p.variants.reduce((n, v) => n + Math.max(0, (v.inventory?.onHand ?? 0) - (v.inventory?.reserved ?? 0)), 0);
          return (
            <li key={p.id}>
              <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 active:bg-surface-2">
                <span className="relative h-16 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">{p.images[0] && <ProductImage src={p.images[0].url} alt="" fill sizes="56px" className="object-cover" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm font-medium">{p.name}</span>
                  <span className="mt-1 flex items-center gap-2 text-xs text-muted">
                    <StatusPill status={p.status} /> {formatMoney(p.minPrice, p.currency)} · <span className={stock === 0 ? "text-danger" : stock < 10 ? "text-warning" : ""}>{stock} in stock</span>
                  </span>
                </span>
                <span className="text-muted">›</span>
              </Link>
            </li>
          );
        })}
        {!products.length && <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">No products found.</p>}
      </ul>
      <div className="hidden md:block">
      <BulkBar canWrite={can(user, "products.write")} canDelete={can(user, "products.delete")}>
        <Table head={["", "Product", "Status", "Stock", "Price", "Category", "Updated"]} empty={!products.length && <p className="p-6 text-center text-sm text-muted">No products found.</p>}>
          {products.map((p) => {
            const stock = p.variants.reduce((n, v) => n + Math.max(0, (v.inventory?.onHand ?? 0) - (v.inventory?.reserved ?? 0)), 0);
            return (
              <tr key={p.id} className="hover:bg-surface-2/50">
                <td className="w-10 px-4 py-3">
                  <input type="checkbox" name="ids" value={p.id} aria-label={`Select ${p.name}`} className="h-4 w-4 accent-[var(--accent)]" />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 hover:underline">
                    <span className="relative h-12 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-2">{p.images[0] && <ProductImage src={p.images[0].url} alt="" fill sizes="40px" className="object-cover" />}</span>
                    <span className="min-w-0">
                      <span className="line-clamp-1 font-medium">{p.name}</span>
                      <span className="text-xs text-muted">{p.franchise?.name ?? "—"} · {p.variants.length} variant{p.variants.length === 1 ? "" : "s"}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3"><StatusPill status={p.status} /></td>
                <td className={`px-4 py-3 tabular-nums ${stock === 0 ? "text-danger" : stock < 10 ? "text-warning" : ""}`}>{stock}</td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatMoney(p.minPrice, p.currency)}{p.maxPrice > p.minPrice && <span className="text-muted"> – {formatMoney(p.maxPrice, p.currency)}</span>}</td>
                <td className="px-4 py-3 text-muted">{p.category.name}</td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{p.updatedAt.toLocaleDateString("en-IN")}</td>
              </tr>
            );
          })}
        </Table>
      </BulkBar>
      </div>
      <div className="mt-6">
        <Pagination page={page} pageCount={Math.ceil(total / PER_PAGE)} hrefFor={href} />
      </div>
    </>
  );
}
