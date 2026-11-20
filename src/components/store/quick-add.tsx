"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { useShopper } from "@/components/store/shopper-context";
import { addToCartAction } from "@/app/actions/cart";

type V = { id: string; title: string; available: number };

/** Adds directly for single-variant products; otherwise shows the options inline so shoppers pick one. */
export function QuickAdd({ productName, variants, inStock, href, full }: { productName: string; variants: V[]; inStock: boolean; href: string; full?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const { setCartCount, setCartOpen } = useShopper();

  function add(variant: V) {
    start(async () => {
      const res = await addToCartAction(variant.id, 1);
      if (!res.ok) return toast({ tone: "error", title: res.error });
      setCartCount(res.count);
      setOpen(false);
      toast({ title: "Added to cart", description: variants.length > 1 ? `${productName} · ${variant.title}` : productName, action: { label: "View cart", href: "/cart" } });
      setCartOpen(true);
    });
  }

  if (!inStock) {
    return (
      <Link href={href} className={cn("relative z-10 flex h-10 items-center justify-center rounded-full border border-line-strong px-4 text-sm font-medium text-muted", full && "glass w-full")}>
        View details
      </Link>
    );
  }

  if (variants.length > 12) {
    return (
      <Link href={href} className={cn("relative z-10 flex h-10 items-center justify-center gap-2 rounded-full bg-fg px-4 text-sm font-semibold text-bg", full && "w-full")}>
        Choose options
      </Link>
    );
  }

  if (open) {
    return (
      <div className={cn("glass relative z-10 rounded-2xl border border-line p-2", full && "w-full")}>
        <div className="mb-1.5 flex items-center justify-between px-1">
          <span className="text-xs font-medium text-muted">Choose an option</span>
          <button onClick={() => setOpen(false)} aria-label="Close options" className="text-muted hover:text-fg">
            <Icon name="x" size={14} />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {variants.map((v) => (
            <button
              key={v.id}
              disabled={v.available <= 0 || pending}
              onClick={() => add(v)}
              className="h-8 min-w-10 rounded-full border border-line-strong px-2.5 text-xs font-medium transition hover:border-fg hover:bg-fg hover:text-bg disabled:cursor-not-allowed disabled:opacity-35 disabled:line-through"
            >
              {v.title.split(" / ").pop()}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => (variants.length === 1 ? add(variants[0]!) : setOpen(true))}
      className={cn("relative z-10 flex h-10 items-center justify-center gap-2 rounded-full bg-fg px-4 text-sm font-semibold text-bg transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60", full && "w-full")}
    >
      {pending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" /> : <Icon name="bag" size={16} />}
      Quick add
    </button>
  );
}
