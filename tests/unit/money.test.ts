import { describe, expect, it } from "vitest";
import { applyBps, discountPercent, formatMoney, inclusiveTax, toMajor, toMinor } from "@/lib/money";

describe("money", () => {
  it("converts between major and minor units per currency", () => {
    expect(toMinor(999, "INR")).toBe(99_900);
    expect(toMinor(19.99, "USD")).toBe(1999);
    expect(toMinor(1500, "JPY")).toBe(1500);
    expect(toMajor(99_900, "INR")).toBe(999);
  });

  it("formats with the right symbol and no float artefacts", () => {
    expect(formatMoney(99_900, "INR")).toBe("₹999");
    expect(formatMoney(129_950, "INR")).toBe("₹1,299.5");
    expect(formatMoney(1999, "USD", "en-US")).toBe("$19.99");
  });

  it("computes discount percentage only for a real markdown", () => {
    expect(discountPercent(79_900, 99_900)).toBe(20);
    expect(discountPercent(99_900, 99_900)).toBe(0);
    expect(discountPercent(99_900, 79_900)).toBe(0);
    expect(discountPercent(99_900, null)).toBe(0);
  });

  it("extracts inclusive GST and applies basis points with integer rounding", () => {
    // ₹1180 including 18% GST contains ₹180 GST
    expect(inclusiveTax(118_000, 1800)).toBe(18_000);
    expect(inclusiveTax(118_000, 0)).toBe(0);
    expect(applyBps(10_000, 1250)).toBe(1250);
    expect(Number.isInteger(applyBps(333, 3333))).toBe(true);
  });
});
