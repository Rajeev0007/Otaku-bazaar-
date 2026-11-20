import { notFound } from "next/navigation";
import { requireStaff } from "@/server/auth/session";
import { db } from "@/server/db";
import { PageHeader, Table } from "@/components/admin/ui";

export default async function StockHistoryPage({ params }: { params: Promise<{ variantId: string }> }) {
  const { variantId } = await params;
  await requireStaff("inventory.read", `/admin/inventory/${variantId}`);
  const v = await db.productVariant.findUnique({
    where: { id: variantId },
    include: { product: { select: { name: true } }, inventory: { include: { transactions: { orderBy: { createdAt: "desc" }, take: 200 } } } },
  });
  if (!v || !v.inventory) notFound();
  const actorIds = [...new Set(v.inventory.transactions.map((t) => t.actorId).filter((x): x is string => !!x))];
  const actors = await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } });
  return (
    <>
      <PageHeader title={`${v.product.name} · ${v.title}`} description={`SKU ${v.sku} · On hand ${v.inventory.onHand} · Reserved ${v.inventory.reserved}`} back={{ href: "/admin/inventory", label: "Inventory" }} />
      <Table head={["When", "Change", "On hand after", "Reason", "Note", "By"]}>
        {v.inventory.transactions.map((t) => {
          const a = actors.find((x) => x.id === t.actorId);
          return (
            <tr key={t.id}>
              <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted">{t.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
              <td className={`px-4 py-2.5 font-semibold tabular-nums ${t.delta > 0 ? "text-success" : "text-danger"}`}>{t.delta > 0 ? `+${t.delta}` : t.delta}</td>
              <td className="px-4 py-2.5 tabular-nums">{t.onHandAfter}</td>
              <td className="px-4 py-2.5 text-xs">{t.reason}</td>
              <td className="px-4 py-2.5 text-xs text-muted">{t.note ?? "—"}{t.refType ? ` (${t.refType} ${t.refId})` : ""}</td>
              <td className="px-4 py-2.5 text-xs text-muted">{a?.name ?? a?.email ?? "System"}</td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
