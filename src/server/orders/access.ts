import { cookies } from "next/headers";
import { unsign } from "@/server/security/crypto";
import { getAuthSecret } from "@/server/secrets";
import { findOrderForViewer } from "@/server/orders/service";
import type { SessionUser } from "@/server/auth/service";

export function orderAccessCookie(number: string) {
  return {
    name: `ob_order_${number}`,
    options: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 30 },
  };
}

/** Order visible to: its signed-in owner, staff, a valid ?t= token, or this browser after checkout/lookup. */
export async function canViewOrder(number: string, user: SessionUser | null, token?: string | null) {
  const signed = (await cookies()).get(orderAccessCookie(number).name)?.value;
  const viaCookie = signed ? unsign(signed, await getAuthSecret()) === number : false;
  const order = await findOrderForViewer(number, { userId: user?.id ?? null, isStaff: !!user?.isStaff || viaCookie, token, verifiedEmail: user?.emailVerifiedAt ? user.email : null });
  return order;
}
