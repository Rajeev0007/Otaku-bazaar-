"use client";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

export function QuantitySelector({ value, max, min = 1, onChange, disabled, size = "md", label = "Quantity" }: { value: number; max: number; min?: number; onChange: (n: number) => void; disabled?: boolean; size?: "sm" | "md"; label?: string }) {
  const h = size === "sm" ? "h-9" : "h-13";
  const w = size === "sm" ? "w-9" : "w-12";
  return (
    <div className={cn("inline-flex items-center rounded-full border border-line-strong", h)} role="group" aria-label={label}>
      <button type="button" className={cn("grid h-full place-items-center rounded-l-full transition hover:bg-surface-2 disabled:opacity-30", w)} onClick={() => onChange(Math.max(min, value - 1))} disabled={disabled || value <= min} aria-label="Decrease quantity">
        <Icon name="minus" size={size === "sm" ? 14 : 16} />
      </button>
      <span className={cn("min-w-8 text-center font-semibold tabular-nums", size === "sm" ? "text-sm" : "text-base")} aria-live="polite">
        {value}
      </span>
      <button type="button" className={cn("grid h-full place-items-center rounded-r-full transition hover:bg-surface-2 disabled:opacity-30", w)} onClick={() => onChange(Math.min(max, value + 1))} disabled={disabled || value >= max} aria-label="Increase quantity">
        <Icon name="plus" size={size === "sm" ? 14 : 16} />
      </button>
    </div>
  );
}
