import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff, can } from "@/server/auth/session";
import { db } from "@/server/db";
import { Card, PageHeader } from "@/components/admin/ui";
import { SimpleForm } from "@/components/admin/simple-form";
import { Checkbox, Select, Textarea } from "@/components/ui/field";
import { staffReplyAction, updateTicketAction } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

export default async function TicketAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireStaff("support.read", `/admin/support/${id}`);
  const t = await db.supportTicket.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } }, order: { select: { id: true, number: true, status: true } }, user: { select: { id: true } } } });
  if (!t) notFound();
  const recent = await db.order.findMany({ where: { email: t.email }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, number: true, status: true, createdAt: true } });
  const writable = can(staff, "support.write");
  return (
    <>
      <PageHeader title={t.subject} description={`${t.number} · ${t.name} <${t.email}>`} back={{ href: "/admin/support", label: "Support" }} />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <ol className="space-y-3">
            {t.messages.map((m) => (
              <li key={m.id} className={cn("max-w-[90%] rounded-2xl p-4 text-sm", m.isStaff ? "ml-auto bg-accent-soft" : "bg-surface-2")}>
                <p className="mb-1 text-xs font-semibold">{m.isStaff ? m.author?.name ?? "Staff" : t.name} · <span className="font-normal text-muted">{m.createdAt.toLocaleString("en-IN")}</span></p>
                <p className="whitespace-pre-wrap">{m.body}</p>
              </li>
            ))}
          </ol>
          {writable && (
            <Card title="Reply">
              <SimpleForm action={staffReplyAction.bind(null, t.id)} submitLabel="Send reply" resetOnSuccess>
                <Textarea name="body" rows={5} placeholder={`Hi ${t.name.split(" ")[0]},`} aria-label="Reply" />
                <Checkbox name="close" label="Mark as resolved after sending" />
              </SimpleForm>
            </Card>
          )}
        </div>
        <div className="space-y-4">
          {writable && (
            <Card title="Ticket">
              <SimpleForm key={`${t.status}-${t.priority}`} action={updateTicketAction.bind(null, t.id)} submitLabel="Update" className="space-y-3">
                <Select name="status" defaultValue={t.status} aria-label="Status">
                  {["OPEN", "PENDING_STAFF", "PENDING_CUSTOMER", "RESOLVED", "CLOSED"].map((s) => <option key={s} value={s}>{s.toLowerCase().replace("_", " ")}</option>)}
                </Select>
                <Select name="priority" defaultValue={t.priority} aria-label="Priority">
                  {["LOW", "NORMAL", "HIGH", "URGENT"].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
                </Select>
              </SimpleForm>
            </Card>
          )}
          <Card title="Customer">
            {t.user && <Link href={`/admin/customers/${t.user.id}`} className="text-sm text-accent hover:underline">View profile</Link>}
            {t.order && <p className="mt-1 text-sm">Linked order <Link href={`/admin/orders/${t.order.id}`} className="font-mono hover:underline">{t.order.number}</Link> · {t.order.status.toLowerCase()}</p>}
            {recent.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-muted">
                {recent.map((o) => <li key={o.id}><Link href={`/admin/orders/${o.id}`} className="font-mono hover:underline">{o.number}</Link> · {o.status.toLowerCase()} · {o.createdAt.toLocaleDateString("en-IN")}</li>)}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
