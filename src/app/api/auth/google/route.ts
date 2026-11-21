import { NextResponse } from "next/server";
import { getAuthSecret } from "@/server/secrets";
import { getIntegrations } from "@/server/integrations";
import { createHash } from "node:crypto";
import { randomToken, sign } from "@/server/security/crypto";
import { appUrl, safeRedirectPath } from "@/lib/utils";
import { rateLimit } from "@/server/security/rate-limit";

const OAUTH_COOKIE = "ob_oauth";

// Starts the Google OAuth 2.0 authorization-code flow with PKCE and a signed state cookie.
export async function GET(req: Request) {
  const clientId = (await getIntegrations()).googleClientId;
  if (!clientId) return NextResponse.redirect(appUrl("/login?error=oauth"));
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await rateLimit(`oauth:${ip}`, 30, 600)).ok) return NextResponse.redirect(appUrl("/login?error=oauth"));

  const next = safeRedirectPath(new URL(req.url).searchParams.get("next"), "/account");
  const state = randomToken(24);
  const verifier = randomToken(48);
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: appUrl("/api/auth/google/callback"),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_COOKIE, sign(JSON.stringify({ state, verifier, next }), await getAuthSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return res;
}
