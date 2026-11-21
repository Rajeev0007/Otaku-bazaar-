"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CONSENT_KEY, getConsent, track, type Consent, type TrackData, type TrackName } from "@/lib/track";

const GA_ID = /^G-[A-Z0-9]{4,20}$/;
const PIXEL_ID = /^[0-9]{6,20}$/;

/**
 * Sends first-party page views, shows the cookie banner, and loads Google Analytics / Meta Pixel
 * only after the visitor accepts analytics cookies. IDs are set in Admin → Store settings.
 */
export function ConsentAndAnalytics({ ga4Id, metaPixelId }: { ga4Id: string; metaPixelId: string }) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<Consent | "unknown">("unknown");
  const first = useRef(true);

  const ga = GA_ID.test(ga4Id.trim()) ? ga4Id.trim() : "";
  const pixel = PIXEL_ID.test(metaPixelId.trim()) ? metaPixelId.trim() : "";
  const needsBanner = !!(ga || pixel);

  useEffect(() => setConsent(getConsent()), []);

  useEffect(() => {
    track(pathname.startsWith("/checkout") ? "begin_checkout" : "page_view");
    if (first.current) {
      first.current = false;
      return;
    }
    if (getConsent() === "all") window.fbq?.("track", "PageView");
  }, [pathname]);

  function choose(c: "all" | "essential") {
    try {
      localStorage.setItem(CONSENT_KEY, c);
    } catch {
      // storage disabled; the choice applies to this page only
    }
    setConsent(c);
  }

  const allowed = consent === "all";
  return (
    <>
      {allowed && ga && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${ga}',{anonymize_ip:true});`}
          </Script>
        </>
      )}
      {allowed && pixel && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel}');fbq('track','PageView');`}
        </Script>
      )}
      {needsBanner && consent === null && (
        <div role="dialog" aria-label="Cookie preferences" className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-xl rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-xl md:bottom-6">
          <p className="text-sm text-muted">
            We use essential storage to run the store (cart, sign-in). With your permission we&apos;d also use analytics and advertising cookies to understand what you like.{" "}
            <Link href="/pages/cookie-policy" className="underline underline-offset-2 hover:text-fg">Cookie policy</Link>
          </p>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => choose("essential")} className="h-10 rounded-full border border-line px-4 text-sm font-medium hover:bg-surface-2">
              Essential only
            </button>
            <button type="button" onClick={() => choose("all")} className="h-10 rounded-full bg-fg px-4 text-sm font-semibold text-bg hover:opacity-90">
              Accept all
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Fires one event when mounted (e.g. product_view on a product page). */
export function TrackOnMount({ name, data }: { name: TrackName; data?: TrackData }) {
  const key = JSON.stringify([name, data]);
  useEffect(() => {
    track(name, data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
