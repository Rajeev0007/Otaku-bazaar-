"use client";

import Link from "next/link";
import { useTransition } from "react";
import type { CartLineView } from "@/server/cart/service";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { useShopper } from "@/components/store/shopper-context";
import { ProductImage } from "@/components/store/product-image";
import { QuantitySelector } from "@/components/store/quantity-selector";
import { removeCartItemAction, saveForLaterAction, updateCartQuantityAction } from "@/app/actions/cart";

export function CartLine({ line, currency, compact, onChanged }: { line: CartLineView; currency: string; compact?: boolean; onChanged: () => void }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const { setCartCount } = useShopper();

  function run(fn: () => ReturnType<typeof removeCartItemAction>, success?: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        toast({ tone: "error", title: res.error });
        return;
      }
      setCartCount(res.count);
      if (success ?? res.message) toast({ title: (success ?? res.message)! });
      onChanged();
    });
  }

  const blocked = line.issue && !line.issue.startsWith("Only");

  return (
    <li className={cn("flex gap-3 py-4 transition sm:gap-4", pending && "opacity-60")}>
      <Link href={`/p/${line.slug}`} className={cn("relative shrink-0 overflow-hidden rounded-2xl bg-surface-2", compact ? "h-24 w-20" : "h-32 w-26 sm:h-36 sm:w-28")}>
        {line.image && <ProductImage src={line.image.url} alt={line.image.alt} fill sizes="112px" className={cn("object-cover", blocked && "grayscale")} />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {line.franchise && <p className="eyebrow mb-0.5 truncate">{line.franchise}</p>}
            <Link href={`/p/${line.slug}`} className="line-clamp-2 text-sm font-medium hover:underline">
              {line.name}
            </Link>
            {line.variantTitle !== "Default" && <p className="mt-0.5 text-xs text-muted">{line.variantTitle}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular-nums">{formatMoney(line.lineTotal, currency)}</p>
            {line.quantity > 1 && <p className="text-xs text-muted">{formatMoney(line.unitPrice, currency)} each</p>}
          </div>
        </div>
        {line.issue && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-warning">
            <Icon name="alert" size={13} /> {line.issue}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-3">
          {!line.savedForLater && !blocked && (
            <QuantitySelector
              value={line.quantity}
              max={Math.max(line.maxQuantity, 1)}
              size="sm"
              disabled={pending}
              onChange={(q) => run(() => updateCartQuantityAction(line.id, q))}
              label={`Quantity for ${line.name}`}
            />
          )}
          {!compact && (
            <button onClick={() => run(() => saveForLaterAction(line.id, !line.savedForLater))} disabled={pending} className="text-xs font-medium text-muted underline-offset-4 hover:text-fg hover:underline">
              {line.savedForLater ? "Move to cart" : "Save for later"}
            </button>
          )}
          <button onClick={() => run(() => removeCartItemAction(line.id), "Removed from cart")} disabled={pending} className="text-xs font-medium text-muted underline-offset-4 hover:text-danger hover:underline">
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

export function FreeShippingProgress({ subtotal, threshold, remaining, currency }: { subtotal: number; threshold: number; remaining: number; currency: string }) {
  if (threshold <= 0) return null;
  const pct = Math.min(100, Math.round((subtotal / threshold) * 100));
  return (
    <div className="rounded-2xl bg-surface-2 p-3.5">
      <p className="flex items-center gap-2 text-sm">
        <Icon name="truck" size={17} className={remaining === 0 ? "text-success" : "text-muted"} />
        {remaining === 0 ? (
          <span className="font-medium text-success">You've unlocked free shipping</span>
        ) : (
          <span>
            Add <strong className="font-semibold">{formatMoney(remaining, currency)}</strong> more for free shipping
          </span>
        )}
      </p>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to free shipping">
        <div className={cn("h-full rounded-full transition-all duration-700", remaining === 0 ? "bg-success" : "bg-accent")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
