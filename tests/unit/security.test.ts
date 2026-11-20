import { describe, expect, it } from "vitest";
import { hashPassword, sha256, sign, unsign, verifyPassword } from "@/server/security/crypto";
import { safeRedirectPath } from "@/lib/utils";
import { hasPermission, DEFAULT_ROLES } from "@/server/auth/permissions";
import { sniffImage } from "@/server/storage";
import { passwordSchema } from "@/lib/validation";
import { renderDemoArt } from "@/lib/demo-art";

describe("password hashing", () => {
  it("hashes with a random salt and verifies", async () => {
    const a = await hashPassword("correct horse 1");
    const b = await hashPassword("correct horse 1");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse 1", a)).toBe(true);
    expect(await verifyPassword("wrong horse 1", a)).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });

  it("enforces a minimum password policy", () => {
    expect(passwordSchema.safeParse("short1").success).toBe(false);
    expect(passwordSchema.safeParse("onlyletters").success).toBe(false);
    expect(passwordSchema.safeParse("letters123").success).toBe(true);
  });
});

describe("signed cookies", () => {
  it("rejects tampered values", () => {
    const s = sign("cart-token");
    expect(unsign(s)).toBe("cart-token");
    expect(unsign(s.replace("cart", "cort"))).toBeNull();
    expect(unsign("cart-token.forged")).toBeNull();
    expect(unsign(undefined)).toBeNull();
  });

  it("stores only hashes of secrets", () => {
    expect(sha256("abc")).toHaveLength(64);
  });
});

describe("open redirect protection", () => {
  it("allows only same-site relative paths", () => {
    expect(safeRedirectPath("/account/orders")).toBe("/account/orders");
    expect(safeRedirectPath("//evil.com")).toBe("/account");
    expect(safeRedirectPath("https://evil.com")).toBe("/account");
    expect(safeRedirectPath("/\\evil.com")).toBe("/account");
    expect(safeRedirectPath(null, "/")).toBe("/");
  });
});

describe("role-based access", () => {
  it("support agents cannot manage products or staff", () => {
    const support = DEFAULT_ROLES.support_agent!.permissions;
    expect(hasPermission(support, "support.write")).toBe(true);
    expect(hasPermission(support, "products.write")).toBe(false);
    expect(hasPermission(support, "staff.manage")).toBe(false);
  });
  it("only super admins can manage staff and settings", () => {
    for (const [key, role] of Object.entries(DEFAULT_ROLES)) {
      expect(hasPermission(role.permissions, "staff.manage")).toBe(key === "super_admin");
      expect(hasPermission(role.permissions, "settings.write")).toBe(key === "super_admin");
    }
  });
});

describe("upload validation", () => {
  it("detects image types from bytes, not names", () => {
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))?.type).toBe("image/jpeg");
    expect(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.type).toBe("image/png");
    expect(sniffImage(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImage(Buffer.from("<?php echo 1; ?>"))).toBeNull();
  });
});

describe("demo art", () => {
  it("escapes user-controlled text", () => {
    const svg = renderDemoArt({ kind: "tshirt", label: '<script>alert(1)</script>', mark: '"><x', color: "javascript:1" });
    expect(svg).not.toContain("<script>");
    expect(svg).not.toContain('"><x');
    expect(svg).toContain("#f0506e"); // invalid colour falls back
  });
});
