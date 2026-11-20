import type { Metadata } from "next";
import { getCurrentUser } from "@/server/auth/session";
import { getDefaultWishlist, getWishlistProducts } from "@/server/wishlist/service";
import { Breadcrumbs, EmptyState } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { WishlistGrid, WishlistShare } from "@/components/store/wishlist-client";
import { appUrl } from "@/lib/utils";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="container-page py-10">
        <EmptyState
          icon="heart"
          title="Save your favourites"
          description="Sign in to build a wishlist that syncs across your phone and laptop, get price-drop and restock alerts, and share it with friends."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <ButtonLink href="/login?next=/wishlist">Sign in</ButtonLink>
              <ButtonLink href="/register?next=/wishlist" variant="outline">Create account</ButtonLink>
            </div>
          }
        />
      </div>
    );
  }
  const list = await getDefaultWishlist(user.id);
  const products = await getWishlistProducts(list.id);
  const shareUrl = list.isPublic && list.shareSlug ? appUrl(`/wishlist/shared/${list.shareSlug}`) : null;
  return (
    <div className="container-page pb-16 pt-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Wishlist" }]} />
      <div className="mb-8 mt-5 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-semibold sm:text-4xl">
          Wishlist {products.length > 0 && <span className="text-muted">({products.length})</span>}
        </h1>
        {products.length > 0 && <WishlistShare initialUrl={shareUrl} />}
      </div>
      {products.length ? (
        <WishlistGrid products={products} />
      ) : (
        <EmptyState icon="heart" title="Your wishlist is empty" description="Tap the heart on any product to save it here." action={<ButtonLink href="/shop?sort=trending">Discover trending</ButtonLink>} />
      )}
    </div>
  );
}
