import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionRecord, getUserBySessionToken, revokeSessionToken, type SessionUser } from "@/server/auth/service";
import { hasPermission, type Permission } from "@/server/auth/permissions";
import { clientIp, userAgent } from "@/server/request";
import { mergeGuestCartIntoUser } from "@/server/cart/service";
import { GUEST_CART_COOKIE, guestCartTokenFromCookie } from "@/server/cart/cookies";

const secure = process.env.NODE_ENV === "production";
// __Host- prefix forces Secure, Path=/ and no Domain, so subdomains cannot set or read it.
export const SESSION_COOKIE = secure ? "__Host-ob_session" : "ob_session";

/** Current user for this request (deduplicated per render). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getUserBySessionToken(token);
});

export async function startSession(userId: string) {
  const { token, expiresAt } = await createSessionRecord(userId, { ip: await clientIp(), userAgent: await userAgent() });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, secure, sameSite: "lax", path: "/", expires: expiresAt });

  // Guest cart follows the shopper into their account.
  const guestToken = guestCartTokenFromCookie(jar.get(GUEST_CART_COOKIE)?.value);
  if (guestToken) {
    await mergeGuestCartIntoUser(guestToken, userId);
    jar.delete(GUEST_CART_COOKIE);
  }
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await revokeSessionToken(token);
  jar.delete(SESSION_COOKIE);
}

export async function requireUser(next = "/account"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export class ForbiddenError extends Error {
  constructor() {
    super("You don't have permission to do that.");
    this.name = "ForbiddenError";
  }
}

/** For admin pages: redirect anonymous users to login, show 403 to customers or under-privileged staff. */
export async function requireStaff(permission?: Permission, next = "/admin"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!user.isStaff || (permission && !hasPermission(user.permissions, permission))) redirect("/forbidden");
  return user;
}

/** For server actions: throws instead of redirecting so the caller can return an error result. */
export async function assertPermission(permission: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || !user.isStaff || !hasPermission(user.permissions, permission)) throw new ForbiddenError();
  return user;
}

export function can(user: SessionUser | null, permission: Permission) {
  return !!user?.isStaff && hasPermission(user.permissions, permission);
}
