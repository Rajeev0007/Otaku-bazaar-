import { Prisma, ProductKind } from "@prisma/client";
import { cache } from "react";
import { db } from "@/server/db";
import { PAGE_SIZE, type ListingFilters } from "@/lib/catalog-filters";
import { toMinor } from "@/lib/money";
import { searchProductIds } from "@/server/catalog/search";

export const productCardSelect = {
  id: true,
  slug: true,
  name: true,
  subtitle: true,
  kind: true,
  currency: true,
  minPrice: true,
  maxPrice: true,
  maxCompareAt: true,
  discountPercent: true,
  inStock: true,
  ratingAvg: true,
  ratingCount: true,
  isLimited: true,
  isNewArrival: true,
  createdAt: true,
  franchise: { select: { name: true, slug: true } },
  category: { select: { name: true, slug: true } },
  images: { orderBy: { position: "asc" }, take: 2, where: { isCustomerPhoto: false }, select: { url: true, alt: true } },
  variants: {
    where: { isActive: true },
    orderBy: { position: "asc" },
    take: 12,
    select: { id: true, title: true, color: true, colorHex: true, size: true, price: true, inventory: { select: { onHand: true, reserved: true, allowBackorder: true } } },
  },
} satisfies Prisma.ProductSelect;

export type ProductCardData = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

/** Products visible to shoppers: active, and launched if scheduled. */
export function visibleWhere(): Prisma.ProductWhereInput {
  return { status: "ACTIVE", OR: [{ launchAt: null }, { launchAt: { lte: new Date() } }] };
}

export type ListingScope = { categorySlug?: string; franchiseSlug?: string; collectionSlug?: string };

async function scopeWhere(scope: ListingScope): Promise<Prisma.ProductWhereInput> {
  const where: Prisma.ProductWhereInput[] = [visibleWhere()];
  if (scope.categorySlug) {
    // Category pages include products in direct subcategories.
    const cat = await db.category.findUnique({ where: { slug: scope.categorySlug }, select: { id: true, children: { select: { id: true } } } });
    where.push({ categoryId: { in: cat ? [cat.id, ...cat.children.map((c) => c.id)] : [] } });
  }
  if (scope.franchiseSlug) where.push({ franchise: { slug: scope.franchiseSlug } });
  if (scope.collectionSlug) where.push({ collections: { some: { collection: { slug: scope.collectionSlug } } } });
  return { AND: where };
}

function orderBy(sort: ListingFilters["sort"]): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "newest":
      return [{ createdAt: "desc" }];
    case "price_asc":
      return [{ minPrice: "asc" }, { id: "asc" }];
    case "price_desc":
      return [{ minPrice: "desc" }, { id: "asc" }];
    case "rating":
      return [{ ratingAvg: "desc" }, { ratingCount: "desc" }];
    case "discount":
      return [{ discountPercent: "desc" }, { salesCount: "desc" }];
    case "bestselling":
      return [{ salesCount: "desc" }, { ratingAvg: "desc" }];
    case "trending":
      return [{ trendingScore: "desc" }, { createdAt: "desc" }];
    case "popular":
      return [{ viewCount: "desc" }, { salesCount: "desc" }];
    default:
      return [{ isFeatured: "desc" }, { inStock: "desc" }, { trendingScore: "desc" }, { createdAt: "desc" }];
  }
}

