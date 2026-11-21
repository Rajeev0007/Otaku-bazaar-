import { db, type Tx } from "@/server/db";
import { discountPercent } from "@/lib/money";

export function buildSearchText(parts: (string | null | undefined)[]): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Recomputes the denormalised fields on Product (price range, discount, stock flag, search text)
 * from its variants and inventory. Call after any variant, price, stock, or taxonomy change.
 */
export async function syncProductAggregates(productId: string, tx: Tx | typeof db = db) {
  const p = await tx.product.findUnique({
    where: { id: productId },
    include: {
      category: { select: { name: true } },
      franchise: { select: { name: true } },
      brand: { select: { name: true } },
      variants: { where: { isActive: true }, include: { inventory: true } },
    },
  });
  if (!p) return;
  const prices = p.variants.map((v) => v.price);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;
  const best = p.variants.reduce((acc, v) => Math.max(acc, discountPercent(v.price, v.compareAtPrice)), 0);
  const maxCompareAt = p.variants.reduce<number | null>((acc, v) => (v.compareAtPrice && v.compareAtPrice > (acc ?? 0) ? v.compareAtPrice : acc), null);
  const inStock = p.variants.some((v) => v.inventory && (v.inventory.allowBackorder || v.inventory.onHand - v.inventory.reserved > 0));

  await tx.product.update({
    where: { id: productId },
    data: {
      minPrice,
      maxPrice,
      maxCompareAt,
      discountPercent: best,
      inStock,
      searchText: buildSearchText([
        p.name,
        p.subtitle,
        p.franchise?.name,
        p.category.name,
        p.brand?.name,
        ...p.tags,
        ...p.variants.flatMap((v) => [v.sku, v.color, v.size, v.style]),
      ]),
    },
  });
}

/** Recomputes a product's average rating and count from approved reviews. */
export async function recomputeRating(productId: string, tx: Tx | typeof db = db) {
  const agg = await tx.review.aggregate({ where: { productId, status: "APPROVED" }, _avg: { rating: true }, _count: true });
  await tx.product.update({
    where: { id: productId },
    data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count },
  });
}
