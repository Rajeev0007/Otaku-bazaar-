import { describe, expect, it } from "vitest";
import { renderDemoArt } from "@/lib/demo-art";

describe("demo art", () => {
  it("escapes labels with & into valid XML (no &AMP;)", () => {
    const svg = renderDemoArt({ kind: "figure", label: "Figures & Collectibles <x>" });
    expect(svg).toContain("FIGURES &amp; COLLECTIBLES &lt;X&gt;");
    expect(svg).not.toMatch(/&AMP;|&LT;|&GT;/);
  });
});