export async function listProducts(filters: ListingFilters, scope: ListingScope = {}, currency = "INR") {
  const base = await scopeWhere(scope);
  const and: Prisma.ProductWhereInput[] = [base];

  let searchIds: string[] | null = null;
  if (filters.q) {
    searchIds = await searchProductIds(filters.q, 500);
    and.push({ id: { in: searchIds } });
  }
  if (filters.categories.length) {
    and.push({ OR: [{ category: { slug: { in: filters.categories } } }, { category: { parent: { slug: { in: filters.categories } } } }] });
  }
  if (filters.anime.length) and.push({ franchise: { slug: { in: filters.anime } } });
  if (filters.brands.length) and.push({ brand: { slug: { in: filters.brands } } });
  if (filters.types.length) and.push({ kind: { in: filters.types as ProductKind[] } });
  if (filters.sizes.length) and.push({ variants: { some: { isActive: true, size: { in: filters.sizes } } } });
  if (filters.colors.length) and.push({ variants: { some: { isActive: true, color: { in: filters.colors, mode: "insensitive" } } } });
  if (filters.minPrice !== undefined) and.push({ minPrice: { gte: toMinor(filters.minPrice, currency) } });
  if (filters.maxPrice !== undefined) and.push({ minPrice: { lte: toMinor(filters.maxPrice, currency) } });
  if (filters.rating) and.push({ ratingAvg: { gte: filters.rating } });
  if (filters.discount) and.push({ discountPercent: { gte: filters.discount } });
  if (filters.sale) and.push({ discountPercent: { gt: 0 } });
  if (filters.inStock) and.push({ inStock: true });
  if (filters.isNew) and.push({ isNewArrival: true });
  if (filters.limited) and.push({ isLimited: true });

  const where: Prisma.ProductWhereInput = { AND: and };
  const relevance = !!searchIds && filters.sort === "featured";

  const [total, rows] = await Promise.all([
    db.product.count({ where }),
    relevance
      ? db.product.findMany({ where, select: productCardSelect })
      : db.product.findMany({ where, select: productCardSelect, orderBy: orderBy(filters.sort), skip: (filters.page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ]);

  // Keep search relevance order when sorting by "featured".
  const products = relevance
    ? rows.sort((a, b) => searchIds!.indexOf(a.id) - searchIds!.indexOf(b.id)).slice((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE)
    : rows;

  return { products, total, page: filters.page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export type Facets = Awaited<ReturnType<typeof getFacets>>;

/** Filter options available within the page scope (category / anime / collection). */
export const getFacets = cache(async (scopeKey: string, scope: ListingScope) => {
  void scopeKey;
  const where = await scopeWhere(scope);
  const [categoryGroups, franchiseGroups, brandGroups, sizes, colors, price] = await Promise.all([
    db.product.groupBy({ by: ["categoryId"], where, _count: true }),
    db.product.groupBy({ by: ["franchiseId"], where, _count: true }),
    db.product.groupBy({ by: ["brandId"], where, _count: true }),
    db.productVariant.findMany({ where: { isActive: true, size: { not: null }, product: where }, distinct: ["size"], select: { size: true } }),
    db.productVariant.findMany({ where: { isActive: true, color: { not: null }, product: where }, distinct: ["color"], select: { color: true, colorHex: true } }),
    db.product.aggregate({ where, _min: { minPrice: true }, _max: { maxPrice: true } }),
  ]);
  const [cats, franchises, brands] = await Promise.all([
    db.category.findMany({ where: { id: { in: categoryGroups.map((g) => g.categoryId) } }, select: { id: true, slug: true, name: true } }),
    db.animeFranchise.findMany({ where: { id: { in: franchiseGroups.map((g) => g.franchiseId).filter((x): x is string => !!x) } }, select: { id: true, slug: true, name: true } }),
    db.brand.findMany({ where: { id: { in: brandGroups.map((g) => g.brandId).filter((x): x is string => !!x) } }, select: { id: true, slug: true, name: true } }),
  ]);
  const count = <T extends { _count: number }>(groups: T[], key: keyof T, id: string) => groups.find((g) => g[key] === id)?._count ?? 0;
  const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
  return {
    categories: cats.map((c) => ({ value: c.slug, label: c.name, count: count(categoryGroups, "categoryId", c.id) })).sort((a, b) => b.count - a.count),
    anime: franchises.map((f) => ({ value: f.slug, label: f.name, count: count(franchiseGroups, "franchiseId", f.id) })).sort((a, b) => a.label.localeCompare(b.label)),
    brands: brands.map((b) => ({ value: b.slug, label: b.name, count: count(brandGroups, "brandId", b.id) })),
    sizes: sizes
      .map((s) => s.size!)
      .sort((a, b) => (SIZE_ORDER.indexOf(a) + 1 || 99) - (SIZE_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b)),
    colors: colors.map((c) => ({ name: c.color!, hex: c.colorHex })).sort((a, b) => a.name.localeCompare(b.name)),
    priceMin: price._min.minPrice ?? 0,
    priceMax: price._max.maxPrice ?? 0,
  };
});

// ── Rails for the homepage and product pages ──

export type RailSource = "trending" | "bestsellers" | "new" | "limited" | "top_rated" | "deals" | "featured" | "recent";

export async function productRail(source: RailSource, take = 12, extra: Prisma.ProductWhereInput = {}): Promise<ProductCardData[]> {
  const where: Prisma.ProductWhereInput = { AND: [visibleWhere(), extra] };
  const map: Record<RailSource, { where?: Prisma.ProductWhereInput; orderBy: Prisma.ProductOrderByWithRelationInput[] }> = {
    trending: { orderBy: [{ trendingScore: "desc" }] },
    bestsellers: { orderBy: [{ salesCount: "desc" }] },
    new: { where: { isNewArrival: true }, orderBy: [{ createdAt: "desc" }] },
    recent: { orderBy: [{ createdAt: "desc" }] },
    limited: { where: { isLimited: true }, orderBy: [{ createdAt: "desc" }] },
    top_rated: { where: { ratingCount: { gte: 1 } }, orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }] },
    deals: { where: { discountPercent: { gte: 10 } }, orderBy: [{ discountPercent: "desc" }] },
    featured: { where: { isFeatured: true }, orderBy: [{ trendingScore: "desc" }] },
  };
  const cfg = map[source];
  return db.product.findMany({ where: { AND: [where, cfg.where ?? {}] }, orderBy: cfg.orderBy, take, select: productCardSelect });
}

export async function productsByIds(ids: string[]): Promise<ProductCardData[]> {
  if (!ids.length) return [];
  const rows = await db.product.findMany({ where: { AND: [visibleWhere(), { id: { in: ids } }] }, select: productCardSelect });
  return rows.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
}

// ── Product detail ──

export const getProductBySlug = cache(async (slug: string) => {
  return db.product.findFirst({
    where: { AND: [visibleWhere(), { slug }] },
    include: {
      category: { include: { parent: true } },
      franchise: true,
      brand: true,
      images: { where: { isCustomerPhoto: false }, orderBy: { position: "asc" } },
      variants: { where: { isActive: true }, orderBy: { position: "asc" }, include: { inventory: true } },
      bundleItems: { include: { child: { select: { name: true, slug: true } } } },
    },
  });
});

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>;

export async function ratingBreakdown(productId: string) {
  const groups = await db.review.groupBy({ by: ["rating"], where: { productId, status: "APPROVED" }, _count: true });
  return [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: groups.find((g) => g.rating === r)?._count ?? 0 }));
}

export async function relatedProducts(p: Pick<ProductDetail, "id" | "franchiseId" | "categoryId">, take = 12) {
  const or: Prisma.ProductWhereInput[] = [{ categoryId: p.categoryId }];
  if (p.franchiseId) or.unshift({ franchiseId: p.franchiseId });
  const rows = await db.product.findMany({
    where: { AND: [visibleWhere(), { id: { not: p.id } }, { OR: or }] },
    orderBy: [{ trendingScore: "desc" }],
    take: take * 2,
    select: { ...productCardSelect, franchiseId: true, categoryId: true },
  });
  // Same anime first, then same category.
  return rows
    .sort((a, b) => Number(b.franchiseId === p.franchiseId) - Number(a.franchiseId === p.franchiseId))
    .slice(0, take);
}

/**
 * Items frequently bought with this product, from order co-occurrence. Falls back to same-anime items in other
 * categories until there is enough order history.
 */
export async function frequentlyBoughtTogether(p: Pick<ProductDetail, "id" | "franchiseId" | "categoryId">, take = 3) {
  const rows = await db.$queryRaw<{ productId: string }[]>`
    SELECT v2."productId", count(*) AS n
    FROM "OrderItem" a
    JOIN "ProductVariant" v1 ON v1."id" = a."variantId"
    JOIN "OrderItem" b ON b."orderId" = a."orderId" AND b."id" <> a."id"
    JOIN "ProductVariant" v2 ON v2."id" = b."variantId"
    WHERE v1."productId" = ${p.id} AND v2."productId" <> ${p.id}
    GROUP BY v2."productId" ORDER BY n DESC LIMIT ${take}`;
  if (rows.length >= take) return productsByIds(rows.map((r) => r.productId));
  const fallback = await db.product.findMany({
    where: { AND: [visibleWhere(), { id: { notIn: [p.id, ...rows.map((r) => r.productId)] } }, { inStock: true }, p.franchiseId ? { franchiseId: p.franchiseId } : {}, { categoryId: { not: p.categoryId } }] },
    orderBy: { salesCount: "desc" },
    take: take - rows.length,
    select: productCardSelect,
  });
  return [...(await productsByIds(rows.map((r) => r.productId))), ...fallback];
}

// ── Navigation ──

export const getNavigation = cache(async () => {
  const [categories, franchises] = await Promise.all([
    db.category.findMany({
      where: { isActive: true, showInMenu: true, parentId: null },
      orderBy: { position: "asc" },
      select: { slug: true, name: true, imageUrl: true, children: { where: { isActive: true }, orderBy: { position: "asc" }, select: { slug: true, name: true } } },
    }),
    db.animeFranchise.findMany({ orderBy: [{ isTrending: "desc" }, { position: "asc" }], take: 12, select: { slug: true, name: true, isTrending: true, imageUrl: true } }),
  ]);
  return { categories, franchises };
});
