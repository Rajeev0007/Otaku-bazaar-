import type { TicketPriority, TicketStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/server/db";
import { randomToken } from "@/server/security/crypto";
import { emailSchema, nameSchema } from "@/lib/validation";

export const TICKET_CATEGORIES = { order: "My order", shipping: "Shipping & delivery", returns: "Returns & refunds", payment: "Payments", product: "Product question", account: "Account", other: "Something else" } as const;

export const ticketInput = z.object({
  name: nameSchema,
  email: emailSchema,
  category: z.enum(Object.keys(TICKET_CATEGORIES) as [keyof typeof TICKET_CATEGORIES, ...(keyof typeof TICKET_CATEGORIES)[]]),
  orderNumber: z.string().trim().toUpperCase().max(20).optional().default(""),
  subject: z.string().trim().min(3, "Add a short subject").max(140),
  message: z.string().trim().min(10, "Tell us a bit more (10+ characters)").max(5000),
});

export async function createTicket(raw: unknown, userId: string | null) {
  const i = ticketInput.parse(raw);
  const order = i.orderNumber ? await db.order.findUnique({ where: { number: i.orderNumber }, select: { id: true, email: true } }) : null;
  // Only link an order if it belongs to this email (no fishing for other people's orders).
  const orderId = order && order.email === i.email ? order.id : null;
  const priority: TicketPriority = i.category === "payment" || i.category === "order" ? "HIGH" : "NORMAL";
  const t = await db.supportTicket.create({
    data: {
      number: `TK-${randomToken(6).toUpperCase().replace(/[^A-Z0-9]/g, "X").slice(0, 6)}`,
      userId,
      email: i.email,
      name: i.name,
      subject: i.subject,
      category: i.category,
      orderId,
      priority,
      messages: { create: { authorId: userId, isStaff: false, body: i.message } },
    },
  });
  await mail(t.id, "created");
  return t;
}

export async function addMessage(ticketId: string, body: string, author: { userId: string | null; isStaff: boolean }) {
  const text = z.string().trim().min(1, "Write a message").max(5000).parse(body);
  const t = await db.supportTicket.findUniqueOrThrow({ where: { id: ticketId } });
  if (t.status === "CLOSED" && !author.isStaff) throw new Error("This ticket is closed. Please open a new one.");
  await db.$transaction([
    db.ticketMessage.create({ data: { ticketId, authorId: author.userId, isStaff: author.isStaff, body: text } }),
    db.supportTicket.update({ where: { id: ticketId }, data: { status: author.isStaff ? "PENDING_CUSTOMER" : "PENDING_STAFF" } }),
  ]);
  if (author.isStaff) await mail(ticketId, "reply", text);
}

export async function updateTicket(ticketId: string, patch: { status?: TicketStatus; priority?: TicketPriority; assigneeId?: string | null }) {
  return db.supportTicket.update({ where: { id: ticketId }, data: patch });
}

async function mail(ticketId: string, kind: "created" | "reply", body?: string) {
  try {
    const { sendEmail, emailLayout, esc, button } = await import("@/server/email");
    const { appUrl } = await import("@/lib/utils");
    const t = await db.supportTicket.findUniqueOrThrow({ where: { id: ticketId } });
    const link = t.userId ? appUrl(`/account/support/${t.number}`) : appUrl("/support");
    await sendEmail({
      to: t.email,
      userId: t.userId,
      template: `support.${kind}`,
      subject: kind === "created" ? `We got your message (${t.number})` : `Re: ${t.subject} (${t.number})`,
      text: kind === "created" ? `Thanks ${t.name}, we've received your message and will reply by email as soon as we can. Ticket ${t.number}.` : `${body}\n\nReply: ${link}`,
      html: emailLayout(
        kind === "created" ? "We got your message" : `Reply to ${t.number}`,
        kind === "created"
          ? `<p>Thanks ${esc(t.name)}, we'll reply by email as soon as we can.</p><p>Ticket <b>${t.number}</b>: ${esc(t.subject)}</p>`
          : `<p style="white-space:pre-wrap">${esc(body ?? "")}</p>${button(link, t.userId ? "Reply" : "Contact us again")}${t.userId ? "" : `<p>Please mention ticket ${t.number} when you write back.</p>`}`,
      ),
    });
  } catch (err) {
    console.error("[support] email failed", err);
  }
}
