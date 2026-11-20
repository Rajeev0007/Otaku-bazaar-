import Link from "next/link";
import Image from "next/image";
import { getStoreSettings } from "@/server/settings";
import { getNavigation } from "@/server/catalog/queries";
import { NewsletterForm } from "@/components/store/newsletter-form";
import { Icon } from "@/components/ui/icon";

export async function Footer() {
  const [s, nav] = await Promise.all([getStoreSettings(), getNavigation()]);
  const social = Object.entries(s.social).filter(([, url]) => !!url);
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
            <div className="mt-6 flex gap-3 text-sm text-muted">
              {social.map(([name, url]) => (
                <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="capitalize hover:text-fg">
                  {name}
                </a>
              ))}
            </div>
          )}
        </div>
        <FooterCol title="Shop" links={[["/shop", "All products"], ...nav.categories.slice(0, 6).map((c) => [`/c/${c.slug}`, c.name] as [string, string]), ["/shop?sale=1", "Sale"]]} />
        <FooterCol title="Anime" links={[...nav.franchises.slice(0, 7).map((f) => [`/anime/${f.slug}`, f.name] as [string, string]), ["/anime", "All series"]]} />
        <FooterCol title="Help" links={[["/pages/contact", "Contact us"], ["/pages/shipping-policy", "Shipping"], ["/pages/returns-policy", "Returns & refunds"], ["/pages/cancellation-policy", "Cancellations"], ["/pages/payment-policy", "Payments"], ["/account", "My account"]]} />
        <FooterCol title="Company" links={[["/pages/about", "About us"], ["/pages/privacy-policy", "Privacy policy"], ["/pages/terms", "Terms & conditions"], ["/pages/cookie-policy", "Cookie policy"], ["/pages/disclaimer", "Disclaimer"], ["/pages/intellectual-property", "IP policy"]]} />
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-3 py-6 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {s.name}. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5"><Icon name="shield" size={14} /> Secure payments</span>
            <span className="flex items-center gap-1.5"><Icon name="truck" size={14} /> Ships across India</span>
            <span>Support: {s.support.email} · {s.support.hours}</span>
          </div>
        </div>
      </div>
    </footer>
  );
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
