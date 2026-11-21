import { NextResponse } from "next/server";
import { getAuthSecret } from "@/server/secrets";
import { getIntegrations } from "@/server/integrations";
import { cookies } from "next/headers";
import { z } from "zod";
import { safeEqual, unsign } from "@/server/security/crypto";
import { AuthError, findOrCreateOAuthUser } from "@/server/auth/service";
import { startSession } from "@/server/auth/session";
import { appUrl } from "@/lib/utils";

const OAUTH_COOKIE = "ob_oauth";

const userInfoSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const raw = unsign(jar.get(OAUTH_COOKIE)?.value, await getAuthSecret());
  jar.delete({ name: OAUTH_COOKIE, path: "/api/auth/google" });
  const fail = (code = "oauth") => NextResponse.redirect(appUrl(`/login?error=${code}`));

  if (!raw) return fail();
  let saved: { state: string; verifier: string; next: string };
  try {
    saved = JSON.parse(raw);
  } catch {
    return fail();
  }
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code");
  if (!code || !safeEqual(state, saved.state)) return fail();

  const integ = await getIntegrations();
  if (!integ.googleClientId || !integ.googleClientSecret) return fail();
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: integ.googleClientId,
        client_secret: integ.googleClientSecret,
        redirect_uri: appUrl("/api/auth/google/callback"),
        grant_type: "authorization_code",
        code_verifier: saved.verifier,
      }),
    });
    if (!tokenRes.ok) return fail();
    const { access_token } = (await tokenRes.json()) as { access_token?: string };
    if (!access_token) return fail();

    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${access_token}` } });
    if (!infoRes.ok) return fail();
    const info = userInfoSchema.parse(await infoRes.json());

    const user = await findOrCreateOAuthUser({
      provider: "google",
      providerAccountId: info.sub,
      email: info.email,
      emailVerified: info.email_verified === true,
      name: info.name,
      avatarUrl: info.picture,
    });
    if (user.status !== "ACTIVE") return fail("suspended");
    await startSession(user.id);
    return NextResponse.redirect(appUrl(saved.next));
  } catch (err) {
    if (err instanceof AuthError) return fail("oauth_email");
    console.error("[oauth] google callback failed", err);
    return fail();
  }
}
