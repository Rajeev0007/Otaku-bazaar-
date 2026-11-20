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
