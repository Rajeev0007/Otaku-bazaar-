import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { sha256 } from "@/server/security/crypto";
import { _resetSecretCache, decryptSecret, encryptSecret, getAuthSecret } from "@/server/secrets";
import { getIntegrations, saveIntegrations } from "@/server/integrations";

afterAll(() => db.$disconnect());

describe("secrets without environment variables", () => {
  const saved = process.env.AUTH_SECRET;
  beforeAll(async () => {
    delete process.env.AUTH_SECRET;
    await db.setting.deleteMany({ where: { key: "auth_secret" } });
    _resetSecretCache();
  });
  afterAll(() => {
    process.env.AUTH_SECRET = saved;
    _resetSecretCache();
  });

  it("generates one stable secret and keeps it in the database", async () => {
    const [a, b] = await Promise.all([getAuthSecret(), getAuthSecret()]);
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
    _resetSecretCache();
    expect(await getAuthSecret()).toBe(a);
  });

  it("encrypts integration keys and never stores them in plain text", async () => {
    await saveIntegrations({ resendApiKey: "re_test_123456789", mailFrom: "Shop <orders@example.com>", googleClientId: "gid", googleClientSecret: "gsecret" });
    const row = await db.setting.findUniqueOrThrow({ where: { key: "integrations" } });
    expect(JSON.stringify(row.value)).not.toContain("re_test_123456789");
    expect(JSON.stringify(row.value)).not.toContain("gsecret");
    const i = await getIntegrations();
    expect(i.resendApiKey).toBe("re_test_123456789");
    expect(i.googleClientSecret).toBe("gsecret");
    expect(i.status.email).toBe("admin");
    // blank keeps the saved key
    await saveIntegrations({ resendApiKey: "", mailFrom: "Shop <orders@example.com>" });
    expect((await getIntegrations()).resendApiKey).toBe("re_test_123456789");
    await saveIntegrations({ clearResend: true, clearGoogle: true });
    expect((await getIntegrations()).status.email).toBe("off");
    await expect(saveIntegrations({ resendApiKey: "not-a-resend-key" })).rejects.toThrow(/re_/);
  });

  it("detects a changed secret instead of returning garbage", async () => {
    const enc = await encryptSecret("hello");
    expect(await decryptSecret(enc)).toBe("hello");
    // Flip one byte of the auth tag: decryption must fail, not return wrong text.
    const parts = enc.split(".");
    const tag = Buffer.from(parts[2]!, "base64url");
    tag[0] = tag[0]! ^ 0xff;
    parts[2] = tag.toString("base64url");
    expect(await decryptSecret(parts.join("."))).toBeNull();
    expect(await decryptSecret("garbage")).toBeNull();
  });
});

describe("owner setup", () => {
  it("only accepts the current code and only creates one owner", async () => {
    const setup = await import("@/server/setup");
    const role = await db.role.upsert({ where: { key: "super_admin" }, create: { key: "super_admin", name: "Super Admin" }, update: {} });
    const otherOwners = await db.userRole.findMany({ where: { roleId: role.id } });
    await db.userRole.deleteMany({ where: { roleId: role.id } });
    vi.resetModules();
    const fresh = await import("@/server/setup");
    try {
      const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
      expect(await fresh.issueSetupCode("build")).toBe(true);
      const code = String(log.mock.calls.flat().join("\n")).match(/OWNER SETUP CODE: ([A-Z0-9]{4}-[A-Z0-9]{4})/)![1]!;
      log.mockRestore();
      const stored = await db.setting.findUniqueOrThrow({ where: { key: "setup_code" } });
      expect((stored.value as { hash: string }).hash).toBe(sha256(code));

      const email = `owner-${Date.now()}@test.local`;
      await expect(fresh.claimOwner({ code: "WRNG-CODE", name: "Satyam Behera", email, password: "ownerpass1" })).rejects.toThrow(/wrong or expired/);
      const owner = await fresh.claimOwner({ code: code.toLowerCase().replace("-", ""), name: "Satyam Behera", email, password: "ownerpass1" });
      expect(owner.isStaff).toBe(true);
      expect(await fresh.hasOwner()).toBe(true);
      await expect(fresh.claimOwner({ code, name: "Intruder", email: `x-${email}`, password: "ownerpass1" })).rejects.toThrow();
      expect(await fresh.issueSetupCode("runtime")).toBe(false);
      expect(await db.setting.findUnique({ where: { key: "setup_code" } })).toBeNull();
    } finally {
      for (const o of otherOwners) await db.userRole.upsert({ where: { userId_roleId: { userId: o.userId, roleId: o.roleId } }, create: o, update: {} });
      void setup;
    }
  });
});
