// Third-party integrations, configured in Admin → Integrations (no environment variables needed).
// Environment variables, if set, take priority so advanced setups keep working.
import { cache } from "react";
import { z } from "zod";
import { db } from "@/server/db";
import { decryptSecret, encryptSecret } from "@/server/secrets";

const stored = z
  .object({
    resendApiKeyEnc: z.string().nullable().default(null),
    mailFrom: z.string().default(""),
    googleClientId: z.string().default(""),
    googleClientSecretEnc: z.string().nullable().default(null),
    razorpayKeyId: z.string().default(""),
    razorpayKeySecretEnc: z.string().nullable().default(null),
    razorpayWebhookSecretEnc: z.string().nullable().default(null),
    shiprocketEmail: z.string().default(""),
    shiprocketPasswordEnc: z.string().nullable().default(null),
    shiprocketPickup: z.string().default("Primary"),
    shiprocketWebhookToken: z.string().default(""),
    pkgLength: z.number().default(25),
    pkgBreadth: z.number().default(20),
    pkgHeight: z.number().default(5),
  })
  .default({});

export type Integrations = {
  resendApiKey: string | null;
  mailFrom: string;
  googleClientId: string | null;
  googleClientSecret: string | null;
  razorpay: { keyId: string; keySecret: string; webhookSecret: string | null; mode: "test" | "live" } | null;
  shiprocket: { email: string; password: string; pickupLocation: string; webhookToken: string; pkg: { length: number; breadth: number; height: number } } | null;
  /** Where each value came from, for the admin screen. Never contains secret values. */
  status: {
    email: "env" | "admin" | "off" | "unreadable";
    google: "env" | "admin" | "off" | "unreadable";
    mailFrom: string;
    googleClientId: string;
    razorpay: "env" | "admin" | "off" | "unreadable";
    razorpayKeyId: string;
    razorpayWebhook: boolean;
    shiprocket: "admin" | "off" | "unreadable";
    shiprocketEmail: string;
    shiprocketPickup: string;
    shiprocketWebhookToken: string;
    pkg: { length: number; breadth: number; height: number };
  };
};

async function readStored() {
  const row = await db.setting.findUnique({ where: { key: "integrations" } }).catch(() => null);
  const p = stored.safeParse(row?.value ?? {});
  return p.success ? p.data : stored.parse({});
}

export const getIntegrations = cache(async (): Promise<Integrations> => {
  const s = await readStored();
  const env = process.env;

  const envResend = env.RESEND_API_KEY || null;
  const adminResend = envResend ? null : await decryptSecret(s.resendApiKeyEnc);
  const resendApiKey = envResend ?? adminResend;

  const envGoogle = env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? { id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET } : null;
  const adminGoogleSecret = envGoogle ? null : await decryptSecret(s.googleClientSecretEnc);
  const googleClientId = envGoogle?.id ?? (s.googleClientId && adminGoogleSecret ? s.googleClientId : null);
  const googleClientSecret = envGoogle?.secret ?? (s.googleClientId ? adminGoogleSecret : null);

  const envRzp = env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET ? { keyId: env.RAZORPAY_KEY_ID, keySecret: env.RAZORPAY_KEY_SECRET, webhookSecret: env.RAZORPAY_WEBHOOK_SECRET || null } : null;
  const adminRzpSecret = envRzp ? null : await decryptSecret(s.razorpayKeySecretEnc);
  const adminRzpWebhook = envRzp ? null : await decryptSecret(s.razorpayWebhookSecretEnc);
  const rzp = envRzp ?? (s.razorpayKeyId && adminRzpSecret ? { keyId: s.razorpayKeyId, keySecret: adminRzpSecret, webhookSecret: adminRzpWebhook } : null);
  const razorpay = rzp ? { ...rzp, mode: rzp.keyId.startsWith("rzp_live_") ? ("live" as const) : ("test" as const) } : null;

  const srPassword = await decryptSecret(s.shiprocketPasswordEnc);
  const shiprocket = s.shiprocketEmail && srPassword ? { email: s.shiprocketEmail, password: srPassword, pickupLocation: s.shiprocketPickup || "Primary", webhookToken: s.shiprocketWebhookToken, pkg: { length: s.pkgLength, breadth: s.pkgBreadth, height: s.pkgHeight } } : null;

  const mailFrom = env.MAIL_FROM || s.mailFrom || "The Otaku Bazaar <onboarding@resend.dev>";
  return {
    resendApiKey,
    mailFrom,
    googleClientId,
    googleClientSecret,
    razorpay,
    shiprocket,
    status: {
      email: envResend ? "env" : adminResend ? "admin" : s.resendApiKeyEnc ? "unreadable" : "off",
      google: envGoogle ? "env" : googleClientId ? "admin" : s.googleClientSecretEnc ? "unreadable" : "off",
      mailFrom,
      googleClientId: envGoogle?.id ?? s.googleClientId,
      razorpay: envRzp ? "env" : razorpay ? "admin" : s.razorpayKeySecretEnc ? "unreadable" : "off",
      razorpayKeyId: envRzp?.keyId ?? s.razorpayKeyId,
      razorpayWebhook: !!razorpay?.webhookSecret,
      shiprocket: shiprocket ? "admin" : s.shiprocketPasswordEnc ? "unreadable" : "off",
      shiprocketEmail: s.shiprocketEmail,
      shiprocketPickup: s.shiprocketPickup,
      shiprocketWebhookToken: s.shiprocketWebhookToken,
      pkg: { length: s.pkgLength, breadth: s.pkgBreadth, height: s.pkgHeight },
    },
  };
});

