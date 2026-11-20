"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { adjustStockAction } from "@/app/admin/actions";

const REASONS = [
  ["RESTOCK", "Restock received"],
  ["ADJUSTMENT", "Manual adjustment"],
  ["DAMAGE", "Damaged / lost"],
  ["RETURN", "Customer return"],
] as const;

export function StockEditor({ variantId, onHand }: { variantId: string; onHand: number }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"adjust" | "set">("adjust");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<(typeof REASONS)[number][0]>("RESTOCK");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-full border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface-2">
        Adjust
      </button>
    );
  }
  const n = Number(qty);
  const preview = mode === "set" ? n : onHand + (reason === "DAMAGE" ? -Math.abs(n) : n);
  return (
    <form
      className="flex min-w-[300px] flex-wrap items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!Number.isInteger(n) || (mode === "adjust" && n === 0)) return;
        start(async () => {
          const r = await adjustStockAction({ variantId, mode, quantity: mode === "adjust" && reason === "DAMAGE" ? -Math.abs(n) : n, reason, note });
          toast(r.ok ? { title: r.message ?? "Stock updated" } : { tone: "error", title: r.error });
          if (r.ok) {
            setOpen(false);
            setQty("");
            setNote("");
            router.refresh();
          }
        });
      }}
    >
      <select value={mode} onChange={(e) => setMode(e.target.value as "adjust" | "set")} className="h-8 rounded-lg border border-line bg-surface-2 px-1.5 text-xs" aria-label="Mode">
        <option value="adjust">Add/remove</option>
        <option value="set">Set count to</option>
      </select>
      <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder={mode === "set" ? String(onHand) : "+10 / -2"} className="h-8 w-20 rounded-lg border border-line bg-surface-2 px-2 text-xs" aria-label="Quantity" required autoFocus />
      {mode === "adjust" && (
        <select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} className="h-8 rounded-lg border border-line bg-surface-2 px-1.5 text-xs" aria-label="Reason">
          {REASONS.map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
      )}
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (PO #, reason…)" maxLength={300} className="h-8 w-36 rounded-lg border border-line bg-surface-2 px-2 text-xs" aria-label="Note" />
      <button disabled={pending} className="h-8 rounded-lg bg-fg px-3 text-xs font-semibold text-bg disabled:opacity-50">{pending ? "…" : "Save"}</button>
      <button type="button" onClick={() => setOpen(false)} className="h-8 px-2 text-xs text-muted">Cancel</button>
      {qty && Number.isFinite(preview) && <span className="w-full text-[0.7rem] text-muted">New on-hand: {preview}</span>}
    </form>
  );
}
