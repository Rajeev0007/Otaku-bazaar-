import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { ORDER_STATUS_LABEL } from "@/lib/checkout";
import { formatMoney } from "@/lib/money";
import { Breadcrumbs, EmptyState } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { ProductImage } from "@/components/store/product-image";

export const metadata: Metadata = { title: "My orders", robots: { index: false } };

export default async function MyOrders() {
  const user = await requireUser("/account/orders");
  // Also show guest orders placed with the same (verified) email.
  const orders = await db.order.findMany({
    where: { OR: [{ userId: user.id }, ...(user.emailVerifiedAt ? [{ email: user.email, userId: null }] : [])] },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { items: { take: 4 } },
  });
  return (
    <div className="container-page max-w-4xl pb-16 pt-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "My account", href: "/account" }, { label: "Orders" }]} />
      <h1 className="mb-6 mt-5 text-3xl font-semibold">My orders</h1>
      {orders.length ? (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/order/${o.number}`} className="flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 transition hover:border-line-strong">
                <div className="flex -space-x-3">
                  {o.items.map((i) => (
                    <div key={i.id} className="relative h-14 w-11 overflow-hidden rounded-lg border-2 border-surface bg-surface-2">{i.imageUrl && <ProductImage src={i.imageUrl} alt="" fill sizes="44px" className="object-cover" />}</div>
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{o.number}</p>
                  <p className="text-xs text-muted">{o.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })} · {o.items.length} item{o.items.length === 1 ? "" : "s"}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatMoney(o.grandTotal, o.currency)}</p>
                  <p className="text-xs text-muted">{ORDER_STATUS_LABEL[o.status]}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon="package" title="No orders yet" description="When you place an order it'll show up here." action={<ButtonLink href="/shop?sort=trending">Start shopping</ButtonLink>} />
      )}
    </div>
  );
}
