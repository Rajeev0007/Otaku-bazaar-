"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { customerCancelAction, paymentFailedAction, resumePaymentAction, verifyPaymentAction } from "@/app/actions/checkout";
import { openRazorpay } from "@/components/checkout/razorpay";

export function PayNow({ number, total, email, phone, name }: { number: string; total: string; email: string; phone: string; name: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="space-y-2">
      <FormError message={error} />
      <Button
        loading={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await resumePaymentAction(number);
            if (!r.ok) return setError(r.error);
            if (r.next.type !== "razorpay") return router.refresh();
            const next = r.next;
            const res = await openRazorpay({
              keyId: next.keyId,
              orderId: next.razorpayOrderId,
              amount: next.amount,
              currency: next.currency,
              name: "The Otaku Bazaar",
              description: `Order ${number}`,
              prefill: { name, email, contact: phone },
              onFailedAttempt: (reason) => void paymentFailedAction(next.razorpayOrderId, reason),
            });
            if (res.status === "paid") {
              const v = await verifyPaymentAction(res.response);
              if (!v.ok) setError(v.error);
              router.replace(`/order/${number}?placed=1`);
              router.refresh();
            } else if (res.status === "failed") setError(res.reason);
          })
        }
      >
        Complete payment · {total}
      </Button>
    </div>
  );
}

export function CancelOrder({ number }: { number: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="w-full rounded-full border border-line py-2.5 text-sm text-muted hover:border-danger hover:text-danger">
        Cancel order
      </button>
    );
  return (
    <div className="rounded-[var(--radius-card)] border border-danger/30 p-4">
      <p className="text-sm font-semibold">Cancel this order?</p>
      <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-3 h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm" aria-label="Reason">
        <option value="">Choose a reason…</option>
        <option>Ordered by mistake</option>
        <option>Found a better price</option>
        <option>Delivery is too slow</option>
        <option>Want to change items or address</option>
        <option>Other</option>
      </select>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="danger"
          loading={pending}
          disabled={!reason}
          onClick={() =>
            start(async () => {
              const r = await customerCancelAction(number, reason);
              toast(r.ok ? { title: r.message } : { tone: "error", title: r.error });
              if (r.ok) router.refresh();
            })
          }
        >
          Confirm cancellation
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Keep order</Button>
      </div>
    </div>
  );
}
