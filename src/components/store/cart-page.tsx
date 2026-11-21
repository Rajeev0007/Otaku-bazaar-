"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CartView } from "@/server/cart/service";
import { formatMoney } from "@/lib/money";
import { Icon } from "@/components/ui/icon";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { CartLine, FreeShippingProgress } from "@/components/store/cart-lines";
import { setGiftOptionsAction } from "@/app/actions/cart";

export function CartPageClient({ view }: { view: CartView }) {
  const router = useRouter();
  const refresh = () => router.refresh();

  if (!view.lines.length && !view.saved.length) {
    return (
      <EmptyState
        icon="bag"
        title="Your cart is empty"
        description="Browse the latest drops, or check your wishlist for items you've saved."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <ButtonLink href="/shop?sort=trending">Shop trending</ButtonLink>
            <ButtonLink href="/wishlist" variant="outline">View wishlist</ButtonLink>
          </div>
        }
      />
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_400px]">
      <div>
        {view.lines.length > 0 ? (
          <>
            <FreeShippingProgress subtotal={view.subtotal} threshold={view.freeShippingThreshold} remaining={view.amountToFreeShipping} currency={view.currency} />
            <ul className="divide-y divide-line">
              {view.lines.map((l) => (
                <CartLine key={l.id} line={l} currency={view.currency} onChanged={refresh} />
              ))}
            </ul>
          </>
        ) : (
          <p className="rounded-2xl border border-dashed border-line p-6 text-sm text-muted">Your cart is empty. Items you saved for later are below.</p>
        )}
        {view.saved.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-2 text-lg font-semibold">Saved for later ({view.saved.length})</h2>
            <ul className="divide-y divide-line">
              {view.saved.map((l) => (
                <CartLine key={l.id} line={l} currency={view.currency} onChanged={refresh} />
              ))}
            </ul>
          </div>
        )}
      </div>

      {view.lines.length > 0 && (
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Order summary</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <Row label={`Subtotal (${view.itemCount} item${view.itemCount === 1 ? "" : "s"})`} value={formatMoney(view.subtotal, view.currency)} />
              {view.savings > 0 && <Row label="You save" value={`−${formatMoney(view.savings, view.currency)}`} className="text-success" />}
              <Row label="Shipping (standard)" value={view.shippingEstimate === 0 ? "Free" : formatMoney(view.shippingEstimate, view.currency)} />
              {view.giftWrap && <Row label="Gift wrap" value={formatMoney(view.giftWrapPrice, view.currency)} />}
              {view.taxInclusive ? (
                <Row label={`Includes ${view.taxLabel}`} value={formatMoney(view.taxIncluded, view.currency)} className="text-muted" />
              ) : (
                <Row label="Estimated tax" value="Calculated at checkout" className="text-muted" />
              )}
            </dl>
            <div className="mt-5 flex items-center justify-between border-t border-line pt-5">
              <span className="font-semibold">Estimated total</span>
              <span className="text-xl font-semibold tabular-nums">{formatMoney(view.estimatedTotal, view.currency)}</span>
            </div>
            <p className="mt-2 text-xs text-muted">Coupons, gift cards and express delivery options are applied at checkout. No hidden fees.</p>

            <GiftOptions giftWrap={view.giftWrap} message={view.giftMessage} price={formatMoney(view.giftWrapPrice, view.currency)} onSaved={refresh} />

            {view.hasIssues && (
              <p className="mt-5 flex items-start gap-2 rounded-2xl bg-warning/10 p-3 text-sm text-warning" role="alert">
                <Icon name="alert" size={16} className="mt-0.5 shrink-0" /> Some items need attention before you can check out.
              </p>
            )}
            {view.hasIssues ? (
              <Button size="lg" className="mt-5 w-full" disabled>Fix the items above to check out</Button>
            ) : (
              <ButtonLink href="/checkout" size="lg" className="mt-5 w-full">
                Checkout <Icon name="arrow-right" size={16} />
              </ButtonLink>
            )}
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-subtle">
              <span className="flex items-center gap-1"><Icon name="shield" size={14} /> Secure payments</span>
              <span className="flex items-center gap-1"><Icon name="refresh" size={14} /> Easy returns</span>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${className ?? ""}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function GiftOptions({ giftWrap, message, price, onSaved }: { giftWrap: boolean; message: string | null; price: string; onSaved: () => void }) {
  const [wrap, setWrap] = useState(giftWrap);
  const [msg, setMsg] = useState(message ?? "");
  const [pending, start] = useTransition();
  const toast = useToast();
  const dirty = wrap !== giftWrap || msg !== (message ?? "");
  return (
    <details className="group mt-5 rounded-2xl border border-line" open={giftWrap}>
      <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-medium">
        <span className="flex items-center gap-2">
          <Icon name="gift" size={16} /> Gift options
        </span>
        <Icon name="chevron-down" size={16} className="text-muted transition group-open:rotate-180" />
      </summary>
      <div className="space-y-3 px-4 pb-4">
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          Add premium gift wrap (+{price})
        </label>
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={300} rows={3} placeholder="Gift message (printed on a card, prices hidden)" className="w-full rounded-xl border border-line bg-surface-2 p-3 text-sm outline-none focus:border-accent" aria-label="Gift message" />
        <button
          disabled={!dirty || pending}
          onClick={() =>
            start(async () => {
              const r = await setGiftOptionsAction(wrap, msg);
              if (!r.ok) return toast({ tone: "error", title: r.error });
              toast({ title: "Gift options saved" });
              onSaved();
            })
          }
          className="h-9 rounded-full bg-fg px-4 text-xs font-semibold text-bg disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save gift options"}
        </button>
      </div>
    </details>
  );
}
