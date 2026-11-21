import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { Breadcrumbs } from "@/components/ui/misc";
import { TicketReply } from "@/components/support/support-form";
import { cn } from "@/lib/utils";

export const metadata = { title: "Support ticket", robots: { index: false } };

export default async function TicketPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const user = await requireUser(`/account/support/${number}`);
  const t = await db.supportTicket.findUnique({ where: { number }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  if (!t || (t.userId !== user.id && !(user.emailVerifiedAt && !t.userId && t.email === user.email))) notFound();
  return (
    <div className="container-page max-w-3xl pb-16 pt-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Support", href: "/account/support" }, { label: t.number }]} />
      <h1 className="mb-1 mt-5 text-2xl font-semibold">{t.subject}</h1>
      <p className="mb-6 text-sm text-muted">{t.number} · {t.status.toLowerCase().replace("_", " ")}</p>
      <ol className="mb-6 space-y-3">
        {t.messages.map((m) => (
          <li key={m.id} className={cn("max-w-[85%] rounded-2xl p-4 text-sm", m.isStaff ? "bg-surface-2" : "ml-auto bg-accent-soft")}>
            <p className="mb-1 text-xs font-semibold">{m.isStaff ? "The Otaku Bazaar" : "You"} · <span className="font-normal text-muted">{m.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span></p>
            <p className="whitespace-pre-wrap">{m.body}</p>
          </li>
        ))}
      </ol>
      {t.status !== "CLOSED" && t.userId === user.id && <TicketReply number={t.number} />}
    </div>
  );
}
