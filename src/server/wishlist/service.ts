import { db } from "@/server/db";
import { randomToken } from "@/server/security/crypto";
import { productCardSelect, visibleWhere } from "@/server/catalog/queries";

export async function getDefaultWishlist(userId: string) {
  const existing = await db.wishlist.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
  return existing ?? db.wishlist.create({ data: { userId } });
}

export async function wishlistProductIds(userId: string): Promise<string[]> {
  const items = await db.wishlistItem.findMany({ where: { wishlist: { userId } }, select: { productId: true } });
  return items.map((i) => i.productId);
}

/** Adds or removes a product. Returns true when the product is now in the wishlist. */
export async function toggleWishlist(userId: string, productId: string): Promise<boolean> {
  const product = await db.product.findFirst({ where: { AND: [visibleWhere(), { id: productId }] }, select: { id: true, minPrice: true } });
  if (!product) throw new Error("This product is not available.");
  const list = await getDefaultWishlist(userId);
  const removed = await db.wishlistItem.deleteMany({ where: { wishlistId: list.id, productId } });
  if (removed.count > 0) return false;
  // priceAtAdd lets price-drop alerts compare against what the shopper saw.
  await db.wishlistItem.upsert({
    where: { wishlistId_productId: { wishlistId: list.id, productId } },
    create: { wishlistId: list.id, productId, priceAtAdd: product.minPrice },
    update: {},
  });
  return true;
}

export async function getWishlistProducts(wishlistId: string) {
  const items = await db.wishlistItem.findMany({
    where: { wishlistId, product: visibleWhere() },
    orderBy: { addedAt: "desc" },
    include: { product: { select: productCardSelect } },
  });
  return items.map((i) => ({ ...i.product, priceAtAdd: i.priceAtAdd, addedAt: i.addedAt }));
}

export async function setWishlistSharing(userId: string, isPublic: boolean) {
  const list = await getDefaultWishlist(userId);
  return db.wishlist.update({
    where: { id: list.id },
    data: { isPublic, shareSlug: isPublic ? (list.shareSlug ?? randomToken(9)) : list.shareSlug },
  });
}

export async function getSharedWishlist(shareSlug: string) {
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(shareSlug)) return null;
  const list = await db.wishlist.findUnique({ where: { shareSlug }, include: { user: { select: { name: true } } } });
  if (!list || !list.isPublic) return null;
  return { name: list.name, owner: list.user.name?.split(" ")[0] ?? "A fan", products: await getWishlistProducts(list.id) };
}

export async function recordView(userId: string | null, productId: string) {
  await db.product.update({ where: { id: productId }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);
  if (!userId) return;
  await db.recentlyViewed
    .upsert({ where: { userId_productId: { userId, productId } }, create: { userId, productId }, update: { viewedAt: new Date() } })
    .catch(() => undefined);
}

export async function recentlyViewedIds(userId: string, take = 12) {
  const rows = await db.recentlyViewed.findMany({ where: { userId }, orderBy: { viewedAt: "desc" }, take, select: { productId: true } });
  return rows.map((r) => r.productId);
}
