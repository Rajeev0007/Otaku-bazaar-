import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { AuthError, authenticate, createSessionRecord, findOrCreateOAuthUser, getUserBySessionToken, registerUser, requestPasswordReset, resetPassword, verifyEmail } from "@/server/auth/service";
import { randomToken, sha256 } from "@/server/security/crypto";
import { RateLimitError } from "@/server/security/rate-limit";

afterAll(() => db.$disconnect());

const email = () => `t-${randomToken(6).replace(/[^a-zA-Z0-9]/g, "x").toLowerCase()}@test.local`;
const ip = () => `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

describe("authentication", () => {
  it("registers, stores only a password hash, and rejects duplicate emails", async () => {
    const e = email();
    const u = await registerUser({ name: "Asha", email: e.toUpperCase(), password: "secret123" });
    expect(u.email).toBe(e);
    expect(u.passwordHash).toMatch(/^scrypt\$/);
    expect(u.passwordHash).not.toContain("secret123");
    await expect(registerUser({ name: "Asha", email: e, password: "secret123" })).rejects.toThrow(AuthError);
  });

  it("logs in with the right password only, with a generic error", async () => {
    const e = email();
    await registerUser({ name: "B", email: e, password: "secret123" });
    expect((await authenticate(e, "secret123", ip())).email).toBe(e);
    await expect(authenticate(e, "wrong-pass1", ip())).rejects.toThrow("Incorrect email or password.");
    await expect(authenticate(email(), "whatever1", ip())).rejects.toThrow("Incorrect email or password.");
  });

  it("locks the account after repeated failures", async () => {
    const e = email();
    await registerUser({ name: "C", email: e, password: "secret123" });
    for (let i = 0; i < 5; i++) await authenticate(e, "nope12345", ip()).catch(() => undefined);
    await expect(authenticate(e, "secret123", ip())).rejects.toMatchObject({ code: "LOCKED" });
  });

  it("rate-limits attempts per IP", async () => {
    const addr = ip();
    let limited = false;
    for (let i = 0; i < 35; i++) {
      try {
        await authenticate(email(), "x1234567", addr);
      } catch (err) {
        if (err instanceof RateLimitError) limited = true;
      }
    }
    expect(limited).toBe(true);
  });

  it("issues opaque sessions stored as hashes and rejects suspended users", async () => {
    const e = email();
    const u = await registerUser({ name: "D", email: e, password: "secret123" });
    const { token } = await createSessionRecord(u.id);
    expect(await db.session.findUnique({ where: { tokenHash: token } })).toBeNull();
    expect(await db.session.findUnique({ where: { tokenHash: sha256(token) } })).not.toBeNull();
    expect((await getUserBySessionToken(token))?.id).toBe(u.id);
    await db.user.update({ where: { id: u.id }, data: { status: "SUSPENDED" } });
    expect(await getUserBySessionToken(token)).toBeNull();
    expect(await getUserBySessionToken("forged")).toBeNull();
  });

  it("password reset tokens are single-use and revoke existing sessions", async () => {
    const e = email();
    const u = await registerUser({ name: "E", email: e, password: "secret123" });
    const { token: session } = await createSessionRecord(u.id);
    await requestPasswordReset(e, ip());
    const n = await db.notification.findFirst({ where: { recipient: e, template: "account.password_reset" }, orderBy: { createdAt: "desc" } });
    const resetToken = decodeURIComponent(n!.body.match(/token=([^\s]+)/)![1]!);
    await resetPassword(resetToken, "newpass456");
    await expect(resetPassword(resetToken, "another789")).rejects.toThrow(AuthError);
    expect(await getUserBySessionToken(session)).toBeNull();
    expect((await authenticate(e, "newpass456", ip())).id).toBe(u.id);
  });

  it("verifies email with a one-time link", async () => {
    const e = email();
    const u = await registerUser({ name: "F", email: e, password: "secret123" });
    const n = await db.notification.findFirst({ where: { recipient: e, template: "account.verify_email" } });
    const token = decodeURIComponent(n!.body.match(/token=([^\s]+)/)![1]!);
    await verifyEmail(token);
    expect((await db.user.findUnique({ where: { id: u.id } }))!.emailVerifiedAt).not.toBeNull();
    await expect(verifyEmail(token)).rejects.toThrow(AuthError);
  });

  it("links Google accounts only when Google has verified the email", async () => {
    const e = email();
    await registerUser({ name: "G", email: e, password: "secret123" });
    await expect(findOrCreateOAuthUser({ provider: "google", providerAccountId: randomToken(), email: e, emailVerified: false })).rejects.toThrow(AuthError);
    const linked = await findOrCreateOAuthUser({ provider: "google", providerAccountId: "g-" + randomToken(), email: e, emailVerified: true });
    expect(linked.email).toBe(e);
  });
});
