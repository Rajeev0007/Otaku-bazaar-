// Cart domain logic (no Next.js imports). Prices are always read from the database, never from the client.
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { randomToken, sha256 } from "@/server/security/crypto";
import { availableQuantity } from "@/server/inventory/service";
import { getStoreSettings } from "@/server/settings";
import { inclusiveTax } from "@/lib/money";

export class CartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CartError";
  }
}

export type CartOwner = { userId?: string | null; guestToken?: string | null };

const cartInclude = {
  items: {
    orderBy: { addedAt: "asc" },
    include: {
      variant: {
        include: {
          inventory: true,
          product: {
            select: {
              id: true,
              slug: true,
              name: true,
              status: true,
              currency: true,
              categoryId: true,
              franchise: { select: { name: true } },
              images: { orderBy: { position: "asc" }, take: 1, select: { url: true, alt: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

export type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

export async function findActiveCart(owner: CartOwner): Promise<CartWithItems | null> {
  if (owner.userId) {
    return db.cart.findFirst({ where: { userId: owner.userId, status: "ACTIVE" }, include: cartInclude, orderBy: { updatedAt: "desc" } });
  }
  if (owner.guestToken) {
    return db.cart.findFirst({ where: { tokenHash: sha256(owner.guestToken), status: "ACTIVE", userId: null }, include: cartInclude });
  }
  return null;
}

/** Returns the shopper's cart, creating one if needed. `newGuestToken` is set when a guest cookie must be issued. */
export async function getOrCreateCart(owner: CartOwner): Promise<{ cart: CartWithItems; newGuestToken?: string }> {
  const existing = await findActiveCart(owner);
  if (existing) return { cart: existing };
  const settings = await getStoreSettings();
  if (owner.userId) {
    const cart = await db.cart.create({ data: { userId: owner.userId, currency: settings.baseCurrency }, include: cartInclude });
    return { cart };
  }
  const token = randomToken();
  const cart = await db.cart.create({ data: { tokenHash: sha256(token), currency: settings.baseCurrency }, include: cartInclude });
  return { cart, newGuestToken: token };
}

async function loadPurchasableVariant(variantId: string) {
  const variant = await db.productVariant.findUnique({
    where: { id: variantId },
    include: { inventory: true, product: { select: { status: true, name: true } } },
  });
  if (!variant || !variant.isActive || variant.product.status !== "ACTIVE") {
    throw new CartError("This item is no longer available.");
  }
  return variant;
}

export async function addItem(cartId: string, variantId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1) throw new CartError("Choose a quantity of at least 1.");
  const settings = await getStoreSettings();
  const variant = await loadPurchasableVariant(variantId);
  const available = availableQuantity(variant.inventory);
  if (available <= 0) throw new CartError(`${variant.product.name} (${variant.title}) is out of stock.`);

  return db.$transaction(async (tx) => {
    const existing = await tx.cartItem.findUnique({ where: { cartId_variantId: { cartId, variantId } } });
    const current = existing && !existing.savedForLater ? existing.quantity : 0;
    const wanted = current + quantity;
    const cap = Math.min(available, settings.maxQtyPerLine);
    if (wanted > cap) {
      throw new CartError(
        cap === current
          ? `You already have the maximum available quantity (${cap}) in your cart.`
          : `Only ${cap} available. You can add ${cap - current} more.`,
      );
    }
    // Upsert on the (cartId, variantId) unique key avoids duplicate lines under double-clicks.
    await tx.cartItem.upsert({
      where: { cartId_variantId: { cartId, variantId } },
      create: { cartId, variantId, quantity },
      update: { quantity: wanted, savedForLater: false },
    });
    await tx.cart.update({ where: { id: cartId }, data: { lastActivityAt: new Date(), status: "ACTIVE" } });
    return wanted;
  });
}

export async function setItemQuantity(cartId: string, itemId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 0) throw new CartError("Invalid quantity.");
  const item = await db.cartItem.findFirst({ where: { id: itemId, cartId }, include: { variant: { include: { inventory: true } } } });
  if (!item) throw new CartError("That item is no longer in your cart.");
  if (quantity === 0) {
    await db.cartItem.delete({ where: { id: item.id } });
    return 0;
  }
  const settings = await getStoreSettings();
  const cap = Math.min(availableQuantity(item.variant.inventory), settings.maxQtyPerLine);
  if (quantity > cap) throw new CartError(cap === 0 ? "This item is out of stock." : `Only ${cap} available.`);
  await db.cartItem.update({ where: { id: item.id }, data: { quantity } });
  await db.cart.update({ where: { id: cartId }, data: { lastActivityAt: new Date() } });
  return quantity;
}

export async function removeItem(cartId: string, itemId: string) {
  await db.cartItem.deleteMany({ where: { id: itemId, cartId } });
}

export async function setSavedForLater(cartId: string, itemId: string, saved: boolean) {
  const res = await db.cartItem.updateMany({ where: { id: itemId, cartId }, data: { savedForLater: saved } });
  if (res.count === 0) throw new CartError("That item is no longer in your cart.");
}

export async function setGiftOptions(cartId: string, giftWrap: boolean, giftMessage: string | null) {
  await db.cart.update({ where: { id: cartId }, data: { giftWrap, giftMessage: giftMessage?.trim().slice(0, 300) || null } });
}

/** Moves a guest cart into the user's active cart on login, summing quantities within stock limits. */
export async function mergeGuestCartIntoUser(guestToken: string, userId: string) {
  const guest = await findActiveCart({ guestToken });
  if (!guest || guest.items.length === 0) return;
  const settings = await getStoreSettings();
  const { cart: target } = await getOrCreateCart({ userId });
  await db.$transaction(async (tx) => {
    for (const item of guest.items) {
      const existing = target.items.find((i) => i.variantId === item.variantId);
      const cap = Math.min(availableQuantity(item.variant.inventory), settings.maxQtyPerLine);
      const quantity = Math.min((existing?.quantity ?? 0) + item.quantity, cap);
      if (quantity <= 0) continue;
      await tx.cartItem.upsert({
        where: { cartId_variantId: { cartId: target.id, variantId: item.variantId } },
        create: { cartId: target.id, variantId: item.variantId, quantity, savedForLater: item.savedForLater },
        update: { quantity },
      });
    }
    await tx.cart.update({ where: { id: guest.id }, data: { status: "MERGED" } });
    await tx.cart.update({
      where: { id: target.id },
      data: { lastActivityAt: new Date(), giftWrap: target.giftWrap || guest.giftWrap, giftMessage: target.giftMessage ?? guest.giftMessage },
    });
  });
}

// ── Pricing view ──

export type CartLineView = {
  id: string;
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  variantTitle: string;
  sku: string;
  franchise: string | null;
  image: { url: string; alt: string } | null;
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  lineTotal: number;
  available: number;
  maxQuantity: number;
  savedForLater: boolean;
  /** Set when stock or availability changed since the item was added. */
  issue: string | null;
};

export type CartView = {
  id: string | null;
  currency: string;
  lines: CartLineView[];
  saved: CartLineView[];
  itemCount: number;
  subtotal: number;
  savings: number;
  shippingEstimate: number;
  freeShippingThreshold: number;
  amountToFreeShipping: number;
  giftWrap: boolean;
  giftWrapPrice: number;
  giftMessage: string | null;
  taxIncluded: number;
  taxLabel: string;
  taxInclusive: boolean;
  estimatedTotal: number;
  hasIssues: boolean;
};

export async function buildCartView(cart: CartWithItems | null): Promise<CartView> {
  const s = await getStoreSettings();
  const currency = cart?.currency ?? s.baseCurrency;
  const all: CartLineView[] = (cart?.items ?? []).map((item) => {
    const v = item.variant;
    const available = availableQuantity(v.inventory);
    const maxQuantity = Math.min(available, s.maxQtyPerLine);
    let issue: string | null = null;
    if (v.product.status !== "ACTIVE" || !v.isActive) issue = "No longer available";
    else if (available <= 0) issue = "Out of stock";
    else if (item.quantity > maxQuantity) issue = `Only ${maxQuantity} available. Reduce the quantity to continue.`;
    return {
      id: item.id,
      variantId: v.id,
      productId: v.product.id,
      slug: v.product.slug,
      name: v.product.name,
      variantTitle: v.title,
      sku: v.sku,
      franchise: v.product.franchise?.name ?? null,
      image: v.product.images[0] ?? null,
      unitPrice: v.price,
      compareAtPrice: v.compareAtPrice,
      quantity: item.quantity,
      lineTotal: v.price * item.quantity,
      available,
      maxQuantity,
      savedForLater: item.savedForLater,
      issue,
    };
  });
  const lines = all.filter((l) => !l.savedForLater);
  const saved = all.filter((l) => l.savedForLater);
  const priced = lines.filter((l) => !l.issue || l.issue.startsWith("Only"));
  const subtotal = priced.reduce((sum, l) => sum + l.lineTotal, 0);
  const savings = priced.reduce((sum, l) => sum + (l.compareAtPrice && l.compareAtPrice > l.unitPrice ? (l.compareAtPrice - l.unitPrice) * l.quantity : 0), 0);
  const shippingEstimate = subtotal === 0 || subtotal >= s.freeShippingThreshold ? 0 : s.standardShipping;
  const giftWrapCost = cart?.giftWrap && lines.length ? s.giftWrapPrice : 0;
  const estimatedTotal = subtotal + shippingEstimate + giftWrapCost + (s.taxInclusive ? 0 : Math.round((subtotal * s.taxRateBps) / 10_000));
  return {
    id: cart?.id ?? null,
    currency,
    lines,
    saved,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal,
    savings,
    shippingEstimate,
    freeShippingThreshold: s.freeShippingThreshold,
    amountToFreeShipping: Math.max(0, s.freeShippingThreshold - subtotal),
    giftWrap: !!cart?.giftWrap,
    giftWrapPrice: s.giftWrapPrice,
    giftMessage: cart?.giftMessage ?? null,
    taxIncluded: s.taxInclusive ? inclusiveTax(subtotal, s.taxRateBps) : 0,
    taxLabel: s.taxLabel,
    taxInclusive: s.taxInclusive,
    estimatedTotal,
    hasIssues: lines.some((l) => !!l.issue),
  };
}
