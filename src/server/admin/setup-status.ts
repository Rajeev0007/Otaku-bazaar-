import { db } from "@/server/db";
import { getStoreSettings } from "@/server/settings";
import { getIntegrations } from "@/server/integrations";

export type SetupItem = { label: string; ok: boolean; required: boolean; fix: string; href?: string };

/** Launch readiness checks shown on the admin dashboard. Reports only whether things are configured, never values. */
export async function getSetupStatus(): Promise<SetupItem[]> {
  const [s, integ, activeProducts, demoProducts, pages] = await Promise.all([
    getStoreSettings(),
    getIntegrations(),
    db.product.count({ where: { status: "ACTIVE" } }),
    db.product.count({ where: { status: { not: "ARCHIVED" }, tags: { has: "demo" } } }),
    db.page.findMany({ where: { isPublished: true }, select: { body: true } }),
  ]);
  const placeholderPages = pages.filter((p) => /\[[^\]\n]{2,60}\](?!\()/.test(p.body)).length;
  return [
    { label: "Email sending (Resend)", ok: integ.status.email === "admin" || integ.status.email === "env", required: true, fix: "Admin → Integrations → Email. Needed for verification and password-reset emails.", href: "/admin/integrations" },
    { label: "Google sign-in", ok: integ.status.google === "admin" || integ.status.google === "env", required: false, fix: "Optional: Admin → Integrations → Google", href: "/admin/integrations" },
    { label: "Logo, name and announcement bar", ok: s.logoUrl !== "" && s.name !== "", required: false, fix: "Admin → Store settings → Brand", href: "/admin/settings" },
    { label: "Support email and phone", ok: !!s.support.email && !!s.support.phone, required: true, fix: "Admin → Store settings → Support", href: "/admin/settings" },
    { label: "Social links", ok: Object.values(s.social).some(Boolean), required: false, fix: "Admin → Store settings → Social links", href: "/admin/settings" },
    { label: "Business details (legal name, address, GSTIN)", ok: !!s.business.legalName && !!s.business.address, required: true, fix: "Admin → Store settings → Business details", href: "/admin/settings" },
    { label: "Grievance officer", ok: !!s.grievanceOfficer.name && !!s.grievanceOfficer.email, required: true, fix: "Admin → Store settings → Grievance officer", href: "/admin/settings" },
    { label: "Policy pages completed", ok: placeholderPages === 0, required: true, fix: `${placeholderPages} page(s) still contain [placeholders]`, href: "/admin/pages" },
    { label: "Real products added", ok: activeProducts - demoProducts > 0, required: true, fix: "Add your first product", href: "/admin/products/new" },
    { label: "Demo products removed", ok: demoProducts === 0, required: true, fix: `${demoProducts} demo product(s) live. Remove them in Store settings → Demo catalog.`, href: "/admin/settings" },
  ];
}
