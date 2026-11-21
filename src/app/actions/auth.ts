"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  AuthError,
  authenticate,
  changePassword,
  registerUser,
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail,
} from "@/server/auth/service";
import { endSession, getCurrentUser, startSession } from "@/server/auth/session";
import { RateLimitError, enforceRateLimit } from "@/server/security/rate-limit";
import { clientIp } from "@/server/request";
import { db } from "@/server/db";
import { fieldErrors, loginSchema, profileSchema, registerSchema } from "@/lib/validation";
import { safeRedirectPath } from "@/lib/utils";

export type FormState = { ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> } | null;

/** Echo back non-secret fields so React's post-action form reset doesn't wipe what the shopper typed. */
function echo(form: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, String(form.get(k) ?? "").slice(0, 300)]));
}

function failure(err: unknown): FormState {
  if (err instanceof z.ZodError) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(err) };
  if (err instanceof AuthError || err instanceof RateLimitError) return { error: err.message };
  console.error("[auth]", err);
  return { error: "Something went wrong. Please try again." };
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const next = safeRedirectPath(String(form.get("next") ?? ""), "/account");
  try {
    const input = loginSchema.parse({ email: form.get("email"), password: form.get("password") });
    const user = await authenticate(input.email, input.password, await clientIp());
    await startSession(user.id);
  } catch (err) {
    return { ...failure(err), values: echo(form, ["email"]) };
  }
  redirect(next);
}

export async function registerAction(_: FormState, form: FormData): Promise<FormState> {
  const next = safeRedirectPath(String(form.get("next") ?? ""), "/account");
  try {
    await enforceRateLimit(`register:${await clientIp()}`, 10, 60 * 60);
    const input = registerSchema.parse({
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
      marketingOptIn: form.get("marketingOptIn") === "on",
    });
    if (form.get("terms") !== "on") return { error: "Please accept the terms to create an account.", fieldErrors: { terms: "Required" }, values: echo(form, ["name", "email"]) };
    const user = await registerUser(input);
    await startSession(user.id);
  } catch (err) {
    return { ...failure(err), values: echo(form, ["name", "email"]) };
  }
  redirect(`${next}${next.includes("?") ? "&" : "?"}welcome=1`);
}

export async function logoutAction() {
  await endSession();
  redirect("/");
}

export async function forgotPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await requestPasswordReset(String(form.get("email") ?? ""), await clientIp());
  } catch (err) {
    if (err instanceof RateLimitError) return { error: err.message };
    if (err instanceof z.ZodError) return { error: "Enter a valid email address.", fieldErrors: { email: "Enter a valid email address" } };
    console.error("[auth] reset request", err);
  }
  return { ok: true, message: "If an account exists for that email, we've sent a link to reset your password. It expires in 1 hour." };
}

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const password = String(form.get("password") ?? "");
  if (password !== String(form.get("confirm") ?? "")) return { error: "Passwords don't match.", fieldErrors: { confirm: "Passwords don't match" } };
  try {
    await enforceRateLimit(`reset-submit:${await clientIp()}`, 20, 60 * 60);
    const userId = await resetPassword(String(form.get("token") ?? ""), password);
    await startSession(userId);
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0]?.message ?? "Invalid password.", fieldErrors: { password: err.issues[0]?.message ?? "Invalid" } };
    return failure(err);
  }
  redirect("/account?reset=1");
}

export async function resendVerificationAction(): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in." };
  if (user.emailVerifiedAt) return { ok: true, message: "Your email is already verified." };
  try {
    await enforceRateLimit(`verify-resend:${user.id}`, 3, 60 * 60);
    await sendVerificationEmail(user);
    return { ok: true, message: `We've sent a new confirmation link to ${user.email}.` };
  } catch (err) {
    return failure(err);
  }
}

export async function updateProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in." };
  try {
    const input = profileSchema.parse({ name: form.get("name"), phone: form.get("phone") ?? "", marketingOptIn: form.get("marketingOptIn") === "on" });
    await db.user.update({ where: { id: user.id }, data: { name: input.name, phone: input.phone || null, marketingOptIn: input.marketingOptIn } });
    revalidatePath("/account");
    return { ok: true, message: "Profile updated." };
  } catch (err) {
    return failure(err);
  }
}

