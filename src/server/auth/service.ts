// Framework-independent authentication logic (no Next.js imports) so it can be unit/integration tested.
import { TokenPurpose, type User } from "@prisma/client";
import { db } from "@/server/db";
import { getDummyHash, hashPassword, randomToken, sha256, verifyPassword } from "@/server/security/crypto";
import { enforceRateLimit, resetRateLimit } from "@/server/security/rate-limit";
import { button, emailLayout, esc, sendEmail } from "@/server/email";
import { appUrl } from "@/lib/utils";
import { emailSchema, passwordSchema, registerSchema } from "@/lib/validation";

export const SESSION_TTL_DAYS = 30;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

export class AuthError extends Error {
  constructor(
    message: string,
    public code: "INVALID" | "LOCKED" | "SUSPENDED" | "EXISTS" | "TOKEN" | "WEAK" = "INVALID",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export type SessionUser = Pick<User, "id" | "email" | "name" | "isStaff" | "emailVerifiedAt" | "avatarUrl" | "phone" | "marketingOptIn"> & {
  permissions: Set<string>;
  sessionId: string;
};

// ── Registration & verification ──

export async function registerUser(input: unknown) {
  const data = registerSchema.parse(input);
  const existing = await db.user.findUnique({ where: { email: data.email } });
  if (existing && existing.status !== "DELETED") {
    throw new AuthError("An account with this email already exists. Try signing in instead.", "EXISTS");
  }
  const passwordHash = await hashPassword(data.password);
  const user = await db.user.create({
    data: {
      email: data.email,
      name: data.name,
      passwordHash,
      marketingOptIn: data.marketingOptIn,
      referralCode: randomToken(6).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase(),
      wishlists: { create: {} },
    },
  });
  await sendVerificationEmail(user);
  try {
    const { getStoreSettings } = await import("@/server/settings");
    const bonus = (await getStoreSettings()).loyalty;
    if (bonus.enabled && bonus.signupBonus > 0) {
      const { addPoints } = await import("@/server/rewards/service");
      await db.$transaction((tx) => addPoints(tx, user.id, bonus.signupBonus, "SIGNUP_BONUS"));
    }
  } catch (err) {
    console.error("[auth] signup bonus", err);
  }
  return user;
}

async function issueToken(userId: string, purpose: TokenPurpose, ttlMinutes: number) {
  const token = randomToken();
  await db.verificationToken.deleteMany({ where: { userId, purpose, usedAt: null } });
  await db.verificationToken.create({
    data: { userId, purpose, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMinutes * 60_000) },
  });
  return token;
}

async function consumeToken(token: string, purpose: TokenPurpose) {
  if (!token || token.length > 200) throw new AuthError("This link is invalid or has expired.", "TOKEN");
  return db.$transaction(async (tx) => {
    const record = await tx.verificationToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!record || record.purpose !== purpose || record.usedAt || record.expiresAt < new Date()) {
      throw new AuthError("This link is invalid or has expired.", "TOKEN");
    }
    // Conditional update makes the token single-use even under concurrent requests.
    const used = await tx.verificationToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
    if (used.count !== 1) throw new AuthError("This link has already been used.", "TOKEN");
    return record;
  });
}

export async function sendVerificationEmail(user: Pick<User, "id" | "email" | "name">) {
  const token = await issueToken(user.id, TokenPurpose.EMAIL_VERIFY, 60 * 24);
  const link = appUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  await sendEmail({
    to: user.email,
    userId: user.id,
    template: "account.verify_email",
    subject: "Confirm your email for The Otaku Bazaar",
    text: `Hi ${user.name ?? "there"},\n\nConfirm your email address: ${link}\n\nThis link expires in 24 hours.`,
    html: emailLayout(
      "Confirm your email",
      `<p>Hi ${esc(user.name ?? "there")}, welcome to The Otaku Bazaar.</p>${button(link, "Confirm email")}<p>This link expires in 24 hours.</p>`,
    ),
  });
}

export async function verifyEmail(token: string) {
  const record = await consumeToken(token, TokenPurpose.EMAIL_VERIFY);
  await db.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
  return record.userId;
}

// ── Login ──

export async function authenticate(rawEmail: string, password: string, ip: string) {
  const email = emailSchema.parse(rawEmail);
  // Per-IP and per-account limits. Account lockout below adds brute-force protection per user.
  await enforceRateLimit(`login:ip:${ip}`, 30, 15 * 60);
  await enforceRateLimit(`login:email:${email}`, 10, 15 * 60);

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    await verifyPassword(password, await getDummyHash());
    throw new AuthError(user ? "This account uses Google sign-in. Continue with Google instead." : "Incorrect email or password.");
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AuthError("Too many failed attempts. Try again in a few minutes or reset your password.", "LOCKED");
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const failed = user.failedLogins + 1;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLogins: failed >= MAX_FAILED_LOGINS ? 0 : failed,
        lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : user.lockedUntil,
      },
    });
    throw new AuthError("Incorrect email or password.");
  }
  if (user.status === "SUSPENDED" || user.status === "BANNED" || user.status === "DELETED") {
    throw new AuthError("This account is not active. Please contact support.", "SUSPENDED");
  }
  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await resetRateLimit(`login:email:${email}`);
  return user;
}

