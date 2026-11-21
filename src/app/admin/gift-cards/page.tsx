import { requireStaff } from "@/server/auth/session";
import { db } from "@/server/db";
import { formatMoney } from "@/lib/money";
import { Card, PageHeader, Stat, Table } from "@/components/admin/ui";
import { ActionButton } from "@/components/admin/simple-form";
import { IssueGiftCard } from "@/components/admin/issue-gift-card";
import { setGiftCardActiveAction } from "@/app/admin/actions";

export default async function GiftCardsAdmin() {
  await requireStaff("marketing.write", "/admin/gift-cards");
  const [cards, totals] = await Promise.all([
    db.giftCard.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { _count: { select: { transactions: true } } } }),
    db.giftCard.aggregate({ where: { isActive: true }, _sum: { balance: true, initialValue: true }, _count: true }),
  ]);
  const now = new Date();
  return (
    <>
      <PageHeader title="Gift cards" description="Issue digital gift cards (birthday gifts, giveaways, store credit). Customers enter the code at checkout and can use the balance over several orders." />
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Active cards" value={totals._count} />
        <Stat label="Issued value" value={formatMoney(totals._sum.initialValue ?? 0, "INR")} />
        <Stat label="Unused balance" value={formatMoney(totals._sum.balance ?? 0, "INR")} hint="Liability on your books" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <Table head={["Card", "Value", "Balance", "Recipient", "Expires", ""]} empty={!cards.length && <p className="p-6 text-center text-sm text-muted">No gift cards yet.</p>}>
          {cards.map((g) => (
            <tr key={g.id}>
              <td className="px-4 py-3 font-mono">••••{g.last4}<span className="block text-xs text-muted">{g.createdAt.toLocaleDateString("en-IN")}</span></td>
              <td className="px-4 py-3 tabular-nums">{formatMoney(g.initialValue, g.currency)}</td>
              <td className="px-4 py-3 font-medium tabular-nums">{formatMoney(g.balance, g.currency)}</td>
              <td className="px-4 py-3 text-xs text-muted">{g.recipientEmail ?? "—"}{g.message && <span className="block truncate">“{g.message}”</span>}</td>
              <td className="px-4 py-3 text-xs">{g.expiresAt ? <span className={g.expiresAt < now ? "text-danger" : ""}>{g.expiresAt.toLocaleDateString("en-IN")}</span> : "Never"}</td>
              <td className="px-4 py-3">
                <ActionButton action={setGiftCardActiveAction.bind(null, g.id, !g.isActive)} className={`rounded-full px-3 py-1 text-xs ${g.isActive ? "border border-line" : "bg-danger/15 text-danger"}`}>{g.isActive ? "Disable" : "Disabled · enable"}</ActionButton>
              </td>
            </tr>
          ))}
        </Table>
        <Card title="Issue a gift card" description="With an email, the code is sent straight to the recipient. Without one, copy the code and share it yourself.">
          <IssueGiftCard />
        </Card>
      </div>
    </>
  );
}
