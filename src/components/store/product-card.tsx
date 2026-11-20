import Link from "next/link";
import type { ProductCardData } from "@/server/catalog/queries";
import { cn } from "@/lib/utils";
import { Badge, Price, Rating } from "@/components/ui/misc";
import { ProductImage } from "@/components/store/product-image";
import { WishlistButton } from "@/components/store/wishlist-button";
import { QuickAdd } from "@/components/store/quick-add";

// Plain (non-async) component so it renders in both server pages and client widgets.
export function ProductCard({ product, priority, layout = "grid", className }: { product: ProductCardData; priority?: boolean; layout?: "grid" | "list"; className?: string }) {
  const [img, hover] = product.images;
  const colors = [...new Map(product.variants.filter((v) => v.color).map((v) => [v.color, v.colorHex])).entries()];
  const href = `/p/${product.slug}`;
  const variants = product.variants.map((v) => ({
    id: v.id,
    title: v.title,
    available: v.inventory ? (v.inventory.allowBackorder ? 99 : v.inventory.onHand - v.inventory.reserved) : 0,
  }));
  const badge = !product.inStock ? (
    <Badge tone="glass">Sold out</Badge>
  ) : product.isLimited ? (
    <Badge tone="gold">Limited</Badge>
  ) : product.discountPercent >= 10 ? (
    <Badge tone="accent">-{product.discountPercent}%</Badge>
  ) : product.isNewArrival ? (
    <Badge tone="glass">New</Badge>
  ) : null;

  if (layout === "list") {
    return (
      <article className={cn("group relative flex gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-3 transition hover:border-line-strong sm:gap-6", className)}>
        <Link href={href} className="relative aspect-[4/5] w-32 shrink-0 overflow-hidden rounded-2xl bg-surface-2 sm:w-44">
          {img && <ProductImage src={img.url} alt={img.alt} fill sizes="176px" className="object-cover transition duration-700 group-hover:scale-105" />}
          {badge && <div className="absolute left-2 top-2">{badge}</div>}
        </Link>
        <div className="flex min-w-0 flex-1 flex-col py-1">
          {product.franchise && <p className="eyebrow mb-1">{product.franchise.name}</p>}
          <h3 className="line-clamp-2 font-medium">
            <Link href={href} className="after:absolute after:inset-0 after:content-['']">{product.name}</Link>
          </h3>
          <p className="mt-1 text-xs text-muted">{product.category.name}</p>
          {product.ratingCount > 0 && <Rating value={product.ratingAvg} count={product.ratingCount} className="mt-2" />}
          <Price amount={product.minPrice} compareAt={product.maxCompareAt} currency={product.currency} from={product.maxPrice > product.minPrice} className="mt-auto pt-3" />
          <div className="relative z-10 mt-3 flex items-center gap-2">
            <QuickAdd productName={product.name} variants={variants} inStock={product.inStock} href={href} />
            <WishlistButton productId={product.id} productName={product.name} variant="inline" />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={cn("group relative flex flex-col", className)}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-surface-2">
        {img && (
          <ProductImage
            src={img.url}
            alt={img.alt}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 48vw"
            className={cn("object-cover transition duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.04]", hover && "group-hover:opacity-0")}
          />
        )}
        {hover && <ProductImage src={hover.url} alt="" fill sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 48vw" className="object-cover opacity-0 transition duration-700 group-hover:scale-[1.04] group-hover:opacity-100" />}
        {badge && <div className="absolute left-3 top-3 z-10">{badge}</div>}
        <div className="absolute right-2.5 top-2.5 z-10">
          <WishlistButton productId={product.id} productName={product.name} />
        </div>
        <div className="absolute inset-x-2.5 bottom-2.5 z-10 translate-y-2 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 max-md:hidden">
          <QuickAdd productName={product.name} variants={variants} inStock={product.inStock} href={href} full />
        </div>
      </div>
      <div className="flex flex-1 flex-col px-1 pt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="eyebrow truncate">{product.franchise?.name ?? product.category.name}</p>
          {product.ratingCount > 0 && (
            <span className="flex shrink-0 items-center gap-1 text-xs text-muted">
              <span className="text-gold">★</span>
              {product.ratingAvg.toFixed(1)}
            </span>
          )}
        </div>
        <h3 className="mt-1 line-clamp-2 text-[0.92rem] font-medium leading-snug">
          <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {product.name}
          </Link>
        </h3>
        <Price amount={product.minPrice} compareAt={product.maxCompareAt} currency={product.currency} from={product.maxPrice > product.minPrice} size="sm" className="mt-1.5" />
        {colors.length > 1 && (
          <div className="mt-2 flex items-center gap-1" aria-label={`${colors.length} colours`}>
            {colors.slice(0, 5).map(([name, hex]) => (
              <span key={name} title={name ?? ""} className="h-3 w-3 rounded-full border border-line-strong" style={{ background: hex ?? "#888" }} />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div>
      <div className="skeleton aspect-[4/5] rounded-[var(--radius-card)]" />
      <div className="skeleton mt-3 h-3 w-1/3 rounded" />
      <div className="skeleton mt-2 h-4 w-4/5 rounded" />
      <div className="skeleton mt-2 h-4 w-1/4 rounded" />
    </div>
  );
}
