// Gift cards and loyalty points. Balances only change inside transactions, with a ledger entry for each change.
import { Prisma } from "@prisma/client";
import { db, type Tx } from "@/server/db";
import { randomToken, sha256 } from "@/server/security/crypto";
import { getStoreSettings } from "@/server/settings";

export class RewardError extends Error {}

// ── Gift cards ──

const GC_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeGiftCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function newGiftCode() {
  const bytes = randomToken(24);
  let s = "";
  for (let i = 0; i < 12; i++) s += GC_ALPHABET[bytes.charCodeAt(i) % GC_ALPHABET.length];
  return `OBGC-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

export async function findGiftCard(rawCode: string) {
  const code = normalizeGiftCode(rawCode);
  if (code.length < 12) return null;
  return db.giftCard.findUnique({ where: { codeHash: sha256(code) } });
}

/** Usable balance or an explanation of why it can't be used. */
export async function checkGiftCard(rawCode: string, currency = "INR"): Promise<{ ok: true; id: string; balance: number; last4: string } | { ok: false; error: string }> {
  const gc = await findGiftCard(rawCode);
  if (!gc) return { ok: false, error: "That gift card code isn't valid." };
  if (!gc.isActive) return { ok: false, error: "This gift card has been disabled." };
  if (gc.expiresAt && gc.expiresAt < new Date()) return { ok: false, error: `This gift card expired on ${gc.expiresAt.toLocaleDateString("en-IN")}.` };
  if (gc.currency !== currency) return { ok: false, error: "This gift card can't be used for this currency." };
  if (gc.balance <= 0) return { ok: false, error: "This gift card has no balance left." };
  return { ok: true, id: gc.id, balance: gc.balance, last4: gc.last4 };
}

/** Creates a gift card and returns the code ONCE (only a hash is stored). */
export async function issueGiftCard(input: { amount: number; currency?: string; recipientEmail?: string | null; senderName?: string | null; message?: string | null; expiresAt?: Date | null; actorId?: string | null }) {
  if (!Number.isInteger(input.amount) || input.amount < 100 || input.amount > 10_000_000) throw new RewardError("Enter a value between ₹1 and ₹1,00,000.");
  const code = newGiftCode();
  const gc = await db.giftCard.create({
    data: {
      codeHash: sha256(normalizeGiftCode(code)),
      last4: code.slice(-4),
      initialValue: input.amount,
      balance: input.amount,
      currency: input.currency ?? "INR",
      recipientEmail: input.recipientEmail?.toLowerCase() || null,
      senderName: input.senderName || null,
      message: input.message || null,
      expiresAt: input.expiresAt ?? null,
      transactions: { create: { delta: input.amount, balanceAfter: input.amount, note: "Issued" } },
    },
  });
  if (gc.recipientEmail) await emailGiftCard(gc.id, code);
  return { giftCard: gc, code };
}

/** Takes up to `amount` from a card, atomically. Returns the amount actually taken. */
export async function redeemGiftCard(tx: Tx, giftCardId: string, amount: number, orderId: string) {
  if (amount <= 0) return 0;
  const rows = await tx.$queryRaw<{ balance: number }[]>(Prisma.sql`
    UPDATE "GiftCard" SET "balance" = "balance" - ${amount}, "updatedAt" = now()
    WHERE "id" = ${giftCardId} AND "isActive" AND "balance" >= ${amount} AND ("expiresAt" IS NULL OR "expiresAt" > now())
    RETURNING "balance"`);
  if (!rows[0]) throw new RewardError("The gift card balance changed. Please re-apply it.");
  await tx.giftCardTransaction.create({ data: { giftCardId, orderId, delta: -amount, balanceAfter: rows[0].balance, note: "Used on order" } });
  return amount;
}

/** Puts back whatever an order took from gift cards (cancellation). */
export async function restoreGiftCardsForOrder(tx: Tx, orderId: string) {
  const used = await tx.giftCardTransaction.groupBy({ by: ["giftCardId"], where: { orderId }, _sum: { delta: true } });
  for (const u of used) {
    const net = -(u._sum.delta ?? 0);
    if (net <= 0) continue;
    const gc = await tx.giftCard.update({ where: { id: u.giftCardId }, data: { balance: { increment: net } } });
    await tx.giftCardTransaction.create({ data: { giftCardId: gc.id, orderId, delta: net, balanceAfter: gc.balance, note: "Order cancelled: balance restored" } });
  }
}

async function emailGiftCard(giftCardId: string, code: string) {
  try {
    const { sendEmail, emailLayout, esc, button } = await import("@/server/email");
    const { appUrl } = await import("@/lib/utils");
    const { formatMoney } = await import("@/lib/money");
    const gc = await db.giftCard.findUniqueOrThrow({ where: { id: giftCardId } });
    if (!gc.recipientEmail) return;
    await sendEmail({
      to: gc.recipientEmail,
      template: "giftcard.delivery",
      subject: `${gc.senderName ? `${gc.senderName} sent you` : "You've received"} a ${formatMoney(gc.initialValue, gc.currency)} Otaku Bazaar gift card`,
      text: `Gift card code: ${code}. Value ${formatMoney(gc.initialValue, gc.currency)}.${gc.message ? ` Message: ${gc.message}` : ""} Use it at checkout: ${appUrl("/shop")}`,
      html: emailLayout(
        "A gift for you 🎁",
        `${gc.message ? `<p>“${esc(gc.message)}”${gc.senderName ? ` — ${esc(gc.senderName)}` : ""}</p>` : ""}<p style="font-size:22px;font-weight:700;letter-spacing:2px;padding:12px;background:#222;border-radius:12px;text-align:center">${esc(code)}</p><p>Value: <b>${formatMoney(gc.initialValue, gc.currency)}</b>${gc.expiresAt ? ` · valid until ${gc.expiresAt.toLocaleDateString("en-IN")}` : ""}. Enter the code at checkout.</p>${button(appUrl("/shop"), "Start shopping")}`,
      ),
    });
  } catch (err) {
    console.error("[giftcard] email failed", err);
  }
}

// ── Loyalty points ──

export async function pointsBalance(userId: string, tx: Tx | typeof db = db) {
  const agg = await tx.loyaltyTransaction.aggregate({ where: { userId }, _sum: { points: true } });
  return agg._sum.points ?? 0;
}

export async function addPoints(tx: Tx, userId: string, points: number, reason: string, refId?: string) {
  if (!points) return;
  // Serialise per user so concurrent redemptions can't overspend.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`loyalty:${userId}`}))`;
  const balance = await pointsBalance(userId, tx);
  if (balance + points < 0) throw new RewardError("Not enough reward points.");
  await tx.loyaltyTransaction.create({ data: { userId, points, balanceAfter: balance + points, reason, refId } });
}

