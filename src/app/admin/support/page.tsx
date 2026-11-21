import Link from "next/link";
import { TicketStatus } from "@prisma/client";
import { requireStaff } from "@/server/auth/session";
import { db } from "@/server/db";
import { TICKET_CATEGORIES } from "@/server/support/service";
import { PageHeader, Table } from "@/components/admin/ui";

const TABS: [string, TicketStatus[]][] = [
  ["Needs reply", ["OPEN", "PENDING_STAFF"]],
  ["Waiting on customer", ["PENDING_CUSTOMER"]],
  ["Resolved", ["RESOLVED", "CLOSED"]],
];
const PRIO: Record<string, string> = { URGENT: "text-danger font-semibold", HIGH: "text-warning", NORMAL: "text-muted", LOW: "text-subtle" };

export default async function SupportAdmin({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireStaff("support.read", "/admin/support");
  const sp = await searchParams;
  const tab = TABS.find(([l]) => l === sp.tab) ?? TABS[0]!;
  const [tickets, counts] = await Promise.all([
    db.supportTicket.findMany({ where: { status: { in: tab[1] } }, orderBy: [{ priority: "desc" }, { updatedAt: "asc" }], take: 100, include: { _count: { select: { messages: true } } } }),
    db.supportTicket.groupBy({ by: ["status"], _count: true }),
  ]);
  const n = (ss: TicketStatus[]) => counts.filter((c) => ss.includes(c.status)).reduce((a, c) => a + c._count, 0);
  return (
    <>
      <PageHeader title="Support inbox" description="Customer messages from the Help page. Replies are emailed to the customer." />
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map(([l, ss]) => (
          <Link key={l} href={`/admin/support?tab=${encodeURIComponent(l)}`} className={`rounded-full px-3 py-1.5 text-sm ${tab[0] === l ? "bg-fg text-bg" : "border border-line text-muted hover:text-fg"}`}>{l} <span className="opacity-60">{n(ss)}</span></Link>
        ))}
      </div>
      <Table head={["Ticket", "From", "Topic", "Priority", "Waiting since"]} empty={!tickets.length && <p className="p-6 text-center text-sm text-muted">Inbox zero 🎉</p>}>
        {tickets.map((t) => (
          <tr key={t.id} className="hover:bg-surface-2/50">
            <td className="px-4 py-3"><Link href={`/admin/support/${t.id}`} className="font-medium hover:underline">{t.subject}</Link><span className="block text-xs text-muted">{t.number} · {t._count.messages} message{t._count.messages === 1 ? "" : "s"}</span></td>
            <td className="px-4 py-3 text-sm">{t.name}<span className="block text-xs text-muted">{t.email}</span></td>
            <td className="px-4 py-3 text-xs">{TICKET_CATEGORIES[t.category as keyof typeof TICKET_CATEGORIES] ?? t.category}</td>
            <td className={`px-4 py-3 text-xs ${PRIO[t.priority]}`}>{t.priority.toLowerCase()}</td>
            <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{t.updatedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
