import Link from "next/link";
import Image from "next/image";
import { getStoreSettings } from "@/server/settings";
import { getNavigation } from "@/server/catalog/queries";
import { NewsletterForm } from "@/components/store/newsletter-form";
import { Icon } from "@/components/ui/icon";

export async function Footer() {
  const [s, nav] = await Promise.all([getStoreSettings(), getNavigation()]);
  const social = SOCIAL_LABELS.filter(([k]) => !!s.social[k]).map(([k, label]) => [label, socialHref(k, s.social[k])] as const);
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-line bg-surface pb-24 md:pb-0">
      <div className="container-page grid gap-10 py-14 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src={s.logoUrl} alt="" width={40} height={40} className="h-10 w-10 rounded-full" />
            <span className="font-semibold">{s.name}</span>
          </Link>
          <p className="mt-4 max-w-sm text-sm text-muted">{s.tagline}</p>
          <div className="mt-6 max-w-sm">
            <p className="mb-2 text-sm font-medium">Early access to drops</p>
            <NewsletterForm source="footer" compact />
          </div>
          {social.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2 text-xs text-muted">
              {social.map(([name, url]) => (
                <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line px-3 py-1.5 hover:border-fg hover:text-fg">
                  {name}
                </a>
              ))}
            </div>
          )}
        </div>
        <FooterCol title="Shop" links={[["/shop", "All products"], ...nav.categories.slice(0, 6).map((c) => [`/c/${c.slug}`, c.name] as [string, string]), ["/shop?sale=1", "Sale"]]} />
        <FooterCol title="Anime" links={[...nav.franchises.slice(0, 7).map((f) => [`/anime/${f.slug}`, f.name] as [string, string]), ["/anime", "All series"]]} />
        <FooterCol title="Help" links={[["/pages/contact", "Contact us"], ["/pages/shipping-policy", "Shipping"], ["/pages/returns-policy", "Returns & refunds"], ["/pages/cancellation-policy", "Cancellations"], ["/pages/payment-policy", "Payments"], ["/pages/grievance-redressal", "Grievance redressal"], ["/account", "My account"]]} />
        <FooterCol title="Company" links={[["/pages/about", "About us"], ["/pages/privacy-policy", "Privacy policy"], ["/pages/terms", "Terms & conditions"], ["/pages/cookie-policy", "Cookie policy"], ["/pages/disclaimer", "Disclaimer"], ["/pages/intellectual-property", "IP policy"]]} />
      </div>
      {(s.business.legalName || s.grievanceOfficer.name) && (
        <div className="border-t border-line">
          <div className="container-page grid gap-2 py-5 text-xs text-subtle sm:grid-cols-2">
            {s.business.legalName && (
              <p>
                Operated by <span className="text-muted">{s.business.legalName}</span>
                {s.business.address && <> · {s.business.address}</>}
                {s.business.gstin && <> · GSTIN {s.business.gstin}</>}
                {s.business.cin && <> · CIN {s.business.cin}</>}
              </p>
            )}
            {s.grievanceOfficer.name && (
              <p className="sm:text-right">
                {s.grievanceOfficer.designation}: <span className="text-muted">{s.grievanceOfficer.name}</span>
                {s.grievanceOfficer.email && <> · {s.grievanceOfficer.email}</>}
                {s.grievanceOfficer.phone && <> · {s.grievanceOfficer.phone}</>} ·{" "}
                <Link href="/pages/grievance-redressal" className="underline underline-offset-2 hover:text-fg">How we handle complaints</Link>
              </p>
            )}
          </div>
        </div>
      )}
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-3 py-6 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {s.business.legalName || s.name}. All rights reserved.
            {s.business.ownerName && <> · Owned by <span className="text-muted">{s.business.ownerName}</span></>}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5"><Icon name="shield" size={14} /> Secure payments</span>
            <span className="flex items-center gap-1.5"><Icon name="truck" size={14} /> Ships across India</span>
            {(s.support.email || s.support.phone) && (
              <span>
                Support: {[s.support.email, s.support.phone].filter(Boolean).join(" · ")}
                {s.support.hours && ` (${s.support.hours})`}
              </span>
            )}
            {/* Developer credit. Required by the LICENSE; do not remove without the developer's written permission. */}
            <a href="https://github.com/Rajeev0007" target="_blank" rel="noopener noreferrer" className="font-medium text-muted hover:text-fg">
              Made by Rajeev
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

const SOCIAL_LABELS = [
  ["instagram", "Instagram"],
  ["youtube", "YouTube"],
  ["facebook", "Facebook"],
  ["x", "X"],
  ["threads", "Threads"],
  ["discord", "Discord"],
  ["telegram", "Telegram"],
  ["whatsapp", "WhatsApp"],
  ["pinterest", "Pinterest"],
  ["linkedin", "LinkedIn"],
] as const;

/** Accepts full URLs, or plain handles / phone numbers, and turns them into links. */
function socialHref(kind: (typeof SOCIAL_LABELS)[number][0], v: string) {
  const val = v.trim();
  if (/^https?:\/\//i.test(val)) return val;
  const h = val.replace(/^@/, "");
  switch (kind) {
    case "whatsapp":
      return `https://wa.me/${h.replace(/[^0-9]/g, "")}`;
    case "instagram":
      return `https://instagram.com/${h}`;
    case "x":
      return `https://x.com/${h}`;
    case "youtube":
      return `https://youtube.com/@${h}`;
    case "threads":
      return `https://threads.net/@${h}`;
    case "telegram":
      return `https://t.me/${h}`;
    case "facebook":
      return `https://facebook.com/${h}`;
    case "pinterest":
      return `https://pinterest.com/${h}`;
    default:
      return `https://${h}`;
  }
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="lg:col-span-2">
      <p className="mb-4 text-sm font-semibold">{title}</p>
      <ul className="space-y-2.5 text-sm text-muted">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="transition hover:text-fg">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
