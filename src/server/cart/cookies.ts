import { sign, unsign } from "@/server/security/crypto";

export const GUEST_CART_COOKIE = process.env.NODE_ENV === "production" ? "__Host-ob_cart" : "ob_cart";
export const GUEST_CART_MAX_AGE = 60 * 60 * 24 * 60; // 60 days

export function guestCartCookieValue(token: string) {
  return sign(token);
}

export function guestCartTokenFromCookie(value: string | undefined) {
  return unsign(value);
}
