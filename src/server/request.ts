import { headers } from "next/headers";

/** Best-effort client IP. On Vercel `x-forwarded-for` is set by the platform; the first entry is the client. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown").slice(0, 64);
}

export async function userAgent(): Promise<string> {
  return ((await headers()).get("user-agent") ?? "").slice(0, 300);
}

/** Rejects cross-site requests to mutating route handlers (server actions get this check from Next.js). */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) throw new Response("Forbidden", { status: 403 });
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new Response("Forbidden", { status: 403 });
  }
  if (originHost !== host) throw new Response("Forbidden", { status: 403 });
}
