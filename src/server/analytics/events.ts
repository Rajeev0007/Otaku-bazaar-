import { z } from "zod";
import { db } from "@/server/db";

/** First-party storefront events. Anything else is rejected so the table can't be filled with junk. */
export const EVENT_NAMES = ["page_view", "product_view", "add_to_cart", "begin_checkout", "search", "wishlist_add"] as const;
export type EventName = (typeof EVENT_NAMES)[number];

const str = (max: number) => z.string().trim().max(max).optional().nullable();

export const eventSchema = z.object({
  name: z.enum(EVENT_NAMES),
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional().nullable(),
  path: str(300),
  productId: z.string().regex(/^[a-z0-9]{10,40}$/).optional().nullable(),
  variantId: z.string().regex(/^[a-z0-9]{10,40}$/).optional().nullable(),
  quantity: z.number().int().min(1).max(99).optional(),
  query: str(120),
  referrer: str(300),
  utmSource: str(80),
  utmMedium: str(80),
  utmCampaign: str(120),
});
export type EventInput = z.infer<typeof eventSchema>;

/** Keeps only the host of an external referrer; same-site and empty referrers are dropped. */
export function referrerHost(referrer: string | null | undefined, ownHost: string | null): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (!host || (ownHost && host === ownHost.replace(/^www\./, ""))) return null;
    return host.slice(0, 120);
  } catch {
    return null;
  }
}

/** Strips query strings and fragments so personal data in URLs (emails, tokens) is never stored. */
export function cleanPath(path: string | null | undefined): string | null {
  if (!path || !path.startsWith("/")) return null;
  return path.split(/[?#]/)[0]!.slice(0, 200);
}

export async function recordEvent(input: EventInput, ctx: { userId?: string | null; ownHost: string | null }) {
  let productId = input.productId ?? null;
  if (!productId && input.variantId) {
    const v = await db.productVariant.findUnique({ where: { id: input.variantId }, select: { productId: true } });
    productId = v?.productId ?? null;
  }
  if (productId) {
    const exists = await db.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!exists) productId = null;
  }
  const props: Record<string, string | number> = {};
  if (input.variantId) props.variantId = input.variantId;
  if (input.quantity) props.quantity = input.quantity;
  if (input.query) props.query = input.query.toLowerCase();
  if (input.utmMedium) props.utmMedium = input.utmMedium;
  if (input.utmCampaign) props.utmCampaign = input.utmCampaign;

  await db.analyticsEvent.create({
    data: {
      name: input.name,
      sessionId: input.sessionId ?? null,
      userId: ctx.userId ?? null,
      path: cleanPath(input.path),
      productId,
      value: input.quantity ?? null,
      props: Object.keys(props).length ? props : undefined,
      referrer: referrerHost(input.referrer, ctx.ownHost),
      utmSource: input.utmSource?.toLowerCase() || null,
    },
  });
}
