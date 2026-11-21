"use client";

import { useActionState, useState, useTransition } from "react";
import { claimOwnerAction, newSetupCodeAction, type SetupFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, FormError, FormSuccess, Input } from "@/components/ui/field";

export function OwnerForm() {
  const [state, action, pending] = useActionState<SetupFormState, FormData>(claimOwnerAction, null);
  const [codeMsg, setCodeMsg] = useState<SetupFormState>(null);
  const [codePending, start] = useTransition();
  const fe = state?.fieldErrors ?? {};
  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4" noValidate>
        <FormError message={state?.error} />
        <Field label="Owner setup code" htmlFor="code" error={fe.code} hint="Looks like ABCD-EF23">
          <Input id="code" name="code" required autoComplete="off" autoCapitalize="characters" className="font-mono uppercase tracking-widest" maxLength={12} />
        </Field>
        <Field label="Owner name" htmlFor="name" error={fe.name}>
          <Input id="name" name="name" required defaultValue={state?.values?.name ?? "Satyam Behera"} autoComplete="name" />
        </Field>
        <Field label="Owner email" htmlFor="email" error={fe.email}>
          <Input id="email" name="email" type="email" required defaultValue={state?.values?.email} autoComplete="email" />
        </Field>
        <Field label="Password" htmlFor="password" error={fe.password} hint="At least 8 characters, with a letter and a number.">
          <Input id="password" name="password" type="password" required autoComplete="new-password" />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Create owner account
        </Button>
      </form>
      <div className="border-t border-line pt-4 text-sm text-muted">
        <FormSuccess message={codeMsg?.message} />
        <FormError message={codeMsg?.error} />
        <p className="mt-2">
          Can't find the code?{" "}
          <button type="button" disabled={codePending} onClick={() => start(async () => setCodeMsg(await newSetupCodeAction()))} className="font-semibold text-accent hover:underline disabled:opacity-50">
            {codePending ? "Generating…" : "Generate a new code"}
          </button>{" "}
          (it appears in Vercel → Logs).
        </p>
      </div>
    </div>
  );
}
