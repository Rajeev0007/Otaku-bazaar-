"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { StoreSettings } from "@/server/settings";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { saveSettingsAction } from "@/app/admin/actions";
import { THEMES, type ThemeId } from "@/lib/themes";
import { Swatch } from "@/components/store/theme-runtime";
import { cn } from "@/lib/utils";

const SOCIALS = [
  ["instagram", "Instagram", "@theotakubazaar"],
  ["youtube", "YouTube", "@channel"],
  ["facebook", "Facebook", "page name or link"],
  ["x", "X (Twitter)", "@handle"],
  ["threads", "Threads", "@handle"],
  ["discord", "Discord invite", "https://discord.gg/…"],
  ["telegram", "Telegram", "channel name"],
  ["whatsapp", "WhatsApp channel/number", "+91… or link"],
  ["pinterest", "Pinterest", "profile"],
  ["linkedin", "LinkedIn", "https://linkedin.com/…"],
] as const;

const rupees = (paise: number) => String(paise / 100);
const paise = (r: string) => Math.round(Number(r || 0) * 100);

export function SettingsForm({ initial }: { initial: StoreSettings }) {
  const [s, setS] = useState({
    name: initial.name,
    tagline: initial.tagline,
    logoUrl: initial.logoUrl,
    announcements: initial.announcements.map((a) => `${a.text}${a.href ? ` | ${a.href}` : ""}`).join("\n"),
    freeShippingThreshold: rupees(initial.freeShippingThreshold),
    standardShipping: rupees(initial.standardShipping),
    giftWrapPrice: rupees(initial.giftWrapPrice),
    maxQtyPerLine: String(initial.maxQtyPerLine),
    loyaltyEnabled: initial.loyalty.enabled,
    pointsPer100: String(initial.loyalty.pointsPer100),
    pointValue: rupees(initial.loyalty.pointValue),
    minRedeem: String(initial.loyalty.minRedeem),
    maxRedeemPercent: String(initial.loyalty.maxRedeemPercent),
    signupBonus: String(initial.loyalty.signupBonus),
    ga4Id: initial.analytics.ga4Id,
    metaPixelId: initial.analytics.metaPixelId,
    codEnabled: initial.cod.enabled,
    codMax: rupees(initial.cod.maxOrder),
    codFee: rupees(initial.cod.fee),
    taxInclusive: initial.taxInclusive,
    taxRate: String(initial.taxRateBps / 100),
    taxLabel: initial.taxLabel,
    supportEmail: initial.support.email,
    supportPhone: initial.support.phone,
    supportHours: initial.support.hours,
    supportWhatsapp: initial.support.whatsapp,
    ...initial.social,
    ownerName: initial.business.ownerName,
    legalName: initial.business.legalName,
    address: initial.business.address,
    gstin: initial.business.gstin,
    cin: initial.business.cin,
    goName: initial.grievanceOfficer.name,
    goDesignation: initial.grievanceOfficer.designation,
    goEmail: initial.grievanceOfficer.email,
    goPhone: initial.grievanceOfficer.phone,
    maintenanceMode: initial.maintenanceMode,
    maintenanceMessage: initial.maintenanceMessage,
    theme: initial.appearance.theme as ThemeId,
    shopperChoice: initial.appearance.shopperChoice,
    wallpapers: initial.appearance.wallpapers,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const set = (k: keyof typeof s) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setS((x) => ({ ...x, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  function save() {
    setError(null);
    const announcements = s.announcements
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [text, href] = l.split("|").map((x) => x.trim());
        return { text: text!, ...(href ? { href } : {}) };
      });
    start(async () => {
      const r = await saveSettingsAction({
        name: s.name,
        tagline: s.tagline,
        logoUrl: s.logoUrl,
        announcements,
        freeShippingThreshold: paise(s.freeShippingThreshold),
        standardShipping: paise(s.standardShipping),
        giftWrapPrice: paise(s.giftWrapPrice),
        maxQtyPerLine: Number(s.maxQtyPerLine),
        loyalty: { enabled: s.loyaltyEnabled, pointsPer100: Number(s.pointsPer100) || 0, pointValue: paise(s.pointValue) || 1, minRedeem: Number(s.minRedeem) || 0, maxRedeemPercent: Number(s.maxRedeemPercent) || 0, signupBonus: Number(s.signupBonus) || 0 },
        analytics: { ga4Id: s.ga4Id.trim(), metaPixelId: s.metaPixelId.trim() },
        cod: { enabled: s.codEnabled, maxOrder: paise(s.codMax), fee: paise(s.codFee) },
        taxInclusive: s.taxInclusive,
        taxRateBps: Math.round(Number(s.taxRate) * 100),
        taxLabel: s.taxLabel,
        support: { email: s.supportEmail, phone: s.supportPhone, hours: s.supportHours, whatsapp: s.supportWhatsapp },
        social: Object.fromEntries(SOCIALS.map(([k]) => [k, s[k]])),
        business: { ownerName: s.ownerName, legalName: s.legalName, address: s.address, gstin: s.gstin, cin: s.cin },
        grievanceOfficer: { name: s.goName, designation: s.goDesignation, email: s.goEmail, phone: s.goPhone },
        maintenanceMode: s.maintenanceMode,
        maintenanceMessage: s.maintenanceMessage,
        appearance: { theme: s.theme, shopperChoice: s.shopperChoice, wallpapers: s.wallpapers },
      });
      if (!r.ok) return setError(r.error + (r.fieldErrors ? ` ${Object.entries(r.fieldErrors).map(([k, v]) => `${k}: ${v}`).join(", ")}` : ""));
      toast({ title: "Settings saved" });
      router.refresh();
    });
  }

  const box = "space-y-4 rounded-2xl border border-line bg-surface p-5";
  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
      <div className="lg:col-span-2"><FormError message={error} /></div>
      <section className={`${box} lg:col-span-2`}>
        <div>
          <h2 className="font-semibold">Appearance &amp; anime themes</h2>
          <p className="mt-1 text-xs text-muted">Pick the store&apos;s default look. All artwork and animations are original, so they&apos;re safe to use commercially. Use Preview to see a theme before saving.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-label="Default theme">
          {THEMES.map((t) => (
            <div key={t.id} className={cn("rounded-xl border p-3 transition", s.theme === t.id ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong")}>
              <button type="button" role="radio" aria-checked={s.theme === t.id} onClick={() => setS((x) => ({ ...x, theme: t.id }))} className="flex w-full items-center gap-3 text-left">
                <Swatch colors={t.swatch} size={36} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{t.name}</span>
                  <span className="block text-xs text-muted">{t.tagline}</span>
                </span>
              </button>
              <a href={`/?theme=${t.id}`} target="_blank" rel="noopener" className="mt-2 inline-block text-xs font-medium text-accent hover:underline">Preview ↗</a>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <Checkbox label="Let shoppers choose their own theme (palette button in the header)" checked={s.shopperChoice} onChange={set("shopperChoice")} />
          <Checkbox label="Animated backgrounds (falling leaves, petals, flames, neon rain)" checked={s.wallpapers} onChange={set("wallpapers")} />
        </div>
        <p className="text-xs text-muted">Animations switch off automatically for visitors who turn on &quot;reduce motion&quot; on their device, and pause when the tab isn&apos;t visible.</p>
      </section>
      <section className={box}>
        <h2 className="font-semibold">Brand</h2>
        <Field label="Store name" htmlFor="name"><Input id="name" value={s.name} onChange={set("name")} /></Field>
        <Field label="Tagline" htmlFor="tagline"><Input id="tagline" value={s.tagline} onChange={set("tagline")} /></Field>
        <Field label="Logo URL" htmlFor="logoUrl"><Input id="logoUrl" value={s.logoUrl} onChange={set("logoUrl")} /></Field>
      </section>
      <section className={box}>
        <h2 className="font-semibold">Announcement bar</h2>
        <Field label="Messages (one per line)" htmlFor="ann" hint="Format: Message text | /optional-link">
          <Textarea id="ann" rows={5} value={s.announcements} onChange={set("announcements")} />
        </Field>
      </section>
      <section className={box}>
        <h2 className="font-semibold">Shipping & cart (₹)</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Free shipping over" htmlFor="fs"><Input id="fs" type="number" value={s.freeShippingThreshold} onChange={set("freeShippingThreshold")} /></Field>
          <Field label="Standard shipping" htmlFor="ss"><Input id="ss" type="number" value={s.standardShipping} onChange={set("standardShipping")} /></Field>
          <Field label="Gift wrap price" htmlFor="gw"><Input id="gw" type="number" value={s.giftWrapPrice} onChange={set("giftWrapPrice")} /></Field>
          <Field label="Max quantity per item" htmlFor="mq"><Input id="mq" type="number" value={s.maxQtyPerLine} onChange={set("maxQtyPerLine")} /></Field>
        </div>
        <p className="text-xs text-muted">Per-zone delivery rates (standard / express / next-day) are stored in shipping zones and used by the PIN code checker.</p>
      </section>
      <section className={box}>
        <h2 className="font-semibold">Reward points</h2>
        <Checkbox label="Customers earn points on delivered orders" checked={s.loyaltyEnabled} onChange={set("loyaltyEnabled")} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Points per ₹100 spent" htmlFor="pp"><Input id="pp" type="number" value={s.pointsPer100} onChange={set("pointsPer100")} /></Field>
          <Field label="1 point is worth (₹)" htmlFor="pv"><Input id="pv" type="number" step="0.01" value={s.pointValue} onChange={set("pointValue")} /></Field>
          <Field label="Min points to redeem" htmlFor="mr"><Input id="mr" type="number" value={s.minRedeem} onChange={set("minRedeem")} /></Field>
          <Field label="Max % of order paid with points" htmlFor="mp"><Input id="mp" type="number" value={s.maxRedeemPercent} onChange={set("maxRedeemPercent")} /></Field>
          <Field label="Sign-up bonus points" htmlFor="sb"><Input id="sb" type="number" value={s.signupBonus} onChange={set("signupBonus")} /></Field>
        </div>
        <p className="text-xs text-muted">Example: 2 points per ₹100 and ₹1 per point = 2% back.</p>
      </section>
      <section className={box}>
        <h2 className="font-semibold">Analytics & ads (optional)</h2>
        <p className="text-xs text-muted">Loaded only after the visitor accepts cookies. Store analytics in Admin → Analytics works without these.</p>
        <Field label="Google Analytics 4 measurement ID" htmlFor="ga4"><Input id="ga4" value={s.ga4Id} onChange={set("ga4Id")} placeholder="G-XXXXXXXXXX" /></Field>
        <Field label="Meta (Facebook/Instagram) Pixel ID" htmlFor="mpx"><Input id="mpx" value={s.metaPixelId} onChange={set("metaPixelId")} placeholder="123456789012345" /></Field>
      </section>
      <section className={box}>
        <h2 className="font-semibold">Cash on delivery</h2>
        <Checkbox label="Offer cash on delivery" checked={s.codEnabled} onChange={set("codEnabled")} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Max order value (₹)" htmlFor="codMax" hint="0 = no limit"><Input id="codMax" type="number" value={s.codMax} onChange={set("codMax")} /></Field>
          <Field label="COD fee (₹)" htmlFor="codFee" hint="Shown before the customer pays"><Input id="codFee" type="number" value={s.codFee} onChange={set("codFee")} /></Field>
        </div>
      </section>
      <section className={box}>
        <h2 className="font-semibold">Tax display</h2>
        <Checkbox label="Prices include tax (MRP-style, typical for India)" checked={s.taxInclusive} onChange={set("taxInclusive")} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tax rate %" htmlFor="tr"><Input id="tr" type="number" step="0.01" value={s.taxRate} onChange={set("taxRate")} /></Field>
          <Field label="Tax label" htmlFor="tl"><Input id="tl" value={s.taxLabel} onChange={set("taxLabel")} /></Field>
        </div>
      </section>
      <section className={box}>
        <h2 className="font-semibold">Support</h2>
        <Field label="Support email" htmlFor="se"><Input id="se" value={s.supportEmail} onChange={set("supportEmail")} /></Field>
        <Field label="Support phone" htmlFor="sp"><Input id="sp" value={s.supportPhone} onChange={set("supportPhone")} /></Field>
        <Field label="Support WhatsApp number" htmlFor="sw"><Input id="sw" value={s.supportWhatsapp} onChange={set("supportWhatsapp")} placeholder="+91 98765 43210" /></Field>
        <Field label="Support hours" htmlFor="sh"><Input id="sh" value={s.supportHours} onChange={set("supportHours")} /></Field>
      </section>
      <section className={box}>
        <h2 className="font-semibold">Social links</h2>
        <p className="text-xs text-muted">Paste a full link or just the handle (e.g. @theotakubazaar). Empty ones are hidden from the footer.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SOCIALS.map(([k, label, ph]) => (
            <Field key={k} label={label} htmlFor={`social-${k}`}>
              <Input id={`social-${k}`} value={s[k]} onChange={set(k)} placeholder={ph} />
            </Field>
          ))}
        </div>
      </section>
      <section className={box}>
        <h2 className="font-semibold">Business details</h2>
        <Field label="Store owner" htmlFor="ownerName" hint="Shown in the footer as “Owned by …”."><Input id="ownerName" value={s.ownerName} onChange={set("ownerName")} /></Field>
        <p className="text-xs text-muted">Shown in the footer. Indian e-commerce rules require your legal name and address to be displayed. Leave blank until registered.</p>
        <Field label="Legal business name" htmlFor="legalName"><Input id="legalName" value={s.legalName} onChange={set("legalName")} placeholder="e.g. Otaku Bazaar Private Limited" /></Field>
        <Field label="Registered address" htmlFor="address"><Input id="address" value={s.address} onChange={set("address")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="GSTIN" htmlFor="gstin"><Input id="gstin" value={s.gstin} onChange={set("gstin")} /></Field>
          <Field label="CIN / LLPIN (optional)" htmlFor="cin"><Input id="cin" value={s.cin} onChange={set("cin")} /></Field>
        </div>
      </section>
      <section className={box}>
        <h2 className="font-semibold">Grievance officer</h2>
        <p className="text-xs text-muted">Required for Indian e-commerce. Complaints must be acknowledged within 48 hours and resolved within one month.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" htmlFor="goName"><Input id="goName" value={s.goName} onChange={set("goName")} /></Field>
          <Field label="Designation" htmlFor="goDesignation"><Input id="goDesignation" value={s.goDesignation} onChange={set("goDesignation")} /></Field>
          <Field label="Email" htmlFor="goEmail"><Input id="goEmail" type="email" value={s.goEmail} onChange={set("goEmail")} /></Field>
          <Field label="Phone" htmlFor="goPhone"><Input id="goPhone" value={s.goPhone} onChange={set("goPhone")} /></Field>
        </div>
      </section>
      <section className={`${box} lg:col-span-2`}>
        <h2 className="font-semibold">Maintenance mode</h2>
        <Checkbox label="Show a maintenance page to shoppers (staff can still browse)" checked={s.maintenanceMode} onChange={set("maintenanceMode")} />
        <Field label="Message" htmlFor="mm"><Input id="mm" value={s.maintenanceMessage} onChange={set("maintenanceMessage")} /></Field>
      </section>
      <div className="lg:col-span-2">
        <Button onClick={save} loading={pending}>Save settings</Button>
      </div>
    </div>
  );
}
