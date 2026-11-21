import type { Metadata } from "next";
import Link from "next/link";
import { configProblems } from "@/lib/env";
import { getSetupState } from "@/server/setup";
import { OwnerForm } from "./owner-form";

export const metadata: Metadata = { title: "Store setup", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const problems = configProblems();
  const state = problems.length ? null : await getSetupState();

  const steps = [
    { label: "Connect the database", done: !problems.length && state?.database !== "unreachable" },
    { label: "Set up store data", done: !!state?.roles },
    { label: "Create the owner account", done: !!state?.owner },
  ];

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-xl rounded-3xl border border-line bg-surface p-6 sm:p-8">
        <p className="eyebrow mb-3">The Otaku Bazaar · Setup</p>
        <ol className="mb-6 flex flex-wrap gap-2 text-xs">
          {steps.map((s, i) => (
            <li key={s.label} className={`rounded-full px-3 py-1.5 ${s.done ? "bg-success/15 text-success" : "bg-surface-3 text-muted"}`}>
              {s.done ? "✓" : i + 1} {s.label}
            </li>
          ))}
        </ol>

        {problems.length > 0 ? (
          <Step title="Connect a database">
            <p>The site is deployed but has no database yet.</p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5">
              <li>In Vercel, open your project → <b>Storage</b> → <b>Create Database</b> → <b>Neon</b>.</li>
              <li>Choose region <b>Singapore</b>, plan <b>Free</b>, click <b>Create</b>, then <b>Connect</b> to this project.</li>
              <li>Go to <b>Deployments</b> → ⋯ on the latest → <b>Redeploy</b>.</li>
            </ol>
          </Step>
        ) : state?.database === "unreachable" ? (
          <Step title="Can't reach the database">
            <p>A database is connected but isn't answering. In Vercel → Storage, check the Neon database is active and connected to this environment, then redeploy.</p>
          </Step>
        ) : !state?.roles ? (
          <Step title="Redeploy to finish setup">
            <p>The database is connected, but the store tables aren't created yet. They're created automatically during a deploy.</p>
            <p className="mt-2">In Vercel: <b>Deployments</b> → ⋯ on the latest → <b>Redeploy</b>. Then reload this page.</p>
          </Step>
        ) : !state.owner ? (
          <>
            <h1 className="text-2xl font-semibold">Create the owner account</h1>
            <p className="mt-2 text-sm text-muted">
              This account gets full control of the store. To prove you own this deployment, enter the <b>owner setup code</b>. Find it in Vercel → <b>Deployments</b> → the latest deployment → <b>Build Logs</b> (search for “OWNER SETUP CODE”).
            </p>
            <div className="mt-6">
              <OwnerForm />
            </div>
          </>
        ) : (
          <Step title="Setup complete">
            <p>The store is ready. Manage everything from the admin panel.</p>
            <div className="mt-5 flex gap-3">
              <Link href="/admin" className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">Open admin</Link>
              <Link href="/" className="inline-flex h-11 items-center rounded-full border border-line-strong px-5 text-sm font-semibold">View store</Link>
            </div>
          </Step>
        )}
      </div>
    </main>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="mt-3 text-sm text-muted">{children}</div>
    </>
  );
}
