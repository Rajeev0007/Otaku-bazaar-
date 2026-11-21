"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { trackOrderAction } from "@/app/actions/checkout";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";

export function TrackForm({ initialNumber }: { initialNumber: string }) {
  const [state, action, pending] = useActionState(trackOrderAction, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.number) router.push(`/order/${state.number}`);
  }, [state, router]);
  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.error} />
      <Field label="Order number" htmlFor="number" hint="Looks like OB261121-AB2CD">
        <Input id="number" name="number" defaultValue={initialNumber} required className="uppercase" />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </Field>
      <Button type="submit" className="w-full" size="lg" loading={pending}>Track order</Button>
    </form>
  );
}
