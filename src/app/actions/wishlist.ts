"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { setWishlistSharing, toggleWishlist } from "@/server/wishlist/service";
import { addItem, CartError } from "@/server/cart/service";
import { cartItemCount, ensureCart } from "@/server/shopper";
import { db } from "@/server/db";
import { appUrl } from "@/lib/utils";

export async function toggleWishlistAction(productId: string): Promise<{ ok: true; saved: boolean } | { ok: false; error: string; needsLogin?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, needsLogin: true, error: "Sign in to save items to your wishlist." };
  try {
    const saved = await toggleWishlist(user.id, z.string().min(1).max(40).parse(productId));
    revalidatePath("/wishlist");
    return { ok: true, saved };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not update wishlist." };
  }
}

/** Moves a wishlist product to the cart using its first in-stock variant (or the chosen one). */
export async function moveWishlistToCartAction(productId: string, variantId?: string): Promise<{ ok: true; count: number } | { ok: false; error: string; chooseVariant?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };
  const product = await db.product.findUnique({
    where: { id: z.string().max(40).parse(productId) },
    include: { variants: { where: { isActive: true }, include: { inventory: true }, orderBy: { position: "asc" } } },
  });
  if (!product) return { ok: false, error: "Product not found." };
  if (!variantId && product.variants.length > 1) return { ok: false, chooseVariant: true, error: "Choose a size or option first." };
  const variant = variantId ? product.variants.find((v) => v.id === variantId) : product.variants[0];
  if (!variant) return { ok: false, error: "Option not available." };
  try {
    const cart = await ensureCart();
    await addItem(cart.id, variant.id, 1);
    await toggleWishlist(user.id, product.id);
    revalidatePath("/wishlist");
    return { ok: true, count: await cartItemCount(cart.id) };
  } catch (err) {
    return { ok: false, error: err instanceof CartError ? err.message : "Could not move to cart." };
  }
}

export async function shareWishlistAction(isPublic: boolean): Promise<{ ok: true; url: string | null } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };
  const list = await setWishlistSharing(user.id, isPublic);
  revalidatePath("/wishlist");
  return { ok: true, url: list.isPublic && list.shareSlug ? appUrl(`/wishlist/shared/${list.shareSlug}`) : null };
}
