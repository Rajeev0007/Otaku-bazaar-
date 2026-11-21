import Link from "next/link";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { Breadcrumbs, EmptyState } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "My support tickets", robots: { index: false } };

export default async function MyTickets() {
  const user = await requireUser("/account/support");
  const tickets = await db.supportTicket.findMany({ where: { OR: [{ userId: user.id }, ...(user.emailVerifiedAt ? [{ email: user.email, userId: null }] : [])] }, orderBy: { updatedAt: "desc" } });
  return (
    <div className="container-page max-w-3xl pb-16 pt-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "My account", href: "/account" }, { label: "Support" }]} />
      <div className="mb-6 mt-5 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Support</h1>
        <ButtonLink href="/support" size="sm">New message</ButtonLink>
      </div>
      {tickets.length ? (
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/account/support/${t.number}`} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-line-strong">
                <span className="min-w-0"><b className="block truncate">{t.subject}</b><span className="text-xs text-muted">{t.number} · {t.updatedAt.toLocaleDateString("en-IN")}</span></span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${t.status === "PENDING_CUSTOMER" ? "bg-accent-soft text-accent" : "bg-surface-3 text-muted"}`}>{t.status === "PENDING_CUSTOMER" ? "Reply received" : t.status.toLowerCase().replace("_", " ")}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon="mail" title="No messages yet" action={<ButtonLink href="/support">Contact us</ButtonLink>} />
      )}
    </div>
  );
}
