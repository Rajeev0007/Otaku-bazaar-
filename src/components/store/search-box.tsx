"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { useShopper } from "@/components/store/shopper-context";
import { ProductImage } from "@/components/store/product-image";
import { addToCartAction } from "@/app/actions/cart";

type SuggestProduct = { id: string; slug: string; name: string; image: string | null; price: number; compareAt: number | null; currency: string; rating: number; ratingCount: number; inStock: boolean; franchise: string | null; singleVariantId: string | null };
type SuggestResponse = { products: SuggestProduct[]; categories: { slug: string; name: string }[]; anime: { slug: string; name: string }[]; didYouMean: string | null; trending: string[] };

const RECENT_KEY = "ob-recent-searches";

export function readRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]").slice(0, 8);
  } catch {
    return [];
  }
}

export function pushRecentSearch(q: string) {
  const v = q.trim();
  if (!v) return;
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([v, ...readRecentSearches().filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 8)));
  } catch {}
}

export function SearchBox() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [data, setData] = useState<SuggestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => {
    if (!open) return;
    setRecent(readRecentSearches());
    document.body.style.overflow = "hidden";
    setTimeout(() => inputRef.current?.focus(), 20);
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (res.ok) setData(await res.json());
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, q ? 140 : 0);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  function submit(value = q) {
    const v = value.trim();
    if (!v) return;
    pushRecentSearch(v);
    close();
    router.push(`/search?q=${encodeURIComponent(v)}`);
  }

  const hasQuery = q.trim().length > 0;

  return (
    <>
      <button onClick={() => setOpen(true)} className="hidden h-10 w-64 items-center gap-2.5 rounded-full border border-line bg-surface-2 px-4 text-sm text-subtle transition hover:border-line-strong xl:flex" aria-label="Search">
        <Icon name="search" size={17} />
        <span className="flex-1 text-left">Search anime, merch, SKU…</span>
        <kbd className="rounded border border-line px-1.5 text-[0.65rem]">⌘K</kbd>
      </button>
      <button onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2 xl:hidden" aria-label="Search">
        <Icon name="search" size={21} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Search">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
          <div className="relative mx-auto flex h-full w-full max-w-3xl flex-col bg-bg sm:mt-[8vh] sm:h-auto sm:max-h-[80vh] sm:rounded-3xl sm:border sm:border-line sm:shadow-soft">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5"
            >
              <Icon name="search" size={20} className="shrink-0 text-muted" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search for Naruto hoodies, phone cases, OB-JJK…"
                className="h-12 flex-1 bg-transparent text-base outline-none placeholder:text-subtle"
                enterKeyHint="search"
                autoComplete="off"
                spellCheck={false}
                aria-label="Search products"
              />
              {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-r-transparent" aria-hidden />}
              <button type="button" onClick={close} className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-fg">
                Cancel
              </button>
            </form>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              {!hasQuery && (
                <div className="space-y-6">
                  {recent.length > 0 && (
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="eyebrow">Recent searches</p>
                        <button
                          onClick={() => {
                            localStorage.removeItem(RECENT_KEY);
                            setRecent([]);
                          }}
                          className="text-xs text-muted hover:text-fg"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {recent.map((r) => (
                          <button key={r} onClick={() => submit(r)} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-muted hover:border-fg hover:text-fg">
                            <Icon name="history" size={14} /> {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {data?.trending.length ? (
                    <div>
                      <p className="eyebrow mb-2">Trending searches</p>
                      <div className="flex flex-wrap gap-2">
                        {data.trending.map((t) => (
                          <button key={t} onClick={() => submit(t)} className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-sm hover:bg-surface-3">
                            <Icon name="zap" size={14} className="text-accent" /> {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {data?.products.length ? <ProductResults products={data.products} title="Popular right now" onNavigate={close} /> : null}
                </div>
              )}

              {hasQuery && data && (
                <div className="space-y-6">
                  {data.didYouMean && (
                    <p className="text-sm text-muted">
                      Did you mean{" "}
                      <button onClick={() => setQ(data.didYouMean!)} className="font-semibold text-accent hover:underline">
                        {data.didYouMean}
                      </button>
                      ?
                    </p>
                  )}
                  {(data.anime.length > 0 || data.categories.length > 0) && (
                    <div className="flex flex-wrap gap-2">
                      {data.anime.map((a) => (
                        <Link key={a.slug} href={`/anime/${a.slug}`} onClick={close} className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent">
                          <Icon name="sparkles" size={14} /> {a.name}
                        </Link>
                      ))}
                      {data.categories.map((c) => (
                        <Link key={c.slug} href={`/c/${c.slug}`} onClick={close} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm hover:border-fg">
                          <Icon name="layers" size={14} /> {c.name}
                        </Link>
                      ))}
                    </div>
                  )}
                  {data.products.length > 0 ? (
                    <ProductResults products={data.products} title="Products" onNavigate={close} />
                  ) : (
                    <div className="py-10 text-center">
                      <p className="font-medium">No matches for “{q}”</p>
                      <p className="mt-1 text-sm text-muted">Try an anime name, a product type like “hoodie”, or a SKU.</p>
                    </div>
                  )}
                  {data.products.length > 0 && (
                    <button onClick={() => submit()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-line py-3 text-sm font-medium hover:bg-surface-2">
                      See all results for “{q}” <Icon name="arrow-right" size={16} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ProductResults({ products, title, onNavigate }: { products: SuggestProduct[]; title: string; onNavigate: () => void }) {
  return (
    <div>
      <p className="eyebrow mb-2">{title}</p>
      <ul className="divide-y divide-line">
        {products.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <Link href={`/p/${p.slug}`} onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-3">
              <div className="relative h-16 w-13 shrink-0 overflow-hidden rounded-xl bg-surface-2">{p.image && <ProductImage src={p.image} alt="" fill sizes="52px" className="object-cover" />}</div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <div className="mt-0.5 flex items-center gap-2 text-xs">
                  <span className="font-semibold">{formatMoney(p.price, p.currency)}</span>
                  {p.compareAt && p.compareAt > p.price && <span className="text-subtle line-through">{formatMoney(p.compareAt, p.currency)}</span>}
                  {p.ratingCount > 0 && <span className="text-muted">★ {p.rating.toFixed(1)}</span>}
                  <span className={p.inStock ? "text-success" : "text-danger"}>{p.inStock ? "In stock" : "Sold out"}</span>
                </div>
              </div>
            </Link>
            <SearchQuickAdd product={p} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SearchQuickAdd({ product, onNavigate }: { product: SuggestProduct; onNavigate: () => void }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const { setCartCount } = useShopper();
  if (!product.inStock) return null;
  if (!product.singleVariantId) {
    return (
      <Link href={`/p/${product.slug}`} onClick={onNavigate} className={cn("shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-medium hover:border-fg")}>
        Options
      </Link>
    );
  }
  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await addToCartAction(product.singleVariantId!, 1);
          if (!res.ok) return toast({ tone: "error", title: res.error });
          setCartCount(res.count);
          toast({ title: "Added to cart", description: product.name, action: { label: "View cart", href: "/cart" } });
        })
      }
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fg text-bg transition hover:opacity-90 disabled:opacity-50"
      aria-label={`Add ${product.name} to cart`}
    >
      <Icon name="plus" size={16} strokeWidth={2.2} />
    </button>
  );
}