export const integrationsInput = z.object({
  resendApiKey: z.string().trim().max(200).optional(), // blank = keep current
  clearResend: z.boolean().optional(),
  mailFrom: z.string().trim().max(200).refine((v) => !v || /<[^@\s]+@[^@\s]+>$|^[^@\s]+@[^@\s]+$/.test(v), "Use an address like: The Otaku Bazaar <orders@yourdomain.com>").optional(),
  googleClientId: z.string().trim().max(300).optional(),
  googleClientSecret: z.string().trim().max(300).optional(),
  clearGoogle: z.boolean().optional(),
  razorpayKeyId: z.string().trim().max(100).refine((v) => !v || /^rzp_(test|live)_[A-Za-z0-9]+$/.test(v), "Razorpay Key IDs look like rzp_test_… or rzp_live_…").optional(),
  razorpayKeySecret: z.string().trim().max(200).optional(),
  razorpayWebhookSecret: z.string().trim().max(200).optional(),
  clearRazorpay: z.boolean().optional(),
  shiprocketEmail: z.union([z.literal(""), z.string().trim().email("Enter the Shiprocket API user email")]).optional(),
  shiprocketPassword: z.string().max(200).optional(),
  shiprocketPickup: z.string().trim().max(80).optional(),
  pkgLength: z.coerce.number().min(1).max(200).optional(),
  pkgBreadth: z.coerce.number().min(1).max(200).optional(),
  pkgHeight: z.coerce.number().min(0.5).max(200).optional(),
  clearShiprocket: z.boolean().optional(),
});

export async function saveIntegrations(raw: unknown) {
  const input = integrationsInput.parse(raw);
  const cur = await readStored();
  const next = { ...cur };
  if (input.clearResend) next.resendApiKeyEnc = null;
  else if (input.resendApiKey) {
    if (!input.resendApiKey.startsWith("re_")) throw new Error("Resend API keys start with re_");
    next.resendApiKeyEnc = await encryptSecret(input.resendApiKey);
  }
  if (input.mailFrom !== undefined) next.mailFrom = input.mailFrom;
  if (input.clearGoogle) {
    next.googleClientId = "";
    next.googleClientSecretEnc = null;
  } else {
    if (input.googleClientId !== undefined) next.googleClientId = input.googleClientId;
    if (input.googleClientSecret) next.googleClientSecretEnc = await encryptSecret(input.googleClientSecret);
  }
  if (input.clearRazorpay) {
    next.razorpayKeyId = "";
    next.razorpayKeySecretEnc = null;
    next.razorpayWebhookSecretEnc = null;
  } else {
    if (input.razorpayKeyId !== undefined) next.razorpayKeyId = input.razorpayKeyId;
    if (input.razorpayKeySecret) next.razorpayKeySecretEnc = await encryptSecret(input.razorpayKeySecret);
    if (input.razorpayWebhookSecret) next.razorpayWebhookSecretEnc = await encryptSecret(input.razorpayWebhookSecret);
  }
  if (input.clearShiprocket) {
    next.shiprocketEmail = "";
    next.shiprocketPasswordEnc = null;
  } else {
    if (input.shiprocketEmail !== undefined) next.shiprocketEmail = input.shiprocketEmail;
    if (input.shiprocketPassword) next.shiprocketPasswordEnc = await encryptSecret(input.shiprocketPassword);
    if (input.shiprocketPickup) next.shiprocketPickup = input.shiprocketPickup;
    if (input.pkgLength) next.pkgLength = input.pkgLength;
    if (input.pkgBreadth) next.pkgBreadth = input.pkgBreadth;
    if (input.pkgHeight) next.pkgHeight = input.pkgHeight;
    if (next.shiprocketEmail && !next.shiprocketWebhookToken) {
      const { randomToken } = await import("@/server/security/crypto");
      next.shiprocketWebhookToken = randomToken(24);
    }
  }
  await db.setting.upsert({ where: { key: "integrations" }, create: { key: "integrations", value: next }, update: { value: next } });
}
