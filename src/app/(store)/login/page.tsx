import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleButton, LoginForm } from "@/components/auth/auth-forms";
import { FormError } from "@/components/ui/field";
import { safeRedirectPath } from "@/lib/utils";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const OAUTH_ERRORS: Record<string, string> = {
  oauth: "Google sign-in didn't complete. Please try again.",
  oauth_email: "Your Google email isn't verified. Verify it with Google or sign in with a password.",
  suspended: "This account is not active. Please contact support.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeRedirectPath(sp.next, "/account");
  if (await getCurrentUser()) redirect(next);
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to track orders, sync your wishlist and check out faster."
      footer={
        <>
          New here?{" "}
          <Link href={`/register?next=${encodeURIComponent(next)}`} className="font-semibold text-fg hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <FormError message={sp.error ? OAUTH_ERRORS[sp.error] : null} />
      <GoogleButton next={next} enabled={!!process.env.GOOGLE_CLIENT_ID} />
      <LoginForm next={next} />
    </AuthShell>
  );
}
