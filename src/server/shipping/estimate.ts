import { db } from "@/server/db";

export type DeliveryOption = { code: string; name: string; cost: number; currency: string; minDate: string; maxDate: string; free: boolean };
export type DeliveryEstimate = { ok: true; options: DeliveryOption[]; cod: boolean } | { ok: false; error: string };

const POSTAL_FORMATS: Record<string, RegExp> = { IN: /^[1-9][0-9]{5}$/ };

/** Adds business days (Mon–Sat) to a date. Sundays are skipped, matching most Indian carriers. */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) added++;
  }
  return d;
}

/**
 * Delivery options for a destination, from the configured shipping zones and rates.
 * Zone resolution: blocked postal prefixes first, then the most specific matching zone in an active market.
 */
export async function estimateDelivery(input: { country: string; postalCode: string; subtotal: number; now?: Date }): Promise<DeliveryEstimate> {
  const country = input.country.toUpperCase();
  const postal = input.postalCode.replace(/\s+/g, "");
  const fmt = POSTAL_FORMATS[country];
  if (fmt && !fmt.test(postal)) return { ok: false, error: "Enter a valid 6-digit PIN code." };

  const zones = await db.shippingZone.findMany({
    where: { countries: { has: country }, market: { isActive: true } },
    include: { rates: { where: { isActive: true }, orderBy: { baseRate: "asc" } }, market: { select: { currency: true } } },
  });
  const matches = zones.filter((z) => !z.postalPrefixes.length || z.postalPrefixes.some((p) => postal.startsWith(p)));
  if (matches.some((z) => z.isBlocked)) return { ok: false, error: "Sorry, we don't deliver to this PIN code yet." };
  const zone = matches.sort((a, b) => b.postalPrefixes.length - a.postalPrefixes.length)[0];
  if (!zone || !zone.rates.length) return { ok: false, error: "Delivery isn't available to this location yet." };

  const now = input.now ?? new Date();
  const options = zone.rates.map((r) => {
    const free = r.freeOver !== null && input.subtotal >= r.freeOver;
    return {
      code: r.code,
      name: r.name,
      cost: free ? 0 : r.baseRate,
      currency: zone.market.currency,
      minDate: addBusinessDays(now, r.minDays).toISOString(),
      maxDate: addBusinessDays(now, r.maxDays).toISOString(),
      free,
    };
  });
  return { ok: true, options, cod: country === "IN" };
}
