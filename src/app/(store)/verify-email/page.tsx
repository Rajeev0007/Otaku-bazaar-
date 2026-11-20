import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ButtonLink } from "@/components/ui/button";
import { AuthError, verifyEmail } from "@/server/auth/service";

export const metadata: Metadata = { title: "Verify email", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  let ok = false;
  let message = "This link is invalid or has expired.";
  try {
    if (token) {
      await verifyEmail(token);
      ok = true;
    }
  } catch (err) {
    if (err instanceof AuthError) message = err.message;
    else throw err;
  }
  return (
    <AuthShell title={ok ? "Email confirmed" : "We couldn't confirm your email"} subtitle={ok ? "Thanks! Your account is fully set up." : message}>
      <ButtonLink href="/account" className="w-full" size="lg">
        {ok ? "Go to my account" : "Go to my account to resend the link"}
      </ButtonLink>
    </AuthShell>
  );
}
