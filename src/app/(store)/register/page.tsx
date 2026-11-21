import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { getIntegrations } from "@/server/integrations";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleButton, RegisterForm } from "@/components/auth/auth-forms";
import { safeRedirectPath } from "@/lib/utils";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeRedirectPath((await searchParams).next, "/account");
  if (await getCurrentUser()) redirect(next);
  return (
    <AuthShell
      title="Create your account"
      subtitle="Faster checkout, order tracking, a synced wishlist and early access to drops."
      footer={
        <>
          Already have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-fg hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleButton next={next} enabled={!!(await getIntegrations()).googleClientId} />
      <RegisterForm next={next} />
    </AuthShell>
  );
}
