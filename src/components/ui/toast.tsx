"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

type Toast = { id: number; title: string; description?: string; tone: "success" | "error" | "info"; action?: { label: string; href: string } };
type ToastInput = Omit<Toast, "id" | "tone"> & { tone?: Toast["tone"] };

const ToastContext = createContext<{ toast: (t: ToastInput) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((t: ToastInput) => {
    const id = Date.now() + Math.random();
    setToasts((all) => [...all.slice(-2), { id, tone: "success", ...t }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), 4500);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6">
        {toasts.map((t) => (
          <div key={t.id} className="glass pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3 rounded-2xl border border-line p-4 shadow-soft" role={t.tone === "error" ? "alert" : "status"}>
            <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full", t.tone === "error" ? "bg-danger/20 text-danger" : t.tone === "info" ? "bg-surface-3 text-fg" : "bg-success/20 text-success")}>
              <Icon name={t.tone === "error" ? "alert" : t.tone === "info" ? "info" : "check"} size={14} strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t.title}</p>
              {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
            </div>
            {t.action && (
              <Link href={t.action.href} className="shrink-0 text-sm font-semibold text-accent hover:underline">
                {t.action.label}
              </Link>
            )}
            <button onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))} className="shrink-0 text-muted hover:text-fg" aria-label="Dismiss">
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx.toast;
}
