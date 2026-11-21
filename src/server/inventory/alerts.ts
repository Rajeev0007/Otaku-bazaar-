// Back-in-stock emails: sent once per sign-up, when the option has stock again and the product is visible.
import { db } from "@/server/db";

export async function sendDueStockAlerts(limit = 200) {
  const due = await db.stockAlert.findMany({
    where: { kind: "RESTOCK", notifiedAt: null, variant: { isActive: true, product: { status: "ACTIVE" }, inventory: { onHand: { gt: 0 } } } },
    include: { variant: { include: { inventory: true, product: { select: { name: true, slug: true, images: { take: 1, orderBy: { position: "asc" } } } } } } },
    take: limit,
  });
  if (!due.length) return 0;
  const { sendEmail, emailLayout, esc, button } = await import("@/server/email");
  const { appUrl } = await import("@/lib/utils");
  let sent = 0;
  for (const a of due) {
    const inv = a.variant.inventory;
    if (!inv || (!inv.allowBackorder && inv.onHand - inv.reserved <= 0)) continue;
    // Claim first so a parallel run can't email twice.
    const claimed = await db.stockAlert.updateMany({ where: { id: a.id, notifiedAt: null }, data: { notifiedAt: new Date() } });
    if (!claimed.count) continue;
    const link = appUrl(`/p/${a.variant.product.slug}`);
    const label = `${a.variant.product.name}${a.variant.title !== "Default" ? ` (${a.variant.title})` : ""}`;
    await sendEmail({
      to: a.email,
      userId: a.userId,
      template: "stock.back_in_stock",
      subject: `Back in stock: ${label}`,
      text: `Good news! ${label} is back in stock. Grab it before it sells out: ${link}`,
      html: emailLayout("It's back in stock", `<p><b>${esc(label)}</b> is available again. Stock is limited.</p>${button(link, "Shop now")}`),
    });
    sent++;
  }
  return sent;
}
