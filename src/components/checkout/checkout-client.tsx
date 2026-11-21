"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Quote } from "@/server/checkout/pricing";
import { INDIAN_STATES, type PaymentMethod } from "@/lib/checkout";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { ProductImage } from "@/components/store/product-image";
import { useShopper } from "@/components/store/shopper-context";
import { paymentFailedAction, placeOrderAction, quoteAction, verifyPaymentAction } from "@/app/actions/checkout";
import { openRazorpay } from "@/components/checkout/razorpay";

type Addr = { id?: string; fullName: string; phone: string; line1: string; line2: string; landmark: string; city: string; state: string; postalCode: string; instructions: string };
const empty: Addr = { fullName: "", phone: "", line1: "", line2: "", landmark: "", city: "", state: "", postalCode: "", instructions: "" };

function uuid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function CheckoutClient({ initialQuote, user, addresses, storeName, giftMessage }: { initialQuote: Quote; user: { email: string; name: string | null; phone: string | null } | null; addresses: Addr[]; storeName: string; giftMessage: string | null }) {
  const [quote, setQuote] = useState(initialQuote);
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [addrId, setAddrId] = useState<string | "new">(addresses[0]?.id ?? "new");
  const [addr, setAddr] = useState<Addr>(addresses[0] ?? { ...empty, fullName: user?.name ?? "", phone: user?.phone ?? "" });
  const [billingSame, setBillingSame] = useState(true);
  const [billing, setBilling] = useState<Addr>(empty);
  const [method, setMethod] = useState("standard");
  const [payment, setPayment] = useState<PaymentMethod>(initialQuote.payment.razorpay ? "razorpay" : "cod");
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState("");
  const [gcInput, setGcInput] = useState("");
  const [giftCard, setGiftCard] = useState("");
  const [usePoints, setUsePoints] = useState(false);
  const [notes, setNotes] = useState("");
  const [saveAddress, setSaveAddress] = useState(!!user && addresses.length === 0);
  const [optIn, setOptIn] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [placing, startPlacing] = useTransition();
  const [quoting, setQuoting] = useState(false);
  const idemKey = useRef(uuid());
  const router = useRouter();
  const { setCartCount } = useShopper();

  const pin = addr.postalCode.trim();
  const refresh = useCallback(async () => {
    setQuoting(true);
    try {
      const q = await quoteAction({ email, postalCode: /^[1-9][0-9]{5}$/.test(pin) ? pin : "", shippingMethod: method, paymentMethod: payment, couponCode: coupon, giftCardCode: giftCard, usePoints });
      setQuote(q);
      if (q.shippingMethod && q.shippingMethod !== method) setMethod(q.shippingMethod);
      if (payment === "cod" && !q.payment.cod && q.payment.razorpay) setPayment("razorpay");
      if (payment === "razorpay" && !q.payment.razorpay && q.payment.cod) setPayment("cod");
    } finally {
      setQuoting(false);
    }
  }, [email, pin, method, payment, coupon, giftCard, usePoints]);

  useEffect(() => {
    const t = setTimeout(refresh, 250);
    return () => clearTimeout(t);
  }, [refresh]);

  const setA = (k: keyof Addr) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setAddr((a) => ({ ...a, [k]: e.target.value }));
    if (addrId !== "new") setAddrId("new");
  };
  const setB = (k: keyof Addr) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setBilling((a) => ({ ...a, [k]: e.target.value }));

  const blocked = quote.problems.length > 0 || !!quote.shippingError || !quote.shippingMethod;
  const err = (k: string) => errors[k];

  function place() {
    setError(null);
    setErrors({});
    startPlacing(async () => {
      const strip = ({ id: _id, ...a }: Addr) => ({ ...a, country: "IN" });
      const res = await placeOrderAction({
        email,
        phone,
        shipping: strip(addr),
        billingSameAsShipping: billingSame,
        billing: billingSame ? undefined : strip(billing),
        shippingMethod: method,
        paymentMethod: payment,
        couponCode: coupon,
        giftCardCode: giftCard,
        usePoints,
        notes,
        saveAddress: !!user && addrId === "new" && saveAddress,
        marketingOptIn: optIn,
        idempotencyKey: idemKey.current,
      });
      if (!res.ok) {
        setError(res.error);
        setErrors(res.fieldErrors ?? {});
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const orderUrl = `/order/${res.number}${res.token ? `?t=${encodeURIComponent(res.token)}` : ""}`;
      if (res.next.type === "done") {
        setCartCount(0);
        router.replace(`${orderUrl}${orderUrl.includes("?") ? "&" : "?"}placed=1`);
        return;
      }
      const r = await openRazorpay({
        keyId: res.next.keyId,
        orderId: res.next.razorpayOrderId,
        amount: res.next.amount,
        currency: res.next.currency,
        name: storeName,
        description: `Order ${res.number}`,
        prefill: { name: addr.fullName, email, contact: phone },
        onFailedAttempt: (reason) => void paymentFailedAction(res.next.type === "razorpay" ? res.next.razorpayOrderId : "", reason),
      });
      if (r.status === "paid") {
        const v = await verifyPaymentAction(r.response);
        setCartCount(0);
        router.replace(`${orderUrl}${orderUrl.includes("?") ? "&" : "?"}${v.ok ? "placed=1" : "verify=1"}`);
      } else {
        // Order stays reserved for 30 minutes; the order page lets the customer retry.
        router.replace(`${orderUrl}${orderUrl.includes("?") ? "&" : "?"}unpaid=1`);
      }
    });
  }

  const summary = (
    <Summary quote={quote} quoting={quoting} giftMessage={giftMessage}>
      <div className="mt-4">
        {quote.coupon ? (
          <div className="flex items-center justify-between rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
            <span>
              <b>{quote.coupon.code}</b> · {quote.coupon.label}
            </span>
            <button onClick={() => (setCoupon(""), setCouponInput(""))} className="text-xs underline">Remove</button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setCoupon(couponInput.trim().toUpperCase());
            }}
            className="flex gap-2"
          >
            <Input value={couponInput} onChange={(e) => setCouponInput(e.target.value)} placeholder="Coupon code" aria-label="Coupon code" className="h-10 uppercase" />
            <Button type="submit" variant="outline" size="sm" className="h-10" disabled={!couponInput.trim()}>Apply</Button>
          </form>
        )}
        {quote.couponError && coupon && <p className="mt-1.5 text-xs text-danger">{quote.couponError}</p>}
        <div className="mt-3">
          {quote.giftCard ? (
            <div className="flex items-center justify-between rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
              <span>Gift card ••{quote.giftCard.last4} · −{formatMoney(quote.giftCard.applied, quote.currency)}<span className="block text-xs opacity-80">{formatMoney(quote.giftCard.remaining, quote.currency)} left after this order</span></span>
              <button onClick={() => (setGiftCard(""), setGcInput(""))} className="text-xs underline">Remove</button>
            </div>
          ) : (
            <details className="text-sm" open={!!giftCard}>
              <summary className="cursor-pointer text-muted hover:text-fg">Have a gift card?</summary>
              <form onSubmit={(e) => { e.preventDefault(); setGiftCard(gcInput.trim()); }} className="mt-2 flex gap-2">
                <Input value={gcInput} onChange={(e) => setGcInput(e.target.value)} placeholder="OBGC-XXXX-XXXX-XXXX" aria-label="Gift card code" className="h-10 font-mono uppercase" />
                <Button type="submit" variant="outline" size="sm" className="h-10" disabled={!gcInput.trim()}>Apply</Button>
              </form>
              {quote.giftCardError && giftCard && <p className="mt-1.5 text-xs text-danger">{quote.giftCardError}</p>}
            </details>
          )}
        </div>
        {quote.points && (quote.points.balance > 0 || quote.points.earn > 0) && (
          <div className="mt-3 rounded-xl border border-line p-3 text-sm">
            {quote.points.available > 0 ? (
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" aria-label="Use reward points" />
                <span>Use {quote.points.available} of your {quote.points.balance} points <b className="text-success">−{formatMoney(quote.points.availableValue, quote.currency)}</b></span>
              </label>
            ) : (
              <p className="text-muted">You have {quote.points.balance} points{quote.points.reason ? ` · ${quote.points.reason}` : ""}</p>
            )}
            {quote.points.earn > 0 && <p className="mt-1 text-xs text-success">You'll earn {quote.points.earn} points when this order is delivered</p>}
          </div>
        )}
      </div>
    </Summary>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
      <div className="space-y-5">
        <FormError message={error} />
        {quote.problems.map((p) => (
          <p key={p} className="flex items-start gap-2 rounded-2xl bg-warning/10 p-3 text-sm text-warning" role="alert">
            <Icon name="alert" size={16} className="mt-0.5 shrink-0" /> {p} <Link href="/cart" className="ml-auto shrink-0 font-semibold underline">Edit cart</Link>
          </p>
        ))}

        <Step n={1} title="Contact">
          {!user && (
            <p className="mb-3 text-sm text-muted">
              Checking out as a guest. <Link href="/login?next=/checkout" className="font-medium text-fg underline underline-offset-2">Sign in</Link> for saved addresses and order history.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email" htmlFor="email" error={err("email")} hint="Order updates are sent here.">
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!err("email")} />
            </Field>
            <Field label="Mobile number" htmlFor="phone" error={err("phone")} hint="For delivery updates from the courier.">
              <Input id="phone" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} invalid={!!err("phone")} placeholder="+91 98765 43210" />
            </Field>
          </div>
          <Checkbox className="mt-3" label="Email me about new drops and offers" checked={optIn} onChange={(e) => setOptIn(e.currentTarget.checked)} />
        </Step>

        <Step n={2} title="Delivery address">
          {addresses.length > 0 && (
            <div className="mb-4 grid gap-2 sm:grid-cols-2">
              {addresses.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => (setAddrId(a.id!), setAddr(a))}
                  className={cn("rounded-2xl border p-3 text-left text-sm transition", addrId === a.id ? "border-fg bg-surface-2" : "border-line hover:border-line-strong")}
                >
                  <b>{a.fullName}</b>
                  <span className="block text-muted">{a.line1}, {a.city} {a.postalCode}</span>
                </button>
              ))}
              <button type="button" onClick={() => (setAddrId("new"), setAddr({ ...empty, fullName: user?.name ?? "", phone }))} className={cn("rounded-2xl border border-dashed p-3 text-left text-sm", addrId === "new" ? "border-fg" : "border-line")}>
                + New address
              </button>
            </div>
          )}
          <AddressFields a={addr} set={setA} prefix="shipping" errors={errors} />
          {user && addrId === "new" && <Checkbox className="mt-3" label="Save this address to my account" checked={saveAddress} onChange={(e) => setSaveAddress(e.currentTarget.checked)} />}
          <Checkbox className="mt-3" label="Billing address is the same as delivery" checked={billingSame} onChange={(e) => setBillingSame(e.currentTarget.checked)} />
          {!billingSame && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="mb-3 text-sm font-semibold">Billing address</p>
              <AddressFields a={billing} set={setB} prefix="billing" errors={errors} />
            </div>
          )}
        </Step>

        <Step n={3} title="Delivery method">
          {!/^[1-9][0-9]{5}$/.test(pin) ? (
            <p className="text-sm text-muted">Enter your PIN code above to see delivery options.</p>
          ) : quote.shippingError ? (
            <p className="text-sm text-danger">{quote.shippingError}</p>
          ) : (
            <div className="space-y-2">
              {quote.shippingOptions.map((o) => (
                <label key={o.code} className={cn("flex cursor-pointer items-center gap-3 rounded-2xl border p-4 text-sm transition", method === o.code ? "border-fg bg-surface-2" : "border-line hover:border-line-strong")}>
                  <input type="radio" name="method" checked={method === o.code} onChange={() => setMethod(o.code)} className="accent-[var(--accent)]" />
                  <span className="flex-1">
                    <b>{o.name}</b>
                    <span className="block text-xs text-muted">Arrives {fmtRange(o.minDate, o.maxDate)}</span>
                  </span>
                  <b className={o.free ? "text-success" : ""}>{o.free ? "Free" : formatMoney(o.cost, o.currency)}</b>
                </label>
              ))}
            </div>
          )}
        </Step>

        <Step n={4} title="Payment">
          <div className="space-y-2">
            <PayOption
              active={payment === "razorpay"}
              disabled={!quote.payment.razorpay}
              onSelect={() => setPayment("razorpay")}
              title="UPI, cards, net banking & wallets"
              desc={quote.payment.razorpay ? `Secure payment via Razorpay${quote.payment.razorpayMode === "test" ? " (TEST MODE: no real money is charged)" : ""}. We never see your card details.` : "Online payment isn't connected yet."}
            />
            <PayOption
              active={payment === "cod"}
              disabled={!quote.payment.cod}
              onSelect={() => setPayment("cod")}
              title="Cash on delivery"
              desc={quote.payment.cod ? (quote.codFee || payment !== "cod" ? `Pay when your order arrives.` : "Pay when your order arrives. No extra fee.") : (quote.payment.codReason ?? "")}
            />
          </div>
          <Field label="Order notes (optional)" htmlFor="notes" className="mt-4">
            <Textarea id="notes" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything we should know?" />
          </Field>
        </Step>

        <div className="lg:hidden">{summary}</div>

        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <p className="text-sm text-muted">
            By placing this order you agree to our <Link href="/pages/terms" className="underline">Terms</Link>, <Link href="/pages/returns-policy" className="underline">Returns Policy</Link> and <Link href="/pages/privacy-policy" className="underline">Privacy Policy</Link>.
          </p>
          <Button size="lg" className="mt-4 w-full" onClick={place} loading={placing} disabled={blocked || quoting}>
            {quote.total === 0 && quote.lines.length ? "Place order · fully paid" : payment === "cod" ? `Place order · ${formatMoney(quote.total, quote.currency)}` : `Pay ${formatMoney(quote.total, quote.currency)}`}
          </Button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-subtle"><Icon name="shield" size={13} /> Prices and stock are confirmed on our server when you place the order.</p>
        </div>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-24">{summary}</div>
      </aside>

      <div className="glass fixed inset-x-0 bottom-0 z-40 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <Button size="lg" className="w-full" onClick={place} loading={placing} disabled={blocked || quoting}>
          {quote.total === 0 && quote.lines.length ? "Place order" : payment === "cod" ? "Place order" : "Pay"} · {formatMoney(quote.total, quote.currency)}
        </Button>
      </div>
    </div>
  );
}

