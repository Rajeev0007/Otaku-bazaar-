"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAccountAction, giftCardBalanceAction, writeReviewAction, type FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, FormError, FormSuccess, Input, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export function GiftCardBalance() {
  const [state, action, pending] = useActionState(giftCardBalanceAction, null);
  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <Input name="code" placeholder="OBGC-XXXX-XXXX-XXXX" aria-label="Gift card code" className="font-mono uppercase" required />
        <Button type="submit" variant="outline" loading={pending}>Check</Button>
      </div>
      <FormError message={state?.error} />
      <FormSuccess message={state?.message} />
    </form>
  );
}

export function DeleteAccount({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(deleteAccountAction, null);
  if (!open) return <button onClick={() => setOpen(true)} className="text-sm text-danger underline-offset-4 hover:underline">Delete my account…</button>;
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-danger/30 p-4">
      <p className="text-sm">This permanently removes your profile, addresses, wishlist and cart and signs you out everywhere. Past orders are kept anonymously for tax records. This can't be undone.</p>
      <FormError message={state?.error} />
      {hasPassword && <Field label="Your password" htmlFor="del-pw"><Input id="del-pw" name="password" type="password" autoComplete="current-password" required /></Field>}
      <Field label="Type DELETE to confirm" htmlFor="del-confirm"><Input id="del-confirm" name="confirm" autoComplete="off" required /></Field>
      <div className="flex gap-2">
        <Button type="submit" variant="danger" loading={pending}>Delete account</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

export function ReviewForm({ orderItemId, number, name }: { orderItemId: string; number: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  if (done) return <span className="text-xs text-success">✓ Review sent</span>;
  if (!open) return <button onClick={() => setOpen(true)} className="rounded-full border border-line px-3 py-1 text-xs font-medium hover:border-fg">★ Write a review</button>;
  return (
    <div className="mt-2 w-full space-y-2 rounded-2xl border border-line p-3">
      <p className="text-xs text-muted">Reviewing {name}</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)} className={cn("text-2xl leading-none", n <= rating ? "text-gold" : "text-surface-3")}>★</button>
        ))}
      </div>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Headline (optional)" aria-label="Review title" maxLength={120} />
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="How's the quality, fit, print?" aria-label="Review" maxLength={3000} />
      <FormError message={error} />
      <div className="flex gap-2">
        <Button size="sm" loading={pending} disabled={!rating} onClick={() => start(async () => {
          const r = await writeReviewAction(orderItemId, number, { rating, title, body });
          if (!r.ok) return setError(r.error);
          toast({ title: r.message });
          setDone(true);
          router.refresh();
        })}>Submit review</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

export function PrivacyLinks() {
  return (
    <a href="/api/account/export" className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm hover:bg-surface-2">
      <Icon name="upload" size={15} className="rotate-180" /> Download my data
    </a>
  );
}
