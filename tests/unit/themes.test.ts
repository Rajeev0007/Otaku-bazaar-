import { describe, expect, it } from "vitest";
import { THEMES, THEME_IDS, themeBootScript, themeById } from "@/lib/themes";
import { storeSettingsSchema } from "@/server/settings";

describe("themes", () => {
  it("has unique ids and falls back to classic", () => {
    expect(new Set(THEME_IDS).size).toBe(THEMES.length);
    expect(themeById("nope").id).toBe("classic");
  });
  it("defaults appearance settings and rejects unknown themes", () => {
    expect(storeSettingsSchema.parse({}).appearance).toEqual({ theme: "classic", shopperChoice: true, wallpapers: true });
    expect(storeSettingsSchema.safeParse({ appearance: { theme: "<script>" } }).success).toBe(false);
  });
  it("boot script only embeds known theme ids", () => {
    const s = themeBootScript("cursed", false);
    expect(s).toContain('"cursed"');
    expect(s).toContain("if(false)");
  });
});
