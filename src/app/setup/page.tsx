import type { Metadata } from "next";
import Link from "next/link";
import { configProblems } from "@/lib/env";

export const metadata: Metadata = { title: "Store setup", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Shown (via middleware) while required settings are missing. Never touches the database.
export default function SetupPage() {
  const problems = configProblems();
  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16">
      <div className="w-full max-w-xl rounded-3xl border border-line bg-surface p-8">
        <p className="eyebrow mb-3">The Otaku Bazaar</p>
        {problems.length === 0 ? (
          <>
            <h1 className="text-2xl font-semibold">Setup complete</h1>
            <p className="mt-2 text-muted">All required settings are in place.</p>
            <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">Open the store</Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">The store is deployed. Finish setup to open it.</h1>
            <p className="mt-2 text-sm text-muted">Fix these in Vercel, then redeploy (Deployments → ⋯ → Redeploy). Full guide: docs/DEPLOY-VERCEL.md in the repository.</p>
            <ol className="mt-6 space-y-4">
              {problems.map((p, i) => (
                <li key={p.key} className="rounded-2xl border border-warning/30 bg-warning/5 p-4">
                  <p className="font-semibold">
                    {i + 1}. {p.message}
                  </p>
                  <p className="mt-1 text-sm text-muted">{p.fix}</p>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </main>
  );
}
