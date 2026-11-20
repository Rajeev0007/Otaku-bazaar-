"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { StoreSettings } from "@/server/settings";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { saveSettingsAction } from "@/app/admin/actions";

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
    taxInclusive: initial.taxInclusive,
    taxRate: String(initial.taxRateBps / 100),
    taxLabel: initial.taxLabel,
    supportEmail: initial.support.email,
    supportPhone: initial.support.phone,
    supportHours: initial.support.hours,
    instagram: initial.social.instagram,
    youtube: initial.social.youtube,
    x: initial.social.x,
    discord: initial.social.discord,
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
        taxInclusive: s.taxInclusive,
        taxRateBps: Math.round(Number(s.taxRate) * 100),
        taxLabel: s.taxLabel,
        support: { email: s.supportEmail, phone: s.supportPhone, hours: s.supportHours },
        social: { instagram: s.instagram, youtube: s.youtube, x: s.x, discord: s.discord },
        business: { legalName: s.legalName, address: s.address, gstin: s.gstin, cin: s.cin },
        grievanceOfficer: { name: s.goName, designation: s.goDesignation, email: s.goEmail, phone: s.goPhone },
        maintenanceMode: s.maintenanceMode,
        maintenanceMessage: s.maintenanceMessage,
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
        <Field label="Support hours" htmlFor="sh"><Input id="sh" value={s.supportHours} onChange={set("supportHours")} /></Field>
      </section>
      <section className={box}>
        <h2 className="font-semibold">Social links</h2>
        {(["instagram", "youtube", "x", "discord"] as const).map((k) => (
          <Field key={k} label={k === "x" ? "X (Twitter)" : k[0]!.toUpperCase() + k.slice(1)} htmlFor={k}>
            <Input id={k} value={s[k]} onChange={set(k)} placeholder="https://" />
          </Field>
        ))}
      </section>
      <section className={box}>
        <h2 className="font-semibold">Business details</h2>
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
