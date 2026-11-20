"use server";

import { z } from "zod";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth/session";
import { emailSchema } from "@/lib/validation";
import { enforceRateLimit, RateLimitError } from "@/server/security/rate-limit";
import { clientIp } from "@/server/request";
import { estimateDelivery } from "@/server/shipping/estimate";

export async function stockAlertAction(variantId: string, email: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  try {
    await enforceRateLimit(`stock-alert:${await clientIp()}`, 20, 60 * 60);
    const user = await getCurrentUser();
    const parsedEmail = emailSchema.parse(user?.email ?? email);
    const variant = await db.productVariant.findUnique({ where: { id: z.string().max(40).parse(variantId) }, select: { id: true } });
    if (!variant) return { ok: false, error: "Option not found." };
    await db.stockAlert.upsert({
      where: { variantId_email_kind: { variantId: variant.id, email: parsedEmail, kind: "RESTOCK" } },
      create: { variantId: variant.id, email: parsedEmail, userId: user?.id, kind: "RESTOCK" },
      update: { notifiedAt: null },
    });
    return { ok: true, message: `We'll email ${parsedEmail} when it's back in stock.` };
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    if (err instanceof z.ZodError) return { ok: false, error: "Enter a valid email address." };
    throw err;
  }
}

export async function askQuestionAction(productId: string, question: string): Promise<{ ok: true; message: string } | { ok: false; error: string; needsLogin?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, needsLogin: true, error: "Please sign in to ask a question." };
  const q = z.string().trim().min(10, "Please write at least 10 characters.").max(500).safeParse(question);
  if (!q.success) return { ok: false, error: q.error.issues[0]?.message ?? "Invalid question." };
  try {
    await enforceRateLimit(`question:${user.id}`, 5, 60 * 60);
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message };
    throw err;
  }
  const product = await db.product.findUnique({ where: { id: z.string().max(40).parse(productId) }, select: { id: true } });
  if (!product) return { ok: false, error: "Product not found." };
  await db.productQuestion.create({ data: { productId: product.id, userId: user.id, question: q.data } });
  return { ok: true, message: "Thanks! Your question will appear here once our team answers it." };
}

export async function checkDeliveryAction(pincode: string, subtotal: number) {
  try {
    await enforceRateLimit(`pincode:${await clientIp()}`, 60, 60);
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false as const, error: err.message };
    throw err;
  }
  return estimateDelivery({ country: "IN", postalCode: pincode, subtotal: z.number().int().nonnegative().max(100_000_000).catch(0).parse(subtotal) });
}
