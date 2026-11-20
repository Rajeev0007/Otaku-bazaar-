import { cache } from "react";
import { z } from "zod";
import { db } from "@/server/db";

// Store-wide settings live in the Setting table under the "store" key and are editable in admin.
// Defaults keep the store usable before anything is configured.

export const storeSettingsSchema = z.object({
  name: z.string().default("The Otaku Bazaar"),
  tagline: z.string().default("Premium anime merchandise for fans and collectors"),
  logoUrl: z.string().default("/img/logo.png"),
  baseCurrency: z.string().length(3).default("INR"),
  locale: z.string().default("en-IN"),
  defaultMarket: z.string().default("IN"),
  freeShippingThreshold: z.number().int().nonnegative().default(99_900),
  standardShipping: z.number().int().nonnegative().default(4_900),
  taxInclusive: z.boolean().default(true),
  taxRateBps: z.number().int().nonnegative().default(1_800),
  taxLabel: z.string().default("GST"),
  maxQtyPerLine: z.number().int().positive().default(10),
  giftWrapPrice: z.number().int().nonnegative().default(4_900),
  announcements: z
    .array(z.object({ text: z.string(), href: z.string().optional() }))
    .default([
      { text: "Free shipping on orders over ₹999", href: "/shop" },
      { text: "New drop: Jujutsu Kaisen limited hoodies", href: "/anime/jujutsu-kaisen" },
      { text: "Easy 7-day returns on eligible items", href: "/pages/returns-policy" },
    ]),
  support: z
    .object({
      email: z.string().default("[support email]"),
      phone: z.string().default("[support phone]"),
      hours: z.string().default("Mon–Sat, 10:00–19:00 IST"),
    })
    .default({}),
  social: z
    .object({
      instagram: z.string().default(""),
      youtube: z.string().default(""),
      x: z.string().default(""),
      discord: z.string().default(""),
    })
    .default({}),
  maintenanceMode: z.boolean().default(false),
  maintenanceMessage: z.string().default("We're upgrading the store. Back shortly."),
});

export type StoreSettings = z.infer<typeof storeSettingsSchema>;

export const getStoreSettings = cache(async (): Promise<StoreSettings> => {
  const row = await db.setting.findUnique({ where: { key: "store" } }).catch(() => null);
  const parsed = storeSettingsSchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : storeSettingsSchema.parse({});
});

export async function updateStoreSettings(patch: Partial<StoreSettings>) {
  const current = await getStoreSettings();
  const value = storeSettingsSchema.parse({ ...current, ...patch });
  await db.setting.upsert({ where: { key: "store" }, create: { key: "store", value }, update: { value } });
  return value;
}
