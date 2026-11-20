"use client";

import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { askQuestionAction } from "@/app/actions/product";

export function ShareButton({ title, url }: { title: string; url: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={async () => {
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
          } catch {
            /* dismissed */
          }
          return;
        }
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied", description: "Share it with a fellow fan." });
      }}
      className="flex items-center gap-1.5 text-sm text-muted transition hover:text-fg"
    >
      <Icon name="share" size={16} /> Share
    </button>
  );
}

export function AskQuestion({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const toast = useToast();
  const pathname = usePathname();
  if (done) return <p className="rounded-2xl bg-success/10 p-4 text-sm text-success">{done}</p>;
  if (!open)
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Ask a question
      </Button>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await askQuestionAction(productId, text);
          if (r.ok) setDone(r.message);
          else if (r.needsLogin) toast({ tone: "info", title: r.error, action: { label: "Sign in", href: `/login?next=${encodeURIComponent(pathname)}` } });
          else toast({ tone: "error", title: r.error });
        });
      }}
      className="space-y-3"
    >
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={500} required placeholder="e.g. Is the print on the back as well?" className="w-full rounded-2xl border border-line bg-surface-2 p-3.5 text-sm outline-none focus:border-accent" aria-label="Your question" />
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>Submit question</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
