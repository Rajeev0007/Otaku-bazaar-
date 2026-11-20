import Link from "next/link";
import { Prisma } from "@prisma/client";
import { requireStaff, can } from "@/server/auth/session";
import { db } from "@/server/db";
import { PageHeader, Table } from "@/components/admin/ui";
import { Pagination } from "@/components/ui/misc";
import { AdminProductSearch } from "@/components/admin/product-list-client";
import { StockEditor } from "@/components/admin/stock-editor";

const PER_PAGE = 50;

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireStaff("inventory.read", "/admin/inventory");
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 80);
  const filter = sp.filter === "low" || sp.filter === "out" ? sp.filter : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  // Low/out filters compare two columns, so resolve matching IDs with SQL first.
  let idFilter: string[] | undefined;
  if (filter) {
    const rows = await db.$queryRaw<{ id: string }[]>(
      filter === "out"
        ? Prisma.sql`SELECT "id" FROM "InventoryItem" WHERE "onHand" - "reserved" <= 0`
        : Prisma.sql`SELECT "id" FROM "InventoryItem" WHERE "onHand" - "reserved" <= "lowStockThreshold"`,
    );
    idFilter = rows.map((r) => r.id);
  }
  const where: Prisma.InventoryItemWhereInput = {
    variant: { isActive: true, product: { status: { not: "ARCHIVED" } }, ...(q ? { OR: [{ sku: { contains: q, mode: "insensitive" } }, { product: { name: { contains: q, mode: "insensitive" } } }] } : {}) },
    ...(idFilter ? { id: { in: idFilter } } : {}),
  };
  const [total, items] = await Promise.all([
    db.inventoryItem.count({ where }),
    db.inventoryItem.findMany({
      where,
      orderBy: [{ onHand: "asc" }, { variant: { sku: "asc" } }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        variant: { select: { id: true, sku: true, title: true, product: { select: { id: true, name: true } } } },
        transactions: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
  ]);
  const writable = can(user, "inventory.write");
  const tabs: [string, string | undefined][] = [["All", undefined], ["Low stock", "low"], ["Out of stock", "out"]];

  return (
    <>
      <PageHeader title="Inventory" description="Every change is recorded in the stock ledger with who, when and why." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tabs.map(([label, f]) => (
          <Link key={label} href={`/admin/inventory${f ? `?filter=${f}` : ""}`} className={`rounded-full px-3 py-1.5 text-sm ${filter === f ? "bg-fg text-bg" : "border border-line text-muted hover:text-fg"}`}>
            {label}
          </Link>
        ))}
        <div className="ml-auto w-full sm:w-72">
          <AdminProductSearch initial={q ?? ""} />
        </div>
      </div>
      <Table head={["Variant", "SKU", "On hand", "Reserved", "Available", "Alert at", "Last change", writable ? "Adjust" : ""]} empty={!items.length && <p className="p-6 text-center text-sm text-muted">No matching stock records.</p>}>
        {items.map((i) => {
          const available = i.onHand - i.reserved;
          const last = i.transactions[0];
          return (
            <tr key={i.id}>
              <td className="px-4 py-3">
                <Link href={`/admin/products/${i.variant.product.id}`} className="font-medium hover:underline">{i.variant.product.name}</Link>
                <span className="block text-xs text-muted">{i.variant.title}</span>
              </td>
              <td className="px-4 py-3 font-mono text-xs">{i.variant.sku}</td>
              <td className="px-4 py-3 tabular-nums">{i.onHand}</td>
              <td className="px-4 py-3 tabular-nums text-muted">{i.reserved}</td>
              <td className={`px-4 py-3 font-semibold tabular-nums ${available <= 0 ? "text-danger" : available <= i.lowStockThreshold ? "text-warning" : "text-success"}`}>{available}</td>
              <td className="px-4 py-3 tabular-nums text-muted">{i.lowStockThreshold}</td>
              <td className="px-4 py-3 text-xs text-muted">
                {last ? (
                  <>
                    <span className={last.delta > 0 ? "text-success" : "text-danger"}>{last.delta > 0 ? `+${last.delta}` : last.delta}</span> {last.reason.toLowerCase()} · {last.createdAt.toLocaleDateString("en-IN")}
                    <Link href={`/admin/inventory/${i.variant.id}`} className="ml-2 underline-offset-2 hover:underline">History</Link>
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3">{writable && <StockEditor variantId={i.variant.id} onHand={i.onHand} />}</td>
            </tr>
          );
        })}
      </Table>
      <div className="mt-6">
        <Pagination page={page} pageCount={Math.ceil(total / PER_PAGE)} hrefFor={(p) => `/admin/inventory?${new URLSearchParams({ ...(q ? { q } : {}), ...(filter ? { filter } : {}), page: String(p) })}`} />
      </div>
    </>
  );
}
