import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { discountPercent, formatMoney } from "@/lib/money";
import { Icon, type IconName } from "@/components/ui/icon";

export function Price({ amount, compareAt, currency, from, size = "md", className }: { amount: number; compareAt?: number | null; currency: string; from?: boolean; size?: "sm" | "md" | "lg"; className?: string }) {
  const pct = discountPercent(amount, compareAt);
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span className={cn("font-semibold tabular-nums text-fg", size === "lg" ? "text-3xl" : size === "sm" ? "text-sm" : "text-base")}>
        {from && <span className="mr-1 text-xs font-normal text-muted">from</span>}
        {formatMoney(amount, currency)}
      </span>
      {pct > 0 && (
        <>
          <span className={cn("tabular-nums text-subtle line-through", size === "lg" ? "text-lg" : "text-xs")}>
            <span className="sr-only">Original price </span>
            {formatMoney(compareAt!, currency)}
          </span>
          <span className={cn("font-semibold text-success", size === "lg" ? "text-base" : "text-xs")}>{pct}% off</span>
        </>
      )}
    </div>
  );
}

export function Rating({ value, count, size = 14, showValue = false, className }: { value: number; count?: number; size?: number; showValue?: boolean; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="relative inline-flex" role="img" aria-label={`Rated ${value.toFixed(1)} out of 5`}>
        <div className="flex text-surface-3">
          {Array.from({ length: 5 }, (_, i) => <Icon key={i} name="star" size={size} filled strokeWidth={0} />)}
        </div>
        <div className="absolute inset-0 flex overflow-hidden text-gold" style={{ width: `${pct}%` }}>
          {Array.from({ length: 5 }, (_, i) => <Icon key={i} name="star" size={size} filled strokeWidth={0} className="shrink-0" />)}
        </div>
      </div>
      {showValue && <span className="text-xs font-semibold text-fg">{value.toFixed(1)}</span>}
      {count !== undefined && <span className="text-xs text-muted">({count.toLocaleString("en-IN")})</span>}
    </div>
  );
}

const badgeTones = {
  accent: "bg-accent text-accent-fg",
  soft: "bg-accent-soft text-accent",
  neutral: "bg-surface-3 text-fg",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
  gold: "bg-gold/15 text-gold",
  glass: "glass text-fg border border-line",
};

export function Badge({ tone = "neutral", children, className }: { tone?: keyof typeof badgeTones; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-wider", badgeTones[tone], className)}>{children}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} aria-hidden />;
}

export function EmptyState({ icon = "package", title, description, action, className }: { icon?: IconName; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line px-6 py-16 text-center", className)}>
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-surface-2 text-muted">
        <Icon name={icon} size={28} />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-2 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("text-xs text-muted", className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <Icon name="chevron-right" size={12} className="text-subtle" />}
            {c.href && i < items.length - 1 ? (
              <Link href={c.href} className="transition hover:text-fg">
                {c.label}
              </Link>
            ) : (
              <span aria-current={i === items.length - 1 ? "page" : undefined} className={i === items.length - 1 ? "text-fg" : ""}>
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Pagination({ page, pageCount, hrefFor }: { page: number; pageCount: number; hrefFor: (p: number) => string }) {
  if (pageCount <= 1) return null;
  const pages = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount));
  const sorted = [...pages].sort((a, b) => a - b);
  const cls = "grid h-10 min-w-10 place-items-center rounded-full px-3 text-sm transition";
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={cn(cls, "hover:bg-surface-2")} aria-label="Previous page" rel="prev">
          <Icon name="chevron-left" size={16} />
        </Link>
      ) : null}
      {sorted.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - sorted[i - 1]! > 1 && <span className="px-1 text-subtle">…</span>}
          <Link href={hrefFor(p)} aria-current={p === page ? "page" : undefined} className={cn(cls, p === page ? "bg-fg font-semibold text-bg" : "hover:bg-surface-2")}>
            {p}
          </Link>
        </span>
      ))}
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className={cn(cls, "hover:bg-surface-2")} aria-label="Next page" rel="next">
          <Icon name="chevron-right" size={16} />
        </Link>
      ) : null}
    </nav>
  );
}

export function SectionHeading({ eyebrow, title, subtitle, href, linkLabel = "View all" }: { eyebrow?: string; title: string; subtitle?: string | null; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h2 className="section-title text-2xl font-semibold sm:text-[1.75rem]">{title}</h2>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="group hidden shrink-0 items-center gap-1 text-sm font-medium text-muted transition hover:text-fg sm:flex">
          {linkLabel}
          <Icon name="arrow-right" size={16} className="transition group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

export function StockLabel({ available, threshold = 5 }: { available: number; threshold?: number }) {
  if (available <= 0) return <span className="text-sm font-medium text-danger">Out of stock</span>;
  if (available <= threshold) return <span className="text-sm font-medium text-warning">Only {available} left</span>;
  return <span className="flex items-center gap-1.5 text-sm font-medium text-success"><span className="h-1.5 w-1.5 rounded-full bg-success" />In stock</span>;
}
