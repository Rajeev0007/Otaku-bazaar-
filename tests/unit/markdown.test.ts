import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { Markdown } from "@/lib/markdown";

const html = (src: string) => renderToStaticMarkup(createElement(Markdown, { source: src }));

describe("markdown renderer", () => {
  it("renders the supported subset", () => {
    const out = html("## Title\n\nHello **bold** and _it_.\n\n- one\n- two\n\n> note\n\n[About](/pages/about)");
    expect(out).toContain("<h2>Title</h2>");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<li>two</li>");
    expect(out).toContain("<blockquote>note</blockquote>");
    expect(out).toContain('<a href="/pages/about">About</a>');
  });

  it("never emits raw HTML or script URLs", () => {
    const out = html('<img src=x onerror=alert(1)>\n\n[click](javascript:alert(1))\n\n[x](//evil.com)');
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain('href="//evil.com"');
  });
});
