import type { ReactNode } from "react";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="container-page flex justify-center py-10 sm:py-16">
      <div className="w-full max-w-md">
        <div className="rounded-[1.5rem] border border-line bg-surface p-6 shadow-soft sm:p-8">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6 space-y-5">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
      </div>
    </div>
  );
}
