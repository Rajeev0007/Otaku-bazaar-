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
  })
  .default({});

export type Integrations = {
  resendApiKey: string | null;
  mailFrom: string;
  googleClientId: string | null;
  googleClientSecret: string | null;
  /** Where each value came from, for the admin screen. Never contains secret values. */
  status: {
    email: "env" | "admin" | "off" | "unreadable";
    google: "env" | "admin" | "off" | "unreadable";
    mailFrom: string;
    googleClientId: string;
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

  const mailFrom = env.MAIL_FROM || s.mailFrom || "The Otaku Bazaar <onboarding@resend.dev>";
  return {
    resendApiKey,
    mailFrom,
    googleClientId,
    googleClientSecret,
    status: {
      email: envResend ? "env" : adminResend ? "admin" : s.resendApiKeyEnc ? "unreadable" : "off",
      google: envGoogle ? "env" : googleClientId ? "admin" : s.googleClientSecretEnc ? "unreadable" : "off",
      mailFrom,
      googleClientId: envGoogle?.id ?? s.googleClientId,
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
  await db.setting.upsert({ where: { key: "integrations" }, create: { key: "integrations", value: next }, update: { value: next } });
}
