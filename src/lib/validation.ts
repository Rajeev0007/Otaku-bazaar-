import { z } from "zod";

// Shared between client forms and server actions. The server always re-validates.

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "Use at most 128 characters")
  .refine((p) => /[a-zA-Z]/.test(p) && /[0-9]/.test(p), "Use at least one letter and one number");

export const nameSchema = z.string().trim().min(1, "Enter your name").max(80);

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number");

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  marketingOptIn: z.boolean().default(false),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(128),
});

export const profileSchema = z.object({
  name: nameSchema,
  phone: z.union([phoneSchema, z.literal("")]).optional(),
  marketingOptIn: z.boolean(),
});

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const k = issue.path.join(".") || "form";
    out[k] ??= issue.message;
  }
  return out;
}

export type ActionResult<T = undefined> =
  | ({ ok: true; message?: string } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
