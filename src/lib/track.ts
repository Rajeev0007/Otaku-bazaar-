"use client";

/**
 * First-party, cookie-free storefront analytics. Events go to /api/events; nothing personal is sent.
 * The session id lives in sessionStorage (one tab session) unless the visitor accepts analytics
 * cookies, in which case it's kept in localStorage so repeat visits can be counted.
 * When accepted, events are also forwarded to GA4 / Meta Pixel if those are configured.
 */

export type TrackName = "page_view" | "product_view" | "add_to_cart" | "begin_checkout" | "search" | "wishlist_add";
export type TrackData = { productId?: string; variantId?: string; quantity?: number; query?: string };
export type Consent = "all" | "essential" | null;

export const CONSENT_KEY = "ob_consent";
const SID_KEY = "ob_sid";
const UTM_KEY = "ob_utm";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function getConsent(): Consent {
  return safe(() => (localStorage.getItem(CONSENT_KEY) as Consent) ?? null, null);
}

function newId() {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

function sessionId(): string | null {
  return safe(() => {
    const store = getConsent() === "all" ? localStorage : sessionStorage;
    let id = store.getItem(SID_KEY);
    if (!id) {
      id = sessionStorage.getItem(SID_KEY) ?? newId();
      store.setItem(SID_KEY, id);
    }
    return id;
  }, null);
}

/** Remembers the campaign a visitor arrived from for the rest of the tab session. */
function attribution() {
  return safe(() => {
    const saved = sessionStorage.getItem(UTM_KEY);
    if (saved) return JSON.parse(saved) as Record<string, string>;
    const p = new URLSearchParams(location.search);
    const a: Record<string, string> = {};
    for (const [k, out] of [["utm_source", "utmSource"], ["utm_medium", "utmMedium"], ["utm_campaign", "utmCampaign"]] as const) {
      const v = p.get(k);
      if (v) a[out] = v.slice(0, 80);
    }
    if (document.referrer) a.referrer = document.referrer.slice(0, 300);
    sessionStorage.setItem(UTM_KEY, JSON.stringify(a));
    return a;
  }, {} as Record<string, string>);
}

export function track(name: TrackName, data: TrackData = {}) {
  if (typeof window === "undefined") return;
  safe(() => {
    if (navigator.webdriver && !(window as { __obTrackInTests?: boolean }).__obTrackInTests) return;
    const body = JSON.stringify({ name, sessionId: sessionId(), path: location.pathname, ...attribution(), ...data });
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/events", blob)) {
      void fetch("/api/events", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => undefined);
    }
  }, undefined);

  if (getConsent() !== "all") return;
  safe(() => {
    if (window.gtag && name !== "page_view") window.gtag("event", name, { item_id: data.productId ?? data.variantId, quantity: data.quantity, search_term: data.query });
    if (window.fbq) {
      const map: Partial<Record<TrackName, string>> = { product_view: "ViewContent", add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout", search: "Search", wishlist_add: "AddToWishlist" };
      // PageView is sent by the Pixel snippet on load and by <ConsentAndAnalytics> on client navigations.
      if (map[name]) window.fbq("track", map[name], { content_ids: [data.productId ?? data.variantId].filter(Boolean), search_string: data.query });
    }
  }, undefined);
}
