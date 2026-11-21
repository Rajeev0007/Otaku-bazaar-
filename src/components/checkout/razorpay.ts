"use client";

// Loads Razorpay's hosted Checkout and resolves when the customer pays, fails, or closes it.
type RazorpayResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type Result = { status: "paid"; response: RazorpayResponse } | { status: "failed"; reason: string } | { status: "dismissed"; lastError: string | null };

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (ev: string, cb: (r: { error?: { description?: string } }) => void) => void };
  }
}

let loader: Promise<void> | null = null;
function loadScript() {
  loader ??= new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loader = null;
      reject(new Error("Couldn't load the payment window. Check your connection and try again."));
    };
    document.head.appendChild(s);
  });
  return loader;
}

export async function openRazorpay(o: { keyId: string; orderId: string; amount: number; currency: string; name: string; description: string; prefill: { name: string; email: string; contact: string }; onFailedAttempt?: (reason: string) => void }): Promise<Result> {
  try {
    await loadScript();
  } catch (e) {
    return { status: "failed", reason: e instanceof Error ? e.message : "Payment window failed to load" };
  }
  return new Promise<Result>((resolve) => {
    let settled = false;
    let lastError: string | null = null;
    const done = (r: Result) => {
      if (!settled) {
        settled = true;
        resolve(r);
      }
    };
    const rzp = new window.Razorpay!({
      key: o.keyId,
      order_id: o.orderId,
      amount: o.amount,
      currency: o.currency,
      name: o.name,
      description: o.description,
      prefill: o.prefill,
      theme: { color: "#f0506e" },
      handler: (response: RazorpayResponse) => done({ status: "paid", response }),
      modal: { ondismiss: () => done({ status: "dismissed", lastError }), confirm_close: true },
    });
    // A failed attempt keeps the Razorpay window open so the customer can try another method.
    rzp.on("payment.failed", (r) => {
      lastError = r.error?.description ?? "Payment failed";
      o.onFailedAttempt?.(lastError);
    });
    rzp.open();
  });
}