/** How many points can be used on an order of `payable` paise. */
export async function redeemablePoints(userId: string, payable: number) {
  const s = (await getStoreSettings()).loyalty;
  if (!s.enabled) return { balance: 0, points: 0, value: 0, reason: "Rewards are off" };
  const balance = await pointsBalance(userId);
  if (balance < s.minRedeem) return { balance, points: 0, value: 0, reason: `Use points once you have ${s.minRedeem}` };
  const maxValue = Math.floor((payable * s.maxRedeemPercent) / 100);
  const points = Math.min(balance, Math.floor(maxValue / s.pointValue));
  return { balance, points, value: points * s.pointValue, reason: points ? null : "Order too small to use points" };
}

/** Points earned on a delivered order (once per order). */
export async function awardOrderPoints(tx: Tx, orderId: string) {
  const s = (await getStoreSettings()).loyalty;
  const o = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { userId: true, grandTotal: true, giftCardTotal: true } });
  if (!s.enabled || !o.userId || !s.pointsPer100) return 0;
  const done = await tx.loyaltyTransaction.findFirst({ where: { userId: o.userId, reason: "PURCHASE", refId: orderId } });
  if (done) return 0;
  const points = Math.floor(((o.grandTotal + o.giftCardTotal) / 10_000) * s.pointsPer100);
  if (points > 0) await addPoints(tx, o.userId, points, "PURCHASE", orderId);
  return points;
}

export async function refundOrderPoints(tx: Tx, orderId: string) {
  const o = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { userId: true } });
  if (!o.userId) return;
  const redeemed = await tx.loyaltyTransaction.aggregate({ where: { userId: o.userId, refId: orderId, reason: { in: ["REDEEM", "REDEEM_REFUND"] } }, _sum: { points: true } });
  const net = -(redeemed._sum.points ?? 0);
  if (net > 0) await addPoints(tx, o.userId, net, "REDEEM_REFUND", orderId);
}
