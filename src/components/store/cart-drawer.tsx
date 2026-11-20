"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { CartView } from "@/server/cart/service";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { useShopper } from "@/components/store/shopper-context";
import { CartLine, FreeShippingProgress } from "@/components/store/cart-lines";

export function CartDrawer() {
  const { cartOpen, setCartOpen, cartCount } = useShopper();
  const [view, setView] = useState<CartView | null>(null);
  const [error, setError] = useState(false);
  const pathname = usePathname();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/cart", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setView(await res.json());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    if (cartOpen) load();
  }, [cartOpen, cartCount, load]);

  useEffect(() => setCartOpen(false), [pathname, setCartOpen]);

  useEffect(() => {
    if (!cartOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCartOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [cartOpen, setCartOpen]);

  return (
    <div className={cn("fixed inset-0 z-[80]", cartOpen ? "visible" : "invisible")} aria-hidden={!cartOpen}>
      <div className={cn("absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300", cartOpen ? "opacity-100" : "opacity-0")} onClick={() => setCartOpen(false)} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className={cn("absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-bg shadow-soft transition-transform duration-500 ease-[var(--ease-out-expo)] sm:rounded-l-3xl", cartOpen ? "translate-x-0" : "translate-x-full")}
      >
        <div className="flex h-16 items-center justify-between border-b border-line px-5">
          <h2 className="text-lg font-semibold">
            Your cart {view && view.itemCount > 0 && <span className="text-muted">({view.itemCount})</span>}
          </h2>
          <button onClick={() => setCartOpen(false)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2" aria-label="Close cart">
            <Icon name="x" size={22} />
          </button>
        </div>

        {!view && !error && (
          <div className="space-y-4 p-5">
            {[0, 1].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-24 w-20" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="p-8 text-center">
            <p className="text-sm text-muted">We couldn't load your cart.</p>
            <button onClick={load} className="mt-3 text-sm font-semibold text-accent hover:underline">
              Try again
            </button>
          </div>
        )}

        {view && view.lines.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-surface-2 text-muted">
              <Icon name="bag" size={28} />
            </div>
            <p className="text-lg font-semibold">Your cart is empty</p>
            <p className="mt-1.5 text-sm text-muted">Find something you'll love from our latest drops.</p>
            <ButtonLink href="/shop?sort=trending" className="mt-6">
              Shop trending
            </ButtonLink>
          </div>
        )}

        {view && view.lines.length > 0 && (
          <>
            <div className="flex-1 overflow-y-auto px-5">
              <div className="pt-4">
                <FreeShippingProgress subtotal={view.subtotal} threshold={view.freeShippingThreshold} remaining={view.amountToFreeShipping} currency={view.currency} />
              </div>
              <ul className="divide-y divide-line">
                {view.lines.map((l) => (
                  <CartLine key={l.id} line={l} currency={view.currency} compact onChanged={load} />
                ))}
              </ul>
            </div>
            <div className="space-y-3 border-t border-line p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Subtotal</span>
                <span className="text-base font-semibold tabular-nums">{formatMoney(view.subtotal, view.currency)}</span>
              </div>
              {view.savings > 0 && (
                <div className="flex items-center justify-between text-sm text-success">
                  <span>You save</span>
                  <span className="tabular-nums">{formatMoney(view.savings, view.currency)}</span>
                </div>
              )}
              <p className="text-xs text-muted">{view.taxInclusive ? `Prices include ${view.taxLabel}.` : "Taxes calculated at checkout."} Shipping calculated at checkout.</p>
              <ButtonLink href="/cart" size="lg" className="w-full">
                View cart & checkout
              </ButtonLink>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
