import type { Metadata } from "next";
import { buildCartView } from "@/server/cart/service";
import { getCurrentCart } from "@/server/shopper";
import { productRail } from "@/server/catalog/queries";
import { CartPageClient } from "@/components/store/cart-page";
import { ProductRail } from "@/components/store/product-rail";
import { Breadcrumbs } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Your cart", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const view = await buildCartView(await getCurrentCart());
  const inCart = new Set([...view.lines, ...view.saved].map((l) => l.productId));
  const recommended = (await productRail("trending", 16, { inStock: true })).filter((p) => !inCart.has(p.id)).slice(0, 12);
  return (
    <>
      <div className="container-page pb-6 pt-6">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cart" }]} />
        <h1 className="mb-8 mt-5 text-3xl font-semibold sm:text-4xl">
          Your cart {view.itemCount > 0 && <span className="text-muted">({view.itemCount})</span>}
        </h1>
        <CartPageClient view={view} />
      </div>
      <ProductRail title={view.lines.length ? "You might also like" : "Trending now"} products={recommended} href="/shop?sort=trending" />
    </>
  );
}
