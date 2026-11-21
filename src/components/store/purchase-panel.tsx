"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Price, StockLabel } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useShopper } from "@/components/store/shopper-context";
import { QuantitySelector } from "@/components/store/quantity-selector";
import { WishlistButton } from "@/components/store/wishlist-button";
import { addToCartAction } from "@/app/actions/cart";
import { track } from "@/lib/track";
import { checkDeliveryAction, stockAlertAction } from "@/app/actions/product";

export type PanelVariant = {
  id: string;
  sku: string;
  title: string;
  size: string | null;
  color: string | null;
  colorHex: string | null;
  style: string | null;
  price: number;
  compareAtPrice: number | null;
  available: number;
  lowStockThreshold: number;
};

type Dim = "color" | "size" | "style";
const DIM_LABEL: Record<Dim, string> = { color: "Colour", size: "Size", style: "Model" };
const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];

export function PurchasePanel({ productId, productName, currency, variants, maxQty, hasSizeGuide, taxNote }: { productId: string; productName: string; currency: string; variants: PanelVariant[]; maxQty: number; hasSizeGuide?: boolean; taxNote: string }) {
  const dims = useMemo(() => (["color", "size", "style"] as Dim[]).filter((d) => variants.some((v) => v[d])), [variants]);
  const options = useMemo(() => {
    const out = {} as Record<Dim, { value: string; hex?: string | null }[]>;
    for (const d of dims) {
      const seen = new Map<string, string | null>();
      for (const v of variants) if (v[d] && !seen.has(v[d]!)) seen.set(v[d]!, v.colorHex);
      let list = [...seen.entries()].map(([value, hex]) => ({ value, hex: d === "color" ? hex : undefined }));
      if (d === "size") list = list.sort((a, b) => (SIZE_ORDER.indexOf(a.value) + 1 || 99) - (SIZE_ORDER.indexOf(b.value) + 1 || 99));
      out[d] = list;
    }
    return out;
  }, [dims, variants]);

  // Preselect the first in-stock variant's colour/style; leave size for the shopper to choose deliberately.
  const firstInStock = variants.find((v) => v.available > 0) ?? variants[0];
  const [selected, setSelected] = useState<Partial<Record<Dim, string>>>(() => {
    const s: Partial<Record<Dim, string>> = {};
    for (const d of dims) if (d !== "size" || options.size.length === 1) s[d] = firstInStock?.[d] ?? undefined;
    return s;
  });
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const { setCartCount, setCartOpen } = useShopper();
  const ctaRef = useRef<HTMLDivElement>(null);
  const [showSticky, setShowSticky] = useState(false);

  const variant = variants.length === 1 ? variants[0]! : variants.find((v) => dims.every((d) => v[d] === selected[d]));
  const display = variant ?? variants.find((v) => dims.every((d) => !selected[d] || v[d] === selected[d])) ?? variants[0]!;
  const missing = dims.filter((d) => !selected[d]);
  const available = variant?.available ?? 0;
  const cap = Math.max(1, Math.min(available, maxQty));

  useEffect(() => setQty((q) => Math.min(q, cap)), [cap]);

  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShowSticky(!e!.isIntersecting && e!.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  function optionState(d: Dim, value: string) {
    const candidates = variants.filter((v) => v[d] === value && dims.every((o) => o === d || !selected[o] || v[o] === selected[o]));
    return { exists: candidates.length > 0, inStock: candidates.some((v) => v.available > 0) };
  }

  function choose(d: Dim, value: string) {
    setError(null);
    setSelected((s) => {
      const next = { ...s, [d]: value };
      // Drop other selections that no longer form a real variant.
      for (const o of dims) if (o !== d && next[o] && !variants.some((v) => v[d] === value && v[o] === next[o])) delete next[o];
      return next;
    });
  }

  function add(buyNow: boolean) {
    if (!variant) {
      setError(`Please select a ${missing.map((m) => DIM_LABEL[m].toLowerCase()).join(" and ")}.`);
      ctaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (available <= 0) return setError("This option is out of stock.");
    start(async () => {
      const res = await addToCartAction(variant.id, qty);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCartCount(res.count);
      track("add_to_cart", { productId, variantId: variant.id, quantity: qty });
      if (buyNow) {
        router.push("/cart");
        return;
      }
      toast({ title: "Added to cart", description: `${productName}${variants.length > 1 ? ` · ${variant.title}` : ""} × ${qty}`, action: { label: "View cart", href: "/cart" } });
      setCartOpen(true);
    });
  }

  return (
    <div>
      <Price amount={display.price} compareAt={display.compareAtPrice} currency={currency} size="lg" />
      <p className="mt-1 text-xs text-muted">{taxNote}</p>

      {dims.map((d) => (
        <fieldset key={d} className="mt-6">
          <div className="mb-2.5 flex items-center justify-between">
            <legend className="text-sm font-medium">
              {DIM_LABEL[d]}
              {selected[d] && <span className="ml-2 font-normal text-muted">{selected[d]}</span>}
            </legend>
            {d === "size" && hasSizeGuide && (
              <a href="#size-guide" className="text-xs font-medium text-muted underline underline-offset-4 hover:text-fg">
                Size guide
              </a>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {options[d].map((o) => {
              const st = optionState(d, o.value);
              const isSel = selected[d] === o.value;
              if (d === "color") {
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => choose(d, o.value)}
                    disabled={!st.exists}
                    aria-pressed={isSel}
                    aria-label={`${o.value}${st.inStock ? "" : " (out of stock)"}`}
                    title={o.value}
                    className={cn("relative grid h-11 w-11 place-items-center rounded-full border-2 transition", isSel ? "border-fg" : "border-transparent hover:border-line-strong", !st.inStock && "opacity-40")}
                  >
                    <span className="h-8 w-8 rounded-full border border-line-strong" style={{ background: o.hex ?? "#888" }} />
                    {!st.inStock && <span className="absolute h-[2px] w-9 rotate-45 bg-fg/70" />}
                  </button>
                );
              }
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => choose(d, o.value)}
                  disabled={!st.exists}
                  aria-pressed={isSel}
                  className={cn(
                    "h-11 min-w-12 rounded-full border px-4 text-sm font-medium transition",
                    isSel ? "border-fg bg-fg text-bg" : "border-line-strong hover:border-fg",
                    !st.inStock && !isSel && "border-dashed text-subtle line-through decoration-1",
                  )}
                >
                  {o.value}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="mt-6 flex items-center gap-4">
        {variant ? <StockLabel available={available} threshold={variant.lowStockThreshold} /> : <span className="text-sm text-muted">Select {missing.map((m) => DIM_LABEL[m].toLowerCase()).join(" & ")} to see availability</span>}
        {variant && <span className="text-xs text-subtle">SKU {variant.sku}</span>}
      </div>

      <div ref={ctaRef} className="mt-5 space-y-3">
        {variant && available <= 0 ? (
          <StockAlertForm variantId={variant.id} />
        ) : (
          <>
            <div className="flex gap-3">
              <QuantitySelector value={qty} max={cap} onChange={setQty} disabled={!variant} />
              <Button size="lg" className="flex-1" onClick={() => add(false)} loading={pending}>
                <Icon name="bag" size={18} /> Add to cart
              </Button>
              <WishlistButton productId={productId} productName={productName} variant="large" />
            </div>
            <Button size="lg" variant="secondary" className="w-full" onClick={() => add(true)} disabled={pending}>
              Buy now
            </Button>
          </>
        )}
        {error && (
          <p className="flex items-center gap-1.5 text-sm text-danger" role="alert">
            <Icon name="alert" size={15} /> {error}
          </p>
        )}
      </div>

      <DeliveryChecker subtotal={(variant ?? display).price * qty} />

      {/* Mobile sticky buy bar */}
      <div className={cn("glass fixed inset-x-0 bottom-0 z-40 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-300 lg:hidden", showSticky ? "translate-y-0" : "translate-y-full")}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{productName}</p>
            <p className="text-sm font-semibold">{formatMoney(display.price, currency)}</p>
          </div>
          {variant && available <= 0 ? (
            <Button size="md" variant="outline" onClick={() => ctaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}>
              Notify me
            </Button>
          ) : (
            <Button size="md" onClick={() => add(false)} loading={pending}>
              {variant ? "Add to cart" : `Select ${missing[0] ? DIM_LABEL[missing[0]].toLowerCase() : "option"}`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StockAlertForm({ variantId }: { variantId: string }) {
  const { user } = useShopper();
  const [email, setEmail] = useState(user?.email ?? "");
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => setDone(null), [variantId]);
  if (done) return <p className="rounded-2xl bg-success/10 p-4 text-sm text-success" role="status">{done}</p>;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await stockAlertAction(variantId, email);
          if (r.ok) setDone(r.message);
          else setErr(r.error);
        });
      }}
      className="rounded-2xl border border-line bg-surface p-4"
    >
      <p className="text-sm font-semibold">Sold out — get notified</p>
      <p className="mt-0.5 text-xs text-muted">We'll email you once when this option is back in stock.</p>
      <div className="mt-3 flex gap-2">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email for restock alert" className="h-11 min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-4 text-sm outline-none focus:border-accent" />
        <Button type="submit" loading={pending}>Notify me</Button>
      </div>
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
    </form>
  );
}

function DeliveryChecker({ subtotal }: { subtotal: number }) {
  const [pin, setPin] = useState("");
  const [result, setResult] = useState<Awaited<ReturnType<typeof checkDeliveryAction>> | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ob-pincode");
      if (saved) setPin(saved);
    } catch {}
  }, []);
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  return (
    <div className="mt-6 rounded-[var(--radius-card)] border border-line p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Icon name="map-pin" size={16} /> Check delivery
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await checkDeliveryAction(pin, subtotal);
            setResult(r);
            if (r.ok) localStorage.setItem("ob-pincode", pin);
          });
        }}
        className="mt-3 flex gap-2"
      >
        <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="Enter PIN code" aria-label="PIN code" className="h-10 min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-4 text-sm outline-none focus:border-accent" />
        <Button type="submit" size="sm" variant="outline" className="h-10" loading={pending} disabled={pin.length !== 6}>
          Check
        </Button>
      </form>
      {result && !result.ok && <p className="mt-2 text-xs text-danger">{result.error}</p>}
      {result?.ok && (
        <ul className="mt-3 space-y-2 text-sm">
          {result.options.map((o) => (
            <li key={o.code} className="flex items-center justify-between gap-3">
              <span>
                <span className="font-medium">{o.name}</span>
                <span className="block text-xs text-muted">
                  {o.minDate === o.maxDate ? `By ${fmt(o.maxDate)}` : `${fmt(o.minDate)} – ${fmt(o.maxDate)}`}
                </span>
              </span>
              <span className={cn("shrink-0 text-sm font-semibold", o.free && "text-success")}>{o.free ? "Free" : formatMoney(o.cost, o.currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
