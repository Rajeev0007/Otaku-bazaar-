"use client";

import { useActionState, useTransition, useState } from "react";
import { changePasswordAction, logoutAction, resendVerificationAction, signOutOtherDevicesAction, updateProfileAction, type FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, FormSuccess, Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";

export function ProfileForm({ name, phone, marketingOptIn }: { name: string; phone: string; marketingOptIn: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfileAction, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.error} />
      <FormSuccess message={state?.ok ? state.message : null} />
      <Field label="Full name" htmlFor="name" error={fe.name}>
        <Input id="name" name="name" defaultValue={name} autoComplete="name" required maxLength={80} />
      </Field>
      <Field label="Phone" htmlFor="phone" error={fe.phone} hint="For delivery updates. Include country code if outside India.">
        <Input id="phone" name="phone" defaultValue={phone} autoComplete="tel" inputMode="tel" maxLength={20} />
      </Field>
      <Checkbox name="marketingOptIn" defaultChecked={marketingOptIn} label="Email me about new drops and offers" />
      <Button type="submit" loading={pending}>
        Save profile
      </Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePasswordAction, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" key={state?.ok ? "done" : "form"}>
      <FormError message={state?.error} />
      <FormSuccess message={state?.ok ? state.message : null} />
      <Field label="Current password" htmlFor="current">
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="New password" htmlFor="password" error={fe.password} hint="At least 8 characters, with a letter and a number.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" error={fe.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" loading={pending}>
        Change password
      </Button>
    </form>
  );
}

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button className="flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm font-medium hover:bg-surface-2">
        <Icon name="logout" size={16} /> Sign out
      </button>
    </form>
  );
}

export function ResendVerification({ email }: { email: string }) {
  const [msg, setMsg] = useState<FormState>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm">
      <p className="text-warning">
        {msg?.message ?? msg?.error ?? (
          <>
            Please confirm your email address (<strong>{email}</strong>) to secure your account.
          </>
        )}
      </p>
      {!msg?.ok && (
        <button disabled={pending} onClick={() => start(async () => setMsg(await resendVerificationAction()))} className="font-semibold text-warning underline underline-offset-4 disabled:opacity-50">
          {pending ? "Sending…" : "Resend link"}
        </button>
      )}
    </div>
  );
}

export function SignOutOthers() {
  const [msg, setMsg] = useState<FormState>(null);
  const [pending, start] = useTransition();
  if (msg?.ok) return <span className="text-sm text-success">{msg.message}</span>;
  return (
    <Button variant="outline" size="sm" loading={pending} onClick={() => start(async () => setMsg(await signOutOtherDevicesAction()))}>
      Sign out other devices
    </Button>
  );
}
