"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import type { AdminResult } from "@/app/admin/actions";

/**
 * Generic admin form: collects named inputs (checkboxes become booleans) and calls a server action.
 * The server action re-validates everything; this only handles UX.
 */
export function SimpleForm({ action, children, submitLabel = "Save", className, extra, onDone, resetOnSuccess }: { action: (data: Record<string, unknown>) => Promise<AdminResult<unknown>>; children: ReactNode; submitLabel?: string; className?: string; extra?: Record<string, unknown>; onDone?: () => void; resetOnSuccess?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();
  return (
    <form
      className={className ?? "space-y-4"}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data: Record<string, unknown> = { ...extra };
        for (const el of Array.from(form.elements) as HTMLInputElement[]) {
          if (!el.name) continue;
          if (el.type === "checkbox") data[el.name] = el.checked;
          else data[el.name] = el.value;
        }
        setError(null);
        start(async () => {
          const r = await action(data);
          if (!r.ok) {
            const fe = r.fieldErrors ? Object.entries(r.fieldErrors).map(([k, v]) => `${k}: ${v}`).join(" · ") : "";
            setError(fe ? `${r.error} ${fe}` : r.error);
            return;
          }
          toast({ title: r.message ?? "Saved" });
          if (resetOnSuccess) form.reset();
          onDone?.();
          router.refresh();
        });
      }}
    >
      <FormError message={error} />
      {children}
      <Button type="submit" loading={pending} size="sm">
        {submitLabel}
      </Button>
    </form>
  );
}

export function ConfirmButton({ action, label, confirmText, className }: { action: () => Promise<AdminResult<unknown>>; label: string; confirmText: string; className?: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      className={className ?? "text-xs text-danger hover:underline disabled:opacity-50"}
      onClick={() => {
        if (!confirm(confirmText)) return;
        start(async () => {
          const r = await action();
          toast(r.ok ? { title: r.message ?? "Done" } : { tone: "error", title: r.error });
          router.refresh();
        });
      }}
    >
      {label}
    </button>
  );
}

export function ActionButton({ action, children, className, title }: { action: () => Promise<AdminResult<unknown>>; children: ReactNode; className?: string; title?: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <button
      type="button"
      title={title}
      disabled={pending}
      className={className}
      onClick={() =>
        start(async () => {
          const r = await action();
          if (!r.ok) toast({ tone: "error", title: r.error });
          router.refresh();
        })
      }
    >
      {children}
    </button>
  );
}
