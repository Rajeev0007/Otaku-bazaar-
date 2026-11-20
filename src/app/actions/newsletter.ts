"use server";

import { db } from "@/server/db";
import { emailSchema } from "@/lib/validation";
import { enforceRateLimit, RateLimitError } from "@/server/security/rate-limit";
import { clientIp } from "@/server/request";
import type { FormState } from "@/app/actions/auth";

export async function subscribeNewsletterAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = emailSchema.safeParse(form.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };
  if (form.get("consent") !== "on") return { error: "Please confirm you'd like to receive emails from us." };
  try {
    await enforceRateLimit(`newsletter:${await clientIp()}`, 5, 60 * 60);
  } catch (err) {
    if (err instanceof RateLimitError) return { error: err.message };
    throw err;
  }
  await db.newsletterSubscriber.upsert({
    where: { email: parsed.data },
    create: { email: parsed.data, source: String(form.get("source") ?? "site").slice(0, 40), confirmedAt: new Date() },
    update: { unsubscribedAt: null },
  });
  return { ok: true, message: "You're on the list. Watch your inbox for early access to drops." };
}
