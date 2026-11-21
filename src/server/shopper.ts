import { cookies } from "next/headers";
import { getCurrentUser } from "@/server/auth/session";
import { GUEST_CART_COOKIE, GUEST_CART_MAX_AGE, guestCartCookieValue, guestCartTokenFromCookie } from "@/server/cart/cookies";
import { findActiveCart, getOrCreateCart, type CartOwner } from "@/server/cart/service";
import { wishlistProductIds } from "@/server/wishlist/service";
import { db } from "@/server/db";

export async function getCartOwner(): Promise<CartOwner> {
  const user = await getCurrentUser();
  if (user) return { userId: user.id };
  const token = await guestCartTokenFromCookie((await cookies()).get(GUEST_CART_COOKIE)?.value);
  return { guestToken: token };
}

/** Gets or creates the cart and sets the guest cookie if a new guest cart was created. Server actions only. */
export async function ensureCart() {
  const owner = await getCartOwner();
  const { cart, newGuestToken } = await getOrCreateCart(owner);
  if (newGuestToken) {
    (await cookies()).set(GUEST_CART_COOKIE, await guestCartCookieValue(newGuestToken), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: GUEST_CART_MAX_AGE,
    });
  }
  return cart;
}

export async function getCurrentCart() {
  return findActiveCart(await getCartOwner());
}

export async function cartItemCount(cartId: string | null | undefined) {
  if (!cartId) return 0;
  const agg = await db.cartItem.aggregate({ where: { cartId, savedForLater: false }, _sum: { quantity: true } });
  return agg._sum.quantity ?? 0;
}

export async function getShopperSummary() {
  const user = await getCurrentUser();
  const cart = await findActiveCart(user ? { userId: user.id } : await getCartOwner());
  return {
    user: user ? { name: user.name, email: user.email, isStaff: user.isStaff } : null,
    cartCount: await cartItemCount(cart?.id),
    wishlistIds: user ? await wishlistProductIds(user.id) : [],
  };
}
