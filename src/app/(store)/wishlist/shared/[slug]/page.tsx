import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSharedWishlist } from "@/server/wishlist/service";
import { ProductGrid } from "@/components/store/product-rail";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Shared wishlist", robots: { index: false } };

export default async function SharedWishlistPage({ params }: { params: Promise<{ slug: string }> }) {
  const list = await getSharedWishlist((await params).slug);
  if (!list) notFound();
  return (
    <div className="container-page pb-16 pt-8">
      <p className="eyebrow mb-2">Shared wishlist</p>
      <h1 className="mb-8 text-3xl font-semibold">{list.owner}'s wishlist</h1>
      {list.products.length ? <ProductGrid products={list.products} /> : <EmptyState icon="heart" title="This wishlist is empty" />}
    </div>
  );
}
