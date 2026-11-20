"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { forgotPasswordAction, loginAction, registerAction, resetPasswordAction, type FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, FormSuccess, Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";

function PasswordInput({ id, name, autoComplete, invalid }: { id: string; name: string; autoComplete: string; invalid?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} name={name} type={show ? "text" : "password"} autoComplete={autoComplete} required invalid={invalid} className="pr-12" maxLength={128} />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-fg" aria-label={show ? "Hide password" : "Show password"}>
        <Icon name="eye" size={17} />
      </button>
    </div>
  );
}

export function GoogleButton({ next, enabled }: { next: string; enabled: boolean }) {
  if (!enabled) return null;
  return (
    <>
      <a href={`/api/auth/google?next=${encodeURIComponent(next)}`} className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-line-strong text-sm font-semibold transition hover:bg-surface-2">
        <Icon name="google" size={18} /> Continue with Google
      </a>
      <div className="flex items-center gap-3 text-xs text-subtle">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormError message={state?.error} />
      <Field label="Email" htmlFor="email" error={fe.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required invalid={!!fe.email} inputMode="email" defaultValue={state?.values?.email} />
      </Field>
      <Field label="Password" htmlFor="password" error={fe.password}>
        <PasswordInput id="password" name="password" autoComplete="current-password" invalid={!!fe.password} />
      </Field>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm text-muted hover:text-fg">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Sign in
      </Button>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(registerAction, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormError message={state?.error} />
      <Field label="Full name" htmlFor="name" error={fe.name}>
        <Input id="name" name="name" autoComplete="name" required invalid={!!fe.name} maxLength={80} defaultValue={state?.values?.name} />
      </Field>
      <Field label="Email" htmlFor="email" error={fe.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required invalid={!!fe.email} inputMode="email" defaultValue={state?.values?.email} />
      </Field>
      <Field label="Password" htmlFor="password" error={fe.password} hint="At least 8 characters, with a letter and a number.">
        <PasswordInput id="password" name="password" autoComplete="new-password" invalid={!!fe.password} />
      </Field>
      <Checkbox name="marketingOptIn" label="Email me about new drops and member offers (optional)" />
      <Checkbox
        name="terms"
        required
        label={
          <>
            I agree to the{" "}
            <Link href="/pages/terms" className="text-fg underline underline-offset-2">Terms</Link> and{" "}
            <Link href="/pages/privacy-policy" className="text-fg underline underline-offset-2">Privacy Policy</Link>
          </>
        }
      />
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Create account
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(forgotPasswordAction, null);
  if (state?.ok) return <FormSuccess message={state.message} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state?.error} />
      <Field label="Email" htmlFor="email" error={state?.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required inputMode="email" />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPasswordAction, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <FormError message={state?.error} />
      <Field label="New password" htmlFor="password" error={fe.password} hint="At least 8 characters, with a letter and a number.">
        <PasswordInput id="password" name="password" autoComplete="new-password" invalid={!!fe.password} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" error={fe.confirm}>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" invalid={!!fe.confirm} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Set new password
      </Button>
    </form>
  );
}
