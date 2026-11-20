"use client";

import { useActionState } from "react";
import { subscribeNewsletterAction } from "@/app/actions/newsletter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function NewsletterForm({ source, compact }: { source: string; compact?: boolean }) {
  const [state, action, pending] = useActionState(subscribeNewsletterAction, null);
  if (state?.ok) return <p className="rounded-2xl bg-success/10 px-4 py-3 text-sm text-success" role="status">{state.message}</p>;
  return (
    <form action={action} className="space-y-2.5">
      <input type="hidden" name="source" value={source} />
      <div className={cn("flex gap-2", !compact && "flex-col sm:flex-row")}>
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          aria-label="Email address"
          autoComplete="email"
          className={cn("h-11 min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-4 text-sm outline-none focus:border-accent", !compact && "h-12 bg-bg/40")}
        />
        <Button type="submit" loading={pending} className={cn(!compact && "h-12")}>
          Subscribe
        </Button>
      </div>
      <label className="flex items-start gap-2 text-xs text-muted">
        <input type="checkbox" name="consent" required className="mt-0.5 accent-[var(--accent)]" />
        <span>I agree to receive marketing emails. Unsubscribe anytime.</span>
      </label>
      {state?.error && <p className="text-xs text-danger" role="alert">{state.error}</p>}
    </form>
  );
}
