import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  return (
    <AuthShell title="Choose a new password" subtitle="You'll be signed out of other devices once it's changed.">
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="text-sm text-muted">
          This link is incomplete. <Link href="/forgot-password" className="text-accent hover:underline">Request a new reset link</Link>.
        </p>
      )}
    </AuthShell>
  );
}
