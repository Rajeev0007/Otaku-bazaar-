"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { addMessage, createTicket } from "@/server/support/service";
import { enforceRateLimit, RateLimitError } from "@/server/security/rate-limit";
import { clientIp } from "@/server/request";
import { db } from "@/server/db";
import { fieldErrors } from "@/lib/validation";

export type SupportState = { ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string>; number?: string } | null;

export async function createTicketAction(_: SupportState, form: FormData): Promise<SupportState> {
  // Honeypot field: real users never fill it.
  if (form.get("website")) return { ok: true, message: "Thanks! We'll be in touch." };
  try {
    await enforceRateLimit(`ticket:${await clientIp()}`, 5, 60 * 60);
    const user = await getCurrentUser();
    const t = await createTicket(Object.fromEntries(form), user?.id ?? null);
    return { ok: true, number: t.number, message: `Thanks! Your ticket ${t.number} is open. We will reply by email.` };
  } catch (err) {
    if (err instanceof z.ZodError) return { error: "Please check the highlighted fields.", fieldErrors: fieldErrors(err) };
    if (err instanceof RateLimitError) return { error: err.message };
    throw err;
  }
}

export async function customerReplyAction(number: string, _: SupportState, form: FormData): Promise<SupportState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in." };
  const t = await db.supportTicket.findUnique({ where: { number: z.string().max(20).parse(number) } });
  if (!t || t.userId !== user.id) return { error: "Ticket not found." };
  try {
    await enforceRateLimit(`ticket-reply:${user.id}`, 30, 60 * 60);
    await addMessage(t.id, String(form.get("body") ?? ""), { userId: user.id, isStaff: false });
  } catch (err) {
    return { error: err instanceof z.ZodError ? (err.issues[0]?.message ?? "Invalid message") : err instanceof Error ? err.message : "Could not send." };
  }
  revalidatePath(`/account/support/${number}`);
  return { ok: true, message: "Sent." };
}
