"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ProductCardData } from "@/server/catalog/queries";
import { formatMoney } from "@/lib/money";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useShopper } from "@/components/store/shopper-context";
import { ProductCard } from "@/components/store/product-card";
import { moveWishlistToCartAction, shareWishlistAction, toggleWishlistAction } from "@/app/actions/wishlist";

type Item = ProductCardData & { priceAtAdd: number | null };

export function WishlistGrid({ products }: { products: Item[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">
      {products.map((p) => (
        <div key={p.id} className="flex flex-col">
          <ProductCard product={p} />
          {p.priceAtAdd && p.priceAtAdd > p.minPrice && (
            <p className="mt-2 flex items-center gap-1 px-1 text-xs font-medium text-success">
              <Icon name="tag" size={12} /> Price dropped {formatMoney(p.priceAtAdd - p.minPrice, p.currency)} since you saved it
            </p>
          )}
          <WishlistActions item={p} />
        </div>
      ))}
    </div>
  );
}

function WishlistActions({ item }: { item: Item }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const { setCartCount, setWishlisted } = useShopper();
  const singleInStock = item.variants.length === 1;
  return (
    <div className="mt-3 flex gap-2 px-1">
      {item.inStock ? (
        singleInStock ? (
          <Button
            size="sm"
            className="flex-1"
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await moveWishlistToCartAction(item.id);
                if (!r.ok) return toast({ tone: "error", title: r.error });
                setCartCount(r.count);
                setWishlisted(item.id, false);
                toast({ title: "Moved to cart", description: item.name, action: { label: "View cart", href: "/cart" } });
                router.refresh();
              })
            }
          >
            Move to cart
          </Button>
        ) : (
          <Link href={`/p/${item.slug}`} className="flex h-9 flex-1 items-center justify-center rounded-full bg-fg text-sm font-semibold text-bg">
            Choose options
          </Link>
        )
      ) : (
        <Link href={`/p/${item.slug}`} className="flex h-9 flex-1 items-center justify-center rounded-full border border-line text-sm font-medium text-muted">
          Get restock alert
        </Link>
      )}
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await toggleWishlistAction(item.id);
            if (!r.ok) return toast({ tone: "error", title: r.error });
            setWishlisted(item.id, false);
            router.refresh();
          })
        }
        className="grid h-9 w-9 place-items-center rounded-full border border-line text-muted hover:text-danger"
        aria-label={`Remove ${item.name} from wishlist`}
      >
        <Icon name="trash" size={15} />
      </button>
    </div>
  );
}

export function WishlistShare({ initialUrl }: { initialUrl: string | null }) {
  const [url, setUrl] = useState(initialUrl);
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {url ? (
        <>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              toast({ title: "Share link copied" });
            }}
            className="flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm font-medium hover:bg-surface-2"
          >
            <Icon name="copy" size={15} /> Copy share link
          </button>
          <button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await shareWishlistAction(false);
                if (r.ok) {
                  setUrl(null);
                  toast({ title: "Wishlist is private again" });
                }
              })
            }
            className="h-10 rounded-full px-3 text-sm text-muted hover:text-fg"
          >
            Make private
          </button>
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-10"
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await shareWishlistAction(true);
              if (!r.ok) return toast({ tone: "error", title: r.error });
              setUrl(r.url);
              if (r.url) {
                await navigator.clipboard.writeText(r.url).catch(() => undefined);
                toast({ title: "Share link created and copied", description: "Anyone with the link can view your wishlist." });
              }
            })
          }
        >
          <Icon name="share" size={15} /> Share wishlist
        </Button>
      )}
    </div>
  );
}
