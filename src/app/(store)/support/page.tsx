import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/server/auth/session";
import { getStoreSettings } from "@/server/settings";
import { TICKET_CATEGORIES } from "@/server/support/service";
import { db } from "@/server/db";
import { SupportForm } from "@/components/support/support-form";
import { Breadcrumbs } from "@/components/ui/misc";
import { Icon, type IconName } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Help & support", description: "Track orders, returns, payments and shipping help, or send us a message." };

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const [user, s, faqs] = await Promise.all([getCurrentUser(), getStoreSettings(), db.faq.findMany({ orderBy: [{ group: "asc" }, { position: "asc" }] })]);
  const { order } = await searchParams;
  const quick: [string, IconName, string, string][] = [
    ["/track", "truck", "Track an order", "Order number + email"],
    ["/pages/returns-policy", "refresh", "Returns & refunds", "Start from your order page"],
    ["/pages/shipping-policy", "package", "Shipping", "Delivery times and charges"],
    ["/pages/payment-policy", "shield", "Payments", "UPI, cards, COD"],
  ];
  const groups = [...new Set(faqs.map((f) => f.group))];
  return (
    <div className="container-page max-w-5xl pb-16 pt-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Help & support" }]} />
      <h1 className="mb-2 mt-5 text-3xl font-semibold sm:text-4xl">How can we help?</h1>
      <p className="mb-8 text-muted">
        {s.support.hours}
        {s.support.whatsapp && <> · WhatsApp <a href={`https://wa.me/${s.support.whatsapp.replace(/\D/g, "")}`} className="text-accent hover:underline" target="_blank" rel="noreferrer">{s.support.whatsapp}</a></>}
        {s.support.email && <> · <a href={`mailto:${s.support.email}`} className="text-accent hover:underline">{s.support.email}</a></>}
      </p>
      <div className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {quick.map(([href, icon, t, d]) => (
          <Link key={href} href={href} className="rounded-[var(--radius-card)] border border-line bg-surface p-4 transition hover:border-line-strong">
            <Icon name={icon} size={20} className="text-accent" />
            <p className="mt-2 font-semibold">{t}</p>
            <p className="text-xs text-muted">{d}</p>
          </Link>
        ))}
      </div>
      {groups.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold">Frequently asked questions</h2>
          {groups.map((g) => (
            <div key={g} className="mb-4">
              <p className="eyebrow mb-2">{FAQ_GROUPS[g] ?? g}</p>
              <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
                {faqs.filter((f) => f.group === g).map((f) => (
                  <details key={f.id} className="group px-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-sm font-medium">{f.question}<Icon name="plus" size={16} className="text-muted transition group-open:rotate-45" /></summary>
                    <p className="pb-4 text-sm text-muted">{f.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-8">
        <h2 className="text-xl font-semibold">Send us a message</h2>
        <p className="mb-6 mt-1 text-sm text-muted">We reply by email.{user && <> Your tickets are in <Link href="/account/support" className="underline">My account → Support</Link>.</>}</p>
        <SupportForm categories={TICKET_CATEGORIES} name={user?.name} email={user?.email} orderNumber={order} />
      </section>
    </div>
  );
}

const FAQ_GROUPS: Record<string, string> = { orders: "Orders", shipping: "Shipping & delivery", payment: "Payments", returns: "Returns & refunds", account: "Account", general: "General" };
