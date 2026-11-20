import { renderDemoArt } from "@/lib/demo-art";

export function GET(req: Request, ctx: { params: Promise<{ file: string }> }) {
  return ctx.params.then(({ file }) => {
    const url = new URL(req.url);
    const svg = renderDemoArt({
      kind: file.replace(/\.svg$/, ""),
      color: url.searchParams.get("c") ?? undefined,
      label: url.searchParams.get("l") ?? undefined,
      mark: url.searchParams.get("m") ?? undefined,
      variant: Number(url.searchParams.get("v") ?? 1),
    });
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=31536000, immutable",
        // SVGs are rendered from escaped parameters; this CSP blocks any script execution regardless.
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      },
    });
  });
}
