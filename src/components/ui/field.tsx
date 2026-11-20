import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const inputClass =
  "w-full h-11 rounded-xl border border-line bg-surface-2 px-3.5 text-[0.95rem] text-fg placeholder:text-subtle outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft aria-[invalid=true]:border-danger";

export function Field({ label, error, hint, htmlFor, children, className }: { label: string; error?: string; hint?: string; htmlFor: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-fg">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, invalid, ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={cn(inputClass, className)} aria-invalid={invalid || undefined} aria-describedby={invalid && props.id ? `${props.id}-error` : undefined} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, "h-auto min-h-24 py-3", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputClass, "appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239b9ba8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ label, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-sm text-muted", className)}>
      <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-[var(--accent)]" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
      {message}
    </div>
  );
}

export function FormSuccess({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="status" className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
      {message}
    </div>
  );
}
