import { requireStaff } from "@/server/auth/session";
import { db } from "@/server/db";
import { PageHeader, Table } from "@/components/admin/ui";
import { Pagination } from "@/components/ui/misc";

const PER_PAGE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireStaff("audit.read", "/admin/audit");
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const [total, logs] = await Promise.all([
    db.auditLog.count(),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { actor: { select: { email: true } } } }),
  ]);
  return (
    <>
      <PageHeader title="Audit log" description="Every admin change, newest first. Entries cannot be edited or deleted from the admin." />
      <Table head={["When", "Who", "Action", "Entity", "Details"]} empty={!logs.length && <p className="p-6 text-center text-sm text-muted">No entries yet.</p>}>
        {logs.map((l) => (
          <tr key={l.id} className="align-top">
            <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted">{l.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
            <td className="px-4 py-2.5 text-xs">{l.actor?.email ?? "System"}</td>
            <td className="px-4 py-2.5 font-mono text-xs">{l.action}</td>
            <td className="px-4 py-2.5 text-xs text-muted">{l.entityType}{l.entityId ? ` · ${l.entityId.slice(-8)}` : ""}</td>
            <td className="max-w-md px-4 py-2.5"><code className="line-clamp-2 break-all text-[0.7rem] text-muted">{l.data ? JSON.stringify(l.data) : ""}</code></td>
          </tr>
        ))}
      </Table>
      <div className="mt-6"><Pagination page={page} pageCount={Math.ceil(total / PER_PAGE)} hrefFor={(p) => `/admin/audit?page=${p}`} /></div>
    </>
  );
}
