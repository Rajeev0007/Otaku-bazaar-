"use client";

import { useActionState } from "react";
import { createTicketAction, customerReplyAction, type SupportState } from "@/app/actions/support";
import { Button } from "@/components/ui/button";
import { Field, FormError, FormSuccess, Input, Select, Textarea } from "@/components/ui/field";

export function SupportForm({ categories, name, email, orderNumber }: { categories: Record<string, string>; name?: string | null; email?: string | null; orderNumber?: string }) {
  const [state, action, pending] = useActionState<SupportState, FormData>(createTicketAction, null);
  const fe = state?.fieldErrors ?? {};
  if (state?.ok) return <FormSuccess message={state.message} />;
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2"><FormError message={state?.error} /></div>
      <Field label="Your name" htmlFor="s-name" error={fe.name}><Input id="s-name" name="name" defaultValue={name ?? ""} autoComplete="name" required /></Field>
      <Field label="Email" htmlFor="s-email" error={fe.email}><Input id="s-email" name="email" type="email" defaultValue={email ?? ""} autoComplete="email" required /></Field>
      <Field label="Topic" htmlFor="s-cat" error={fe.category}>
        <Select id="s-cat" name="category" defaultValue={orderNumber ? "order" : "other"}>
          {Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <Field label="Order number (optional)" htmlFor="s-order" hint="Helps us find your order faster"><Input id="s-order" name="orderNumber" defaultValue={orderNumber} placeholder="OB261121-AB2CD" className="uppercase" /></Field>
      <Field label="Subject" htmlFor="s-subject" error={fe.subject} className="sm:col-span-2"><Input id="s-subject" name="subject" maxLength={140} required /></Field>
      <Field label="Message" htmlFor="s-msg" error={fe.message} className="sm:col-span-2"><Textarea id="s-msg" name="message" rows={5} maxLength={5000} required /></Field>
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="sm:col-span-2"><Button type="submit" size="lg" loading={pending}>Send message</Button></div>
    </form>
  );
}

export function TicketReply({ number }: { number: string }) {
  const [state, action, pending] = useActionState<SupportState, FormData>(customerReplyAction.bind(null, number), null);
  return (
    <form action={action} className="space-y-2" key={state?.ok ? Date.now() : "f"}>
      <FormError message={state?.error} />
      <Textarea name="body" rows={3} placeholder="Write a reply…" aria-label="Reply" required />
      <Button type="submit" loading={pending}>Send reply</Button>
    </form>
  );
}
