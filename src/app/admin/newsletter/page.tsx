import { requireStaff } from "@/server/auth/session";
import { db } from "@/server/db";
import { PageHeader, Stat, Table } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/simple-form";
import { Pagination } from "@/components/ui/misc";
import { unsubscribeAction } from "@/app/admin/actions";

const PER_PAGE = 50;

export default async function NewsletterAdmin({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireStaff("marketing.write", "/admin/newsletter");
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const where = { unsubscribedAt: null };
  const [active, unsubscribed, customersOptedIn, subs] = await Promise.all([
    db.newsletterSubscriber.count({ where }),
    db.newsletterSubscriber.count({ where: { unsubscribedAt: { not: null } } }),
    db.user.count({ where: { marketingOptIn: true, status: "ACTIVE" } }),
    db.newsletterSubscriber.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
  ]);
  return (
    <>
      <PageHeader
        title="Newsletter"
        description="People who agreed to receive marketing emails. Export the list to send campaigns from Resend, Mailchimp or Brevo."
        actions={<a href="/api/admin/export/newsletter" className="rounded-full border border-line px-4 py-2 text-sm hover:bg-surface-2">Export CSV</a>}
      />
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Subscribers" value={active} />
        <Stat label="Customers opted in" value={customersOptedIn} hint="Included in the export" />
        <Stat label="Unsubscribed" value={unsubscribed} />
      </div>
      <Table head={["Email", "Source", "Joined", ""]} empty={!subs.length && <p className="p-6 text-center text-sm text-muted">No subscribers yet.</p>}>
        {subs.map((s) => (
          <tr key={s.id}>
            <td className="px-4 py-2.5">{s.email}</td>
            <td className="px-4 py-2.5 text-xs text-muted">{s.source ?? "—"}</td>
            <td className="px-4 py-2.5 text-xs text-muted">{s.createdAt.toLocaleDateString("en-IN")}</td>
            <td className="px-4 py-2.5 text-right"><ConfirmButton action={unsubscribeAction.bind(null, s.id)} label="Unsubscribe" confirmText={`Unsubscribe ${s.email}?`} /></td>
          </tr>
        ))}
      </Table>
      <div className="mt-6"><Pagination page={page} pageCount={Math.ceil(active / PER_PAGE)} hrefFor={(p) => `/admin/newsletter?page=${p}`} /></div>
    </>
  );
}