function fmtRange(a: string, b: string) {
  const f = (s: string) => new Date(s).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  return a === b ? `by ${f(b)}` : `${f(a)} – ${f(b)}`;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-3 text-lg font-semibold">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-fg text-sm text-bg">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function PayOption({ active, disabled, onSelect, title, desc }: { active: boolean; disabled: boolean; onSelect: () => void; title: string; desc: string }) {
  return (
    <label className={cn("flex items-start gap-3 rounded-2xl border p-4 text-sm transition", disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer", active ? "border-fg bg-surface-2" : "border-line hover:border-line-strong")}>
      <input type="radio" name="payment" checked={active} disabled={disabled} onChange={onSelect} className="mt-1 accent-[var(--accent)]" />
      <span>
        <b>{title}</b>
        <span className="block text-xs text-muted">{desc}</span>
      </span>
    </label>
  );
}

function AddressFields({ a, set, prefix, errors }: { a: Addr; set: (k: keyof Addr) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void; prefix: string; errors: Record<string, string> }) {
  const e = (k: string) => errors[`${prefix}.${k}`];
  const id = (k: string) => `${prefix}-${k}`;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Full name" htmlFor={id("fullName")} error={e("fullName")}><Input id={id("fullName")} autoComplete="name" value={a.fullName} onChange={set("fullName")} /></Field>
      <Field label="Phone" htmlFor={id("phone")} error={e("phone")}><Input id={id("phone")} type="tel" autoComplete="tel" value={a.phone} onChange={set("phone")} /></Field>
      <Field label="House / flat, street" htmlFor={id("line1")} error={e("line1")} className="sm:col-span-2"><Input id={id("line1")} autoComplete="address-line1" value={a.line1} onChange={set("line1")} /></Field>
      <Field label="Area, locality (optional)" htmlFor={id("line2")}><Input id={id("line2")} autoComplete="address-line2" value={a.line2} onChange={set("line2")} /></Field>
      <Field label="Landmark (optional)" htmlFor={id("landmark")}><Input id={id("landmark")} value={a.landmark} onChange={set("landmark")} /></Field>
      <Field label="PIN code" htmlFor={id("postalCode")} error={e("postalCode")}><Input id={id("postalCode")} inputMode="numeric" autoComplete="postal-code" maxLength={6} value={a.postalCode} onChange={set("postalCode")} /></Field>
      <Field label="City" htmlFor={id("city")} error={e("city")}><Input id={id("city")} autoComplete="address-level2" value={a.city} onChange={set("city")} /></Field>
      <Field label="State" htmlFor={id("state")} error={e("state")} className="sm:col-span-2">
        <Select id={id("state")} autoComplete="address-level1" value={a.state} onChange={set("state")}>
          <option value="">Choose…</option>
          {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </Field>
    </div>
  );
}

function Summary({ quote, quoting, giftMessage, children }: { quote: Quote; quoting: boolean; giftMessage: string | null; children: React.ReactNode }) {
  const c = quote.currency;
  const rows = useMemo(
    () =>
      [
        [`Subtotal (${quote.itemCount} item${quote.itemCount === 1 ? "" : "s"})`, formatMoney(quote.subtotal, c), ""],
        ...(quote.discount ? [[`Discount${quote.coupon ? ` (${quote.coupon.code})` : ""}`, `−${formatMoney(quote.discount, c)}`, "text-success"]] : []),
        ["Delivery", quote.shippingMethod ? (quote.shipping ? formatMoney(quote.shipping, c) : "Free") : "Enter PIN code", ""],
        ...(quote.giftWrap ? [["Gift wrap", formatMoney(quote.giftWrap, c), ""]] : []),
        ...(quote.codFee ? [["Cash on delivery fee", formatMoney(quote.codFee, c), ""]] : []),
        ...(quote.points?.value ? [[`Reward points (${quote.points.applied})`, `−${formatMoney(quote.points.value, c)}`, "text-success"]] : []),
        ...(quote.giftCard?.applied ? [["Gift card", `−${formatMoney(quote.giftCard.applied, c)}`, "text-success"]] : []),
        ...(!quote.taxInclusive ? [[quote.taxLabel, formatMoney(quote.tax, c), ""]] : []),
      ] as [string, string, string][],
    [quote, c],
  );
  return (
    <div className={cn("rounded-[var(--radius-card)] border border-line bg-surface p-5 transition-opacity sm:p-6", quoting && "opacity-70")}>
      <h2 className="text-lg font-semibold">Order summary</h2>
      <ul className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
        {quote.lines.map((l) => (
          <li key={l.variantId} className="flex gap-3 text-sm">
            <div className="relative h-16 w-13 shrink-0 overflow-hidden rounded-xl bg-surface-2">
              {l.imageUrl && <ProductImage src={l.imageUrl} alt="" fill sizes="52px" className="object-cover" />}
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-fg px-1 text-[0.65rem] font-bold text-bg">{l.quantity}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 font-medium">{l.name}</p>
              {l.variantTitle !== "Default" && <p className="text-xs text-muted">{l.variantTitle}</p>}
            </div>
            <p className="font-medium tabular-nums">{formatMoney(l.lineTotal, c)}</p>
          </li>
        ))}
      </ul>
      {giftMessage && <p className="mt-3 rounded-xl bg-surface-2 p-3 text-xs text-muted"><Icon name="gift" size={13} className="mr-1 inline" /> Gift message: “{giftMessage}”</p>}
      {children}
      <dl className="mt-5 space-y-2.5 border-t border-line pt-4 text-sm">
        {rows.map(([k, v, cls]) => (
          <div key={k} className={cn("flex justify-between gap-3", cls)}>
            <dt className={cls ? "" : "text-muted"}>{k}</dt>
            <dd className="tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
        <span className="font-semibold">Total</span>
        <span className="text-2xl font-semibold tabular-nums">{formatMoney(quote.total, c)}</span>
      </div>
      {quote.taxInclusive && <p className="mt-1 text-right text-xs text-muted">Includes {formatMoney(quote.tax, c)} {quote.taxLabel}. No hidden fees.</p>}
    </div>
  );
}