export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in." };
  const next = String(form.get("password") ?? "");
  if (next !== String(form.get("confirm") ?? "")) return { error: "New passwords don't match.", fieldErrors: { confirm: "Passwords don't match" } };
  try {
    await enforceRateLimit(`change-pw:${user.id}`, 10, 60 * 60);
    await changePassword(user.id, user.sessionId, String(form.get("current") ?? ""), next);
    return { ok: true, message: "Password changed. Other devices have been signed out." };
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0]?.message ?? "Invalid password.", fieldErrors: { password: err.issues[0]?.message ?? "Invalid" } };
    return failure(err);
  }
}

export async function signOutOtherDevicesAction(): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in." };
  const { count } = await db.session.deleteMany({ where: { userId: user.id, NOT: { id: user.sessionId } } });
  return { ok: true, message: count ? `Signed out of ${count} other session${count === 1 ? "" : "s"}.` : "No other active sessions." };
}

export async function deleteAccountAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in." };
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") return { error: "Type DELETE to confirm." };
  const full = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (full.passwordHash) {
    const { verifyPassword } = await import("@/server/security/crypto");
    if (!(await verifyPassword(String(form.get("password") ?? ""), full.passwordHash))) return { error: "Your password is incorrect." };
  }
  try {
    const { deleteAccount } = await import("@/server/account/privacy");
    await deleteAccount(user.id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not delete the account." };
  }
  await endSession();
  redirect("/?deleted=1");
}

export async function giftCardBalanceAction(_: unknown, form: FormData): Promise<{ error?: string; message?: string } | null> {
  const { checkGiftCard, findGiftCard } = await import("@/server/rewards/service");
  const { formatMoney } = await import("@/lib/money");
  try {
    await enforceRateLimit(`gc-check:${await clientIp()}`, 10, 15 * 60);
  } catch (err) {
    if (err instanceof RateLimitError) return { error: err.message };
    throw err;
  }
  const code = String(form.get("code") ?? "");
  const r = await checkGiftCard(code);
  if (r.ok) return { message: `Card ••${r.last4} has ${formatMoney(r.balance, "INR")} available.` };
  const gc = await findGiftCard(code);
  return { error: gc ? r.error : "That gift card code isn't valid." };
}

export async function writeReviewAction(orderItemId: string, number: string, raw: unknown): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const { canViewOrder } = await import("@/server/orders/access");
  const input = z.object({ rating: z.coerce.number().int().min(1).max(5), title: z.string().trim().max(120).optional(), body: z.string().trim().min(10, "Write at least a sentence (10+ characters)").max(3000) }).safeParse(raw);
  if (!input.success) return { ok: false, error: input.error.issues[0]?.message ?? "Please check the review." };
  try {
    await enforceRateLimit(`review:${await clientIp()}`, 20, 60 * 60);
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }
  const user = await getCurrentUser();
  const order = await canViewOrder(number, user);
  if (!order) return { ok: false, error: "Order not found." };
  if (!["DELIVERED", "RETURNED"].includes(order.status)) return { ok: false, error: "You can review items after they're delivered." };
  const item = order.items.find((i) => i.id === orderItemId);
  if (!item?.variantId) return { ok: false, error: "This item can't be reviewed." };
  const variant = await db.productVariant.findUnique({ where: { id: item.variantId }, select: { productId: true } });
  if (!variant) return { ok: false, error: "This product is no longer available." };
  const exists = await db.review.findUnique({ where: { orderItemId } });
  if (exists) return { ok: false, error: "You've already reviewed this item." };
  const name = (order.shippingAddress as { fullName?: string }).fullName ?? user?.name ?? "Customer";
  const created = await db.review.create({
    data: {
      productId: variant.productId,
      userId: order.userId ?? user?.id ?? null,
      orderItemId,
      authorName: `${name.split(" ")[0]}${name.split(" ")[1] ? ` ${name.split(" ")[1]![0]}.` : ""}`,
      rating: input.data.rating,
      title: input.data.title || null,
      body: input.data.body,
      isVerified: true,
      status: "PENDING",
    },
  }).catch((err: unknown) => {
    // Double submit: the unique orderItemId index rejects the second review.
    if ((err as { code?: string }).code === "P2002") return null;
    throw err;
  });
  if (!created) return { ok: false, error: "You've already reviewed this item." };
  return { ok: true, message: "Thanks! Your review will appear after a quick check." };
}
