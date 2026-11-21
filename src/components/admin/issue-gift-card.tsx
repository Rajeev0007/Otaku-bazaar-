"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { issueGiftCardAction } from "@/app/admin/actions";

export function IssueGiftCard() {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const toast = useToast();
  const router = useRouter();
  return (
    <form
      ref={form}
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(e.currentTarget));
        setError(null);
        start(async () => {
          const r = await issueGiftCardAction(d);
          if (!r.ok) return setError(r.error);
          toast({ title: r.message ?? "Created" });
          setCode(r.data?.code ?? null);
          form.current?.reset();
          router.refresh();
        });
      }}
    >
      <FormError message={error} />
      {code && (
        <div className="rounded-xl border border-success/30 bg-success/10 p-3 text-center">
          <p className="text-xs text-muted">Gift card code (shown once)</p>
          <p className="mt-1 select-all font-mono text-lg font-bold tracking-wider">{code}</p>
          <button type="button" onClick={() => navigator.clipboard.writeText(code)} className="mt-1 text-xs underline">Copy</button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {[500, 1000, 2000, 5000].map((v) => (
          <button key={v} type="button" onClick={() => { const i = form.current?.elements.namedItem("amount") as HTMLInputElement | null; if (i) i.value = String(v); }} className="rounded-full border border-line px-3 py-1 text-xs hover:border-fg">₹{v}</button>
        ))}
      </div>
      <Field label="Value (₹)" htmlFor="amount"><Input id="amount" name="amount" type="number" inputMode="numeric" min={1} required /></Field>
      <Field label="Recipient email (optional)" htmlFor="recipientEmail"><Input id="recipientEmail" name="recipientEmail" type="email" /></Field>
      <Field label="From (optional)" htmlFor="senderName"><Input id="senderName" name="senderName" placeholder="Satyam" /></Field>
      <Field label="Message (optional)" htmlFor="message"><Input id="message" name="message" maxLength={300} /></Field>
      <Field label="Expires (optional)" htmlFor="expiresAt" hint="Check local rules before setting an expiry."><Input id="expiresAt" name="expiresAt" type="date" /></Field>
      <Button type="submit" loading={pending} className="w-full">Create gift card</Button>
    </form>
  );
}