// ── Sessions ──

export async function createSessionRecord(userId: string, meta: { ip?: string; userAgent?: string } = {}) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  await db.session.create({
    data: { userId, tokenHash: sha256(token), expiresAt, ip: meta.ip?.slice(0, 64), userAgent: meta.userAgent?.slice(0, 300) },
  });
  return { token, expiresAt };
}

export async function getUserBySessionToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token || token.length > 200) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: {
        include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
      },
    },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const u = session.user;
  if (u.status !== "ACTIVE") return null;

  // Refresh activity at most hourly to avoid a write per request.
  if (Date.now() - session.lastSeenAt.getTime() > 3_600_000) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }

  const permissions = new Set<string>();
  if (u.isStaff) for (const ur of u.roles) for (const rp of ur.role.permissions) permissions.add(rp.permission.key);

  return {
    id: u.id,
    email: u.email,
    name: u.name,
    isStaff: u.isStaff,
    emailVerifiedAt: u.emailVerifiedAt,
    avatarUrl: u.avatarUrl,
    phone: u.phone,
    marketingOptIn: u.marketingOptIn,
    permissions,
    sessionId: session.id,
  };
}

export async function revokeSessionToken(token: string) {
  await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

// ── Password reset & change ──

export async function requestPasswordReset(rawEmail: string, ip: string) {
  const email = emailSchema.parse(rawEmail);
  await enforceRateLimit(`reset:ip:${ip}`, 10, 60 * 60);
  await enforceRateLimit(`reset:email:${email}`, 3, 60 * 60);
  const user = await db.user.findUnique({ where: { email } });
  // Same response whether or not the account exists, to avoid account enumeration.
  if (!user || user.status !== "ACTIVE") return;
  const token = await issueToken(user.id, TokenPurpose.PASSWORD_RESET, 60);
  const link = appUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  await sendEmail({
    to: user.email,
    userId: user.id,
    template: "account.password_reset",
    subject: "Reset your Otaku Bazaar password",
    text: `Reset your password: ${link}\n\nThis link expires in 1 hour. If you didn't ask for this, ignore this email.`,
    html: emailLayout(
      "Reset your password",
      `<p>We received a request to reset your password.</p>${button(link, "Choose a new password")}<p>This link expires in 1 hour. If you didn't ask for this, you can ignore this email.</p>`,
    ),
  });
}

export async function resetPassword(token: string, newPassword: string) {
  const password = passwordSchema.parse(newPassword);
  const record = await consumeToken(token, TokenPurpose.PASSWORD_RESET);
  const passwordHash = await hashPassword(password);
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash, failedLogins: 0, lockedUntil: null, emailVerifiedAt: new Date() } }),
    // Sign out everywhere after a reset.
    db.session.deleteMany({ where: { userId: record.userId } }),
  ]);
  return record.userId;
}

export async function changePassword(userId: string, currentSessionId: string, current: string, next: string) {
  const password = passwordSchema.parse(next);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.passwordHash && !(await verifyPassword(current, user.passwordHash))) {
    throw new AuthError("Your current password is incorrect.");
  }
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } }),
    db.session.deleteMany({ where: { userId, NOT: { id: currentSessionId } } }),
  ]);
}

// ── OAuth ──

export async function findOrCreateOAuthUser(input: {
  provider: string;
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  name?: string | null;
  avatarUrl?: string | null;
}) {
  const linked = await db.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider: input.provider, providerAccountId: input.providerAccountId } },
    include: { user: true },
  });
  if (linked) return linked.user;

  const email = emailSchema.parse(input.email);
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // Only auto-link when the provider has verified the email; otherwise someone could claim another user's account.
    if (!input.emailVerified) throw new AuthError("Please verify your email with Google first.");
    await db.oAuthAccount.create({ data: { userId: existing.id, provider: input.provider, providerAccountId: input.providerAccountId } });
    return db.user.update({
      where: { id: existing.id },
      data: { emailVerifiedAt: existing.emailVerifiedAt ?? new Date(), avatarUrl: existing.avatarUrl ?? input.avatarUrl },
    });
  }
  return db.user.create({
    data: {
      email,
      name: input.name ?? null,
      avatarUrl: input.avatarUrl ?? null,
      emailVerifiedAt: input.emailVerified ? new Date() : null,
      referralCode: randomToken(6).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase(),
      accounts: { create: { provider: input.provider, providerAccountId: input.providerAccountId } },
      wishlists: { create: {} },
    },
  });
}
