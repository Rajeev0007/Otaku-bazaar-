import { cache } from "react";
import { z } from "zod";
import { db } from "@/server/db";
import { THEME_IDS } from "@/lib/themes";

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
  loyalty: z
    .object({
      enabled: z.boolean().default(true),
      pointsPer100: z.number().int().min(0).max(100).default(2), // points earned per ₹100 paid
      pointValue: z.number().int().min(1).max(10_000).default(100), // paise per point (100 = ₹1)
      minRedeem: z.number().int().min(0).default(50),
      maxRedeemPercent: z.number().int().min(0).max(100).default(20),
      signupBonus: z.number().int().min(0).default(0),
    })
    .default({}),
  analytics: z
    .object({
      ga4Id: z.string().default(""),
      metaPixelId: z.string().default(""),
    })
    .default({}),
  cod: z
    .object({
      enabled: z.boolean().default(true),
      maxOrder: z.number().int().nonnegative().default(500_000), // ₹5,000
      fee: z.number().int().nonnegative().default(0),
    })
    .default({}),
  announcements: z
    .array(z.object({ text: z.string(), href: z.string().optional() }))
    .default([
      { text: "Free shipping on orders over ₹999", href: "/shop" },
      { text: "New drop: Jujutsu Kaisen limited hoodies", href: "/anime/jujutsu-kaisen" },
      { text: "Easy 7-day returns on eligible items", href: "/pages/returns-policy" },
    ]),
  support: z
    .object({
      email: z.string().default(""),
      phone: z.string().default(""),
      whatsapp: z.string().default(""),
      hours: z.string().default("Mon–Sat, 10:00–19:00 IST"),
    })
    .default({}),
  social: z
    .object({
      instagram: z.string().default(""),
      facebook: z.string().default(""),
      youtube: z.string().default(""),
      x: z.string().default(""),
      threads: z.string().default(""),
      discord: z.string().default(""),
      telegram: z.string().default(""),
      whatsapp: z.string().default(""),
      pinterest: z.string().default(""),
      linkedin: z.string().default(""),
    })
    .default({}),
  // Business identity. India's Consumer Protection (E-Commerce) Rules require the legal name, address,
  // customer care contact and a grievance officer to be displayed on the platform.
  business: z
    .object({
      ownerName: z.string().default("Satyam Behera"),
      legalName: z.string().default(""),
      address: z.string().default(""),
      gstin: z.string().default(""),
      cin: z.string().default(""),
    })
    .default({}),
  grievanceOfficer: z
    .object({
      name: z.string().default(""),
      designation: z.string().default("Grievance Officer"),
      email: z.string().default(""),
      phone: z.string().default(""),
    })
    .default({}),
  appearance: z
    .object({
      theme: z.enum(THEME_IDS).default("classic"),
      shopperChoice: z.boolean().default(true), // shoppers can pick their own theme from the header
      wallpapers: z.boolean().default(true), // animated backgrounds on anime themes
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
