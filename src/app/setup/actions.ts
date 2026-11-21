"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { claimOwner, issueSetupCode, SetupError } from "@/server/setup";
import { startSession } from "@/server/auth/session";
import { enforceRateLimit, RateLimitError } from "@/server/security/rate-limit";
import { clientIp } from "@/server/request";
import { fieldErrors } from "@/lib/validation";

export type SetupFormState = { error?: string; fieldErrors?: Record<string, string>; message?: string; values?: Record<string, string> } | null;

export async function claimOwnerAction(_: SetupFormState, form: FormData): Promise<SetupFormState> {
  const values = { name: String(form.get("name") ?? ""), email: String(form.get("email") ?? "") };
  try {
    await enforceRateLimit(`setup:${await clientIp()}`, 10, 15 * 60);
    const user = await claimOwner({ code: form.get("code"), name: form.get("name"), email: form.get("email"), password: form.get("password") });
    await startSession(user.id);
  } catch (err) {
    if (err instanceof z.ZodError) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(err), values };
    if (err instanceof SetupError || err instanceof RateLimitError) return { error: err.message, values };
    console.error("[setup]", err);
    return { error: "Something went wrong. Please try again.", values };
  }
  redirect("/admin?welcome=owner");
}

export async function newSetupCodeAction(): Promise<SetupFormState> {
  try {
    await enforceRateLimit(`setup-code:${await clientIp()}`, 5, 60 * 60);
  } catch (err) {
    if (err instanceof RateLimitError) return { error: err.message };
    throw err;
  }
  const issued = await issueSetupCode("runtime");
  return issued
    ? { message: "A new code was printed in Vercel → your project → Logs (search for “OWNER SETUP CODE”). Older codes no longer work." }
    : { error: "This store already has an owner." };
}
