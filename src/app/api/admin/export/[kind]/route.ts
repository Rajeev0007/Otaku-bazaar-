import { assertPermission, ForbiddenError } from "@/server/auth/session";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

// CSV exports for the admin. Values starting with = + - @ are prefixed to block spreadsheet formula injection.
function cell(v: unknown) {
  let s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
const csv = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

export async function GET(_req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  try {
    let body: string;
    let actorId: string;
    if (kind === "newsletter") {
      actorId = (await assertPermission("marketing.write")).id;
      const [subs, users] = await Promise.all([
        db.newsletterSubscriber.findMany({ where: { unsubscribedAt: null }, orderBy: { createdAt: "asc" } }),
        db.user.findMany({ where: { marketingOptIn: true, status: "ACTIVE" }, select: { email: true, name: true, createdAt: true } }),
      ]);
      const seen = new Set<string>();
      const rows: unknown[][] = [["email", "name", "source", "joined"]];
      for (const s of subs) if (!seen.has(s.email)) (seen.add(s.email), rows.push([s.email, "", s.source ?? "newsletter", s.createdAt]));
      for (const u of users) if (!seen.has(u.email)) (seen.add(u.email), rows.push([u.email, u.name ?? "", "account", u.createdAt]));
      body = csv(rows);
    } else if (kind === "customers") {
      actorId = (await assertPermission("customers.read")).id;
      const users = await db.user.findMany({ where: { isStaff: false, status: { not: "DELETED" } }, orderBy: { createdAt: "asc" }, include: { _count: { select: { orders: true } } } });
      body = csv([["email", "name", "phone", "status", "verified", "marketing_opt_in", "orders", "tags", "joined"], ...users.map((u) => [u.email, u.name, u.phone, u.status, !!u.emailVerifiedAt, u.marketingOptIn, u._count.orders, u.tags.join(" "), u.createdAt])]);
    } else {
      return new Response("Not found", { status: 404 });
    }
    await audit({ actorId, action: `export.${kind}`, entityType: "Export" });
    return new Response(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="otaku-bazaar-${kind}-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof ForbiddenError) return new Response("Forbidden", { status: 403 });
    throw err;
  }
}
