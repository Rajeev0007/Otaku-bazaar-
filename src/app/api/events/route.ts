import { NextResponse, type NextRequest } from "next/server";
import { eventSchema, recordEvent } from "@/server/analytics/events";
import { rateLimit } from "@/server/security/rate-limit";
import { getCurrentUser } from "@/server/auth/session";

const isBot = (ua: string) => /bot|crawl|spider|slurp|preview|headless|lighthouse/i.test(ua);

/** Receives first-party storefront events (sent with navigator.sendBeacon). Always answers 204 so tracking never breaks the page. */
export async function POST(req: NextRequest) {
  const none = new NextResponse(null, { status: 204 });
  try {
    // Only accept events from our own pages.
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== req.nextUrl.host) return none;
    if (isBot(req.headers.get("user-agent") ?? "")) return none;
    if (Number(req.headers.get("content-length") ?? 0) > 4096) return none;

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await rateLimit(`events:${ip}`, 120, 60);
    if (!rl.ok) return none;

    const parsed = eventSchema.safeParse(JSON.parse(await req.text()));
    if (!parsed.success) return none;
    const user = await getCurrentUser().catch(() => null);
    await recordEvent(parsed.data, { userId: user?.id ?? null, ownHost: req.nextUrl.hostname });
  } catch {
    // ignore malformed payloads and transient DB errors
  }
  return none;
}
