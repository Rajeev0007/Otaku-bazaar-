import { db } from "@/server/db";
import { getStoreSettings } from "@/server/settings";

export type SetupItem = { label: string; ok: boolean; required: boolean; fix: string; href?: string };

/** Launch readiness checks shown on the admin dashboard. Reports only whether things are configured, never values. */
export async function getSetupStatus(): Promise<SetupItem[]> {
  const env = process.env;
  const [s, activeProducts, demoProducts, pages, superAdmins] = await Promise.all([
    getStoreSettings(),
    db.product.count({ where: { status: "ACTIVE" } }),
    db.product.count({ where: { status: { not: "ARCHIVED" }, tags: { has: "demo" } } }),
    db.page.findMany({ where: { isPublished: true }, select: { body: true } }),
    db.userRole.count({ where: { role: { key: "super_admin" } } }),
  ]);
  const pagesWithPlaceholders = pages.filter((p) => /\[[^\]\n]{2,60}\](?!\()/.test(p.body)).length;
  const appUrl = env.APP_URL ?? "";

  return [
    { label: "Strong AUTH_SECRET", ok: (env.AUTH_SECRET?.length ?? 0) >= 32, required: true, fix: "Vercel → Settings → Environment Variables → AUTH_SECRET (32+ random characters)" },
    { label: "Site URL (APP_URL) set to https", ok: appUrl.startsWith("https://"), required: true, fix: "Set APP_URL to your live address, e.g. https://theotakubazaar.com" },
    { label: "Image uploads (Vercel Blob or S3)", ok: !!env.BLOB_READ_WRITE_TOKEN || (!!env.S3_BUCKET && !!env.MEDIA_PUBLIC_HOST), required: true, fix: "Vercel → Storage → Create → Blob → connect to project, then redeploy" },
    { label: "Transactional email (Resend)", ok: !!env.RESEND_API_KEY, required: true, fix: "Add RESEND_API_KEY and MAIL_FROM (docs/DEPLOY-VERCEL.md Step 9). Without it, verification and reset emails are not sent." },
    { label: "Google sign-in", ok: !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET, required: false, fix: "Optional: add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (Step 10)" },
    { label: "BOOTSTRAP_ADMIN_EMAIL removed", ok: !env.BOOTSTRAP_ADMIN_EMAIL || superAdmins === 0, required: false, fix: "A Super Admin exists. Delete BOOTSTRAP_ADMIN_EMAIL from Vercel." },
    { label: "Business details (legal name, address, GSTIN)", ok: !!s.business.legalName && !!s.business.address, required: true, fix: "Admin → Store settings → Business details", href: "/admin/settings" },
    { label: "Grievance officer published", ok: !!s.grievanceOfficer.name && !!s.grievanceOfficer.email, required: true, fix: "Admin → Store settings → Grievance officer", href: "/admin/settings" },
    { label: "Support email and phone", ok: !s.support.email.startsWith("[") && !s.support.phone.startsWith("["), required: true, fix: "Admin → Store settings → Support", href: "/admin/settings" },
    { label: "Policy pages completed", ok: pagesWithPlaceholders === 0, required: true, fix: `${pagesWithPlaceholders} page(s) still contain [placeholders]`, href: "/admin/pages" },
    { label: "Demo products removed", ok: demoProducts === 0, required: true, fix: `${demoProducts} demo product(s) still live. Search "demo" and archive them.`, href: "/admin/products?q=demo" },
    { label: "Real products added", ok: activeProducts - demoProducts > 0, required: true, fix: "Add at least one product", href: "/admin/products/new" },
  ];
}
