import { describe, expect, it } from "vitest";
import { addBusinessDays } from "@/server/shipping/estimate";

describe("delivery dates", () => {
  it("skips Sundays", () => {
    const sat = new Date("2026-11-21T10:00:00+05:30"); // Saturday
    const d = addBusinessDays(sat, 1);
    expect(d.getDay()).toBe(1); // Monday
  });
  it("counts business days", () => {
    const mon = new Date("2026-11-23T10:00:00+05:30");
    expect(addBusinessDays(mon, 6).getDay()).toBe(1); // next Monday (Sun skipped)
  });
});
