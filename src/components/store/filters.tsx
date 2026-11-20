"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Facets } from "@/server/catalog/queries";
import { activeFilterCount, filtersToSearchParams, parseFilters, PRODUCT_TYPES, SORTS, type ListingFilters, type SortKey } from "@/lib/catalog-filters";
import { formatMoney, toMajor } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

type Hide = ("categories" | "anime")[];

function useFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const filters = useMemo(() => parseFilters(new URLSearchParams(params.toString())), [params]);
  const density = params.get("density");
  // Rapid clicks: build on the latest requested filters, not the URL that hasn't updated yet.
  const latest = useRef(filters);
  useEffect(() => {
    latest.current = filters;
  }, [filters]);

  function apply(patch: Partial<ListingFilters>, opts: { keepPage?: boolean } = {}) {
    const base = latest.current;
    const next = { ...base, ...patch, page: opts.keepPage ? (patch.page ?? base.page) : 1 };
    latest.current = next;
    const qs = filtersToSearchParams(next);
    if (density) qs.set("density", density);
    start(() => router.push(qs.size ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }
  function setDensity(d: "dense" | null) {
    const qs = new URLSearchParams(params.toString());
    if (d) qs.set("density", d);
    else qs.delete("density");
    start(() => router.replace(qs.size ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }
  return { filters, apply, pending, pathname, density, setDensity, router };
}

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function FilterPanel({ facets, currency, hide = [], onDone }: { facets: Facets; currency: string; hide?: Hide; onDone?: () => void }) {
  const { filters, apply, pending } = useFilters();
  return (
    <div className={cn("space-y-1 transition-opacity", pending && "opacity-60")}>
      <Group title="Availability" defaultOpen>
        <Check label="In stock only" checked={filters.inStock} onChange={() => apply({ inStock: !filters.inStock })} />
        <Check label="On sale" checked={filters.sale} onChange={() => apply({ sale: !filters.sale })} />
        <Check label="New arrivals" checked={filters.isNew} onChange={() => apply({ isNew: !filters.isNew })} />
        <Check label="Limited edition" checked={filters.limited} onChange={() => apply({ limited: !filters.limited })} />
      </Group>
      {!hide.includes("categories") && facets.categories.length > 1 && (
        <Group title="Category" defaultOpen>
          {facets.categories.map((c) => (
            <Check key={c.value} label={c.label} count={c.count} checked={filters.categories.includes(c.value)} onChange={() => apply({ categories: toggle(filters.categories, c.value) })} />
          ))}
        </Group>
      )}
      {!hide.includes("anime") && facets.anime.length > 1 && (
        <Group title="Anime" defaultOpen>
          {facets.anime.map((a) => (
            <Check key={a.value} label={a.label} count={a.count} checked={filters.anime.includes(a.value)} onChange={() => apply({ anime: toggle(filters.anime, a.value) })} />
          ))}
        </Group>
      )}
      <Group title="Price" defaultOpen>
        <PriceRange min={facets.priceMin} max={facets.priceMax} currency={currency} value={[filters.minPrice, filters.maxPrice]} onChange={(minPrice, maxPrice) => apply({ minPrice, maxPrice })} />
      </Group>
      {facets.sizes.length > 0 && (
        <Group title="Size">
          <div className="flex flex-wrap gap-2 pt-1">
            {facets.sizes.map((s) => (
              <button key={s} onClick={() => apply({ sizes: toggle(filters.sizes, s) })} aria-pressed={filters.sizes.includes(s)} className={cn("h-9 min-w-11 rounded-full border px-3 text-xs font-medium transition", filters.sizes.includes(s) ? "border-fg bg-fg text-bg" : "border-line hover:border-fg")}>
                {s}
              </button>
            ))}
          </div>
        </Group>
      )}
      {facets.colors.length > 0 && (
        <Group title="Colour">
          <div className="flex flex-wrap gap-2 pt-1">
            {facets.colors.map((c) => (
              <button key={c.name} onClick={() => apply({ colors: toggle(filters.colors, c.name) })} aria-pressed={filters.colors.includes(c.name)} className={cn("flex h-9 items-center gap-2 rounded-full border px-3 text-xs transition", filters.colors.includes(c.name) ? "border-fg bg-surface-2" : "border-line hover:border-fg")}>
                <span className="h-3.5 w-3.5 rounded-full border border-line-strong" style={{ background: c.hex ?? "#888" }} />
                {c.name}
              </button>
            ))}
          </div>
        </Group>
      )}
      <Group title="Customer rating">
        {[4, 3].map((r) => (
          <Radio key={r} name="rating" label={`${r}★ & up`} checked={filters.rating === r} onChange={() => apply({ rating: filters.rating === r ? undefined : r })} />
        ))}
      </Group>
      <Group title="Discount">
        {[10, 20, 30].map((d) => (
          <Radio key={d} name="discount" label={`${d}% off or more`} checked={filters.discount === d} onChange={() => apply({ discount: filters.discount === d ? undefined : d })} />
        ))}
      </Group>
      {facets.brands.length > 1 && (
        <Group title="Brand">
          {facets.brands.map((b) => (
            <Check key={b.value} label={b.label} count={b.count} checked={filters.brands.includes(b.value)} onChange={() => apply({ brands: toggle(filters.brands, b.value) })} />
          ))}
        </Group>
      )}
      <Group title="Product type">
        {Object.entries(PRODUCT_TYPES)
          .filter(([k]) => k !== "GIFT_CARD")
          .map(([k, label]) => (
            <Check key={k} label={label} checked={filters.types.includes(k)} onChange={() => apply({ types: toggle(filters.types, k) })} />
          ))}
      </Group>
      {onDone && <div className="h-4" />}
    </div>
  );
}

function Group({ title, children, defaultOpen }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group border-b border-line py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-sm font-semibold">
        {title}
        <Icon name="chevron-down" size={16} className="text-muted transition group-open:rotate-180" />
      </summary>
      <div className="mt-2 space-y-0.5">{children}</div>
    </details>
  );
}

function Check({ label, count, checked, onChange }: { label: string; count?: number; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg py-1.5 text-sm text-muted transition hover:text-fg">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-[var(--accent)]" />
      <span className={cn("flex-1", checked && "text-fg")}>{label}</span>
      {count !== undefined && <span className="text-xs text-subtle">{count}</span>}
    </label>
  );
}

function Radio({ name, label, checked, onChange }: { name: string; label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg py-1.5 text-sm text-muted transition hover:text-fg">
      <input type="checkbox" data-group={name} checked={checked} onChange={onChange} className="h-4 w-4 rounded-full accent-[var(--accent)]" />
      <span className={cn(checked && "text-fg")}>{label}</span>
    </label>
  );
}

function PriceRange({ min, max, currency, value, onChange }: { min: number; max: number; currency: string; value: [number | undefined, number | undefined]; onChange: (min?: number, max?: number) => void }) {
  const lo = Math.floor(toMajor(min, currency));
  const hi = Math.ceil(toMajor(max, currency));
  const [a, setA] = useState(value[0] ?? lo);
  const [b, setB] = useState(value[1] ?? hi);
  useEffect(() => {
    setA(value[0] ?? lo);
    setB(value[1] ?? hi);
  }, [value, lo, hi]);
  if (hi <= lo) return <p className="text-xs text-muted">All products are {formatMoney(min, currency)}</p>;
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const commit = () => onChange(a > lo ? a : undefined, b < hi ? b : undefined);
  const step = hi - lo > 2000 ? 50 : 10;
  return (
    <div className="pt-2">
      <div className="relative h-6">
        <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-surface-3" />
        <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent" style={{ left: `${pct(a)}%`, right: `${100 - pct(b)}%` }} />
        <input type="range" aria-label="Minimum price" min={lo} max={hi} step={step} value={a} onChange={(e) => setA(Math.min(Number(e.target.value), b - step))} onMouseUp={commit} onTouchEnd={commit} onKeyUp={commit} className="range-thumb absolute inset-0 w-full" />
        <input type="range" aria-label="Maximum price" min={lo} max={hi} step={step} value={b} onChange={(e) => setB(Math.max(Number(e.target.value), a + step))} onMouseUp={commit} onTouchEnd={commit} onKeyUp={commit} className="range-thumb absolute inset-0 w-full" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <PriceInput label="Min" value={a} onChange={setA} onCommit={commit} />
        <span className="text-subtle">–</span>
        <PriceInput label="Max" value={b} onChange={setB} onCommit={commit} />
      </div>
    </div>
  );
}

function PriceInput({ label, value, onChange, onCommit }: { label: string; value: number; onChange: (v: number) => void; onCommit: () => void }) {
  return (
    <label className="flex h-9 flex-1 items-center gap-1 rounded-lg border border-line bg-surface-2 px-2.5 text-sm">
      <span className="sr-only">{label}</span>
      <span className="text-subtle">₹</span>
      <input type="number" inputMode="numeric" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} onBlur={onCommit} onKeyDown={(e) => e.key === "Enter" && onCommit()} className="w-full bg-transparent outline-none" />
    </label>
  );
}

export function ListingToolbar({ total, from, to, facets, currency, hide }: { total: number; from: number; to: number; facets: Facets; currency: string; hide?: Hide }) {
  const { filters, apply, density, setDensity, pending } = useFilters();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [q, setQ] = useState(filters.q ?? "");
  const count = activeFilterCount(filters);

  useEffect(() => setQ(filters.q ?? ""), [filters.q]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
        <button onClick={() => setMobileOpen(true)} className="flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm font-medium lg:hidden">
          <Icon name="filter" size={16} /> Filters {count > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[0.65rem] font-bold text-accent-fg">{count}</span>}
        </button>
        <p className="hidden text-sm text-muted sm:block" aria-live="polite">
          {pending ? "Updating…" : total ? `Showing ${from}–${to} of ${total.toLocaleString("en-IN")} products` : "0 products"}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            apply({ q: q.trim() || undefined });
          }}
          className="order-last flex h-10 w-full items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5 sm:order-none sm:ml-auto sm:w-56"
        >
          <Icon name="search" size={15} className="text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search within results" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle" aria-label="Search within results" />
        </form>
        <label className="ml-auto flex h-10 items-center gap-2 rounded-full border border-line px-3.5 text-sm sm:ml-0">
          <span className="hidden text-muted md:inline">Sort</span>
          <select value={filters.sort} onChange={(e) => apply({ sort: e.target.value as SortKey })} className="bg-transparent font-medium outline-none" aria-label="Sort products">
            {Object.entries(SORTS).map(([k, label]) => (
              <option key={k} value={k} className="bg-surface">
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex h-10 items-center rounded-full border border-line p-1" role="group" aria-label="Layout">
          <button onClick={() => (apply({ view: "grid" }, { keepPage: true }), setDensity(null))} aria-pressed={filters.view === "grid" && !density} className={cn("grid h-8 w-8 place-items-center rounded-full transition", filters.view === "grid" && !density ? "bg-fg text-bg" : "text-muted hover:text-fg")} aria-label="Grid view">
            <Icon name="grid" size={15} />
          </button>
          <button onClick={() => (apply({ view: "grid" }, { keepPage: true }), setDensity("dense"))} aria-pressed={density === "dense"} className={cn("hidden h-8 w-8 place-items-center rounded-full transition md:grid", density === "dense" ? "bg-fg text-bg" : "text-muted hover:text-fg")} aria-label="Compact grid">
            <span className="grid grid-cols-3 gap-[2px]">{Array.from({ length: 9 }, (_, i) => <span key={i} className="h-[3px] w-[3px] rounded-[1px] bg-current" />)}</span>
          </button>
          <button onClick={() => apply({ view: "list" }, { keepPage: true })} aria-pressed={filters.view === "list"} className={cn("grid h-8 w-8 place-items-center rounded-full transition", filters.view === "list" ? "bg-fg text-bg" : "text-muted hover:text-fg")} aria-label="List view">
            <Icon name="list" size={15} />
          </button>
        </div>
      </div>

      <div className={cn("fixed inset-0 z-[70] lg:hidden", mobileOpen ? "visible" : "invisible")} aria-hidden={!mobileOpen}>
        <div className={cn("absolute inset-0 bg-black/60 transition-opacity", mobileOpen ? "opacity-100" : "opacity-0")} onClick={() => setMobileOpen(false)} />
        <div role="dialog" aria-modal="true" aria-label="Filters" className={cn("absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-3xl bg-bg transition-transform duration-300 ease-[var(--ease-out-expo)]", mobileOpen ? "translate-y-0" : "translate-y-full")}>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <p className="text-lg font-semibold">Filters</p>
            <button onClick={() => setMobileOpen(false)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2" aria-label="Close filters">
              <Icon name="x" size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5">
            <FilterPanel facets={facets} currency={currency} hide={hide} onDone={() => setMobileOpen(false)} />
          </div>
          <div className="flex gap-3 border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button onClick={() => apply({ categories: [], anime: [], sizes: [], colors: [], brands: [], types: [], minPrice: undefined, maxPrice: undefined, rating: undefined, discount: undefined, inStock: false, sale: false, isNew: false, limited: false })} className="h-12 flex-1 rounded-full border border-line-strong text-sm font-semibold">
              Clear all
            </button>
            <button onClick={() => setMobileOpen(false)} className="h-12 flex-[2] rounded-full bg-accent text-sm font-semibold text-accent-fg">
              {pending ? "Updating…" : `Show ${total} results`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export function ActiveFilters({ facets }: { facets: Facets }) {
  const { filters, apply } = useFilters();
  const chips: { label: string; clear: () => void }[] = [];
  const name = (list: { value: string; label: string }[], v: string) => list.find((x) => x.value === v)?.label ?? v;
  if (filters.q) chips.push({ label: `“${filters.q}”`, clear: () => apply({ q: undefined }) });
  filters.categories.forEach((c) => chips.push({ label: name(facets.categories, c), clear: () => apply({ categories: filters.categories.filter((x) => x !== c) }) }));
  filters.anime.forEach((c) => chips.push({ label: name(facets.anime, c), clear: () => apply({ anime: filters.anime.filter((x) => x !== c) }) }));
  filters.brands.forEach((c) => chips.push({ label: name(facets.brands, c), clear: () => apply({ brands: filters.brands.filter((x) => x !== c) }) }));
  filters.sizes.forEach((c) => chips.push({ label: `Size ${c}`, clear: () => apply({ sizes: filters.sizes.filter((x) => x !== c) }) }));
  filters.colors.forEach((c) => chips.push({ label: c, clear: () => apply({ colors: filters.colors.filter((x) => x !== c) }) }));
  filters.types.forEach((c) => chips.push({ label: PRODUCT_TYPES[c as keyof typeof PRODUCT_TYPES] ?? c, clear: () => apply({ types: filters.types.filter((x) => x !== c) }) }));
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) chips.push({ label: `₹${filters.minPrice ?? 0} – ${filters.maxPrice !== undefined ? `₹${filters.maxPrice}` : "max"}`, clear: () => apply({ minPrice: undefined, maxPrice: undefined }) });
  if (filters.rating) chips.push({ label: `${filters.rating}★ & up`, clear: () => apply({ rating: undefined }) });
  if (filters.discount) chips.push({ label: `${filters.discount}%+ off`, clear: () => apply({ discount: undefined }) });
  if (filters.inStock) chips.push({ label: "In stock", clear: () => apply({ inStock: false }) });
  if (filters.sale) chips.push({ label: "On sale", clear: () => apply({ sale: false }) });
  if (filters.isNew) chips.push({ label: "New", clear: () => apply({ isNew: false }) });
  if (filters.limited) chips.push({ label: "Limited", clear: () => apply({ limited: false }) });
  if (!chips.length) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button key={c.label} onClick={c.clear} className="flex h-8 items-center gap-1.5 rounded-full bg-surface-2 pl-3 pr-2 text-xs font-medium transition hover:bg-surface-3" aria-label={`Remove filter ${c.label}`}>
          {c.label} <Icon name="x" size={13} />
        </button>
      ))}
      <button
        onClick={() => apply({ q: undefined, categories: [], anime: [], sizes: [], colors: [], brands: [], types: [], minPrice: undefined, maxPrice: undefined, rating: undefined, discount: undefined, inStock: false, sale: false, isNew: false, limited: false })}
        className="ml-1 text-xs font-semibold text-accent hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}
