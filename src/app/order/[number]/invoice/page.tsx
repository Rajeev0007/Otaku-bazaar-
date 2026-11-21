import { notFound } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { canViewOrder } from "@/server/orders/access";
import { getStoreSettings } from "@/server/settings";
import { Invoice } from "@/components/orders/invoice";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoice", robots: { index: false } };

export default async function CustomerInvoice({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string }> }) {
  const { number } = await params;
  const o = await canViewOrder(number, await getCurrentUser(), (await searchParams).t);
  if (!o || o.status === "PENDING_PAYMENT" || o.status === "CANCELLED") notFound();
  return <Invoice order={o} items={o.items} settings={await getStoreSettings()} />;
}
