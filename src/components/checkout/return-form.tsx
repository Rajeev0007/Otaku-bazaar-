"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormError, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { ProductImage } from "@/components/store/product-image";
import { requestReturnAction } from "@/app/actions/checkout";
import { cn } from "@/lib/utils";

type Item = { orderItemId: string; name: string; variantTitle: string; imageUrl: string | null; maxQty: number; deadline: string | null; reason: string | null };

export function ReturnForm({ number, items, reasons, cod }: { number: string; items: Item[]; reasons: readonly string[]; cod: boolean }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [kind, setKind] = useState<"RETURN" | "EXCHANGE" | "REPLACEMENT">("RETURN");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const eligible = items.filter((i) => i.maxQty > 0);
  if (!eligible.length) return null;
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="w-full rounded-full border border-line py-2.5 text-sm font-medium hover:bg-surface-2">
        Return or exchange items
      </button>
    );
  const chosen = Object.entries(qty).filter(([, q]) => q > 0).map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <p className="font-semibold">Return or exchange</p>
      <FormError message={error} />
      <ul className="mt-3 space-y-2">
        {items.map((i) => (
          <li key={i.orderItemId} className={cn("flex items-center gap-3 text-sm", !i.maxQty && "opacity-50")}>
            <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-2">{i.imageUrl && <ProductImage src={i.imageUrl} alt="" fill sizes="40px" className="object-cover" />}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{i.name}</p>
              <p className="text-xs text-muted">{i.reason ?? (i.deadline ? `Until ${new Date(i.deadline).toLocaleDateString("en-IN")}` : "")}</p>
            </div>
            {i.maxQty > 0 && (
              <select value={qty[i.orderItemId] ?? 0} onChange={(e) => setQty((q) => ({ ...q, [i.orderItemId]: Number(e.target.value) }))} className="h-9 rounded-lg border border-line bg-surface-2 px-2 text-sm" aria-label={`Quantity of ${i.name} to return`}>
                {Array.from({ length: i.maxQty + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        {(["RETURN", "EXCHANGE", "REPLACEMENT"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k} className={cn("rounded-xl border p-2", kind === k ? "border-fg bg-surface-2 font-semibold" : "border-line text-muted")}>
            {k === "RETURN" ? "Refund" : k === "EXCHANGE" ? "Exchange size" : "Replace item"}
          </button>
        ))}
      </div>
      <Select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-3" aria-label="Reason">
        <option value="">Why are you returning?</option>
        {reasons.map((r) => <option key={r}>{r}</option>)}
      </Select>
      <Textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2} maxLength={1000} className="mt-2" placeholder={kind === "EXCHANGE" ? "Which size would you like instead?" : "Anything else we should know? For damage, describe it."} aria-label="Details" />
      {kind === "RETURN" && <p className="mt-2 text-xs text-muted">{cod ? "For cash-on-delivery orders we refund by bank transfer/UPI. We'll contact you for details." : "Refunds go back to your original payment method after we receive the item."}</p>}
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          loading={pending}
          disabled={!chosen.length || !reason}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await requestReturnAction(number, { kind, reason, details, items: chosen });
              if (!r.ok) return setError(r.error);
              toast({ title: r.message });
              setOpen(false);
              router.refresh();
            })
          }
        >
          Send request
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
