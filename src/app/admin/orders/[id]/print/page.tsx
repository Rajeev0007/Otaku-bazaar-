import { notFound } from "next/navigation";
import { requireStaff } from "@/server/auth/session";
import { db } from "@/server/db";
import { getStoreSettings } from "@/server/settings";
import { Invoice } from "@/components/orders/invoice";

export default async function PrintOrder({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string }> }) {
  const { id } = await params;
  await requireStaff("orders.read", `/admin/orders/${id}`);
  const o = await db.order.findUnique({ where: { id }, include: { items: true } });
  if (!o) notFound();
  return (
    <div className="fixed inset-0 z-[300] overflow-auto bg-white">
      <Invoice order={o} items={o.items} settings={await getStoreSettings()} kind={(await searchParams).kind === "packing" ? "packing" : "invoice"} />
    </div>
  );
}
