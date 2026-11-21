import { Prisma } from "@prisma/client";
import { db } from "@/server/db";

/**
 * Store reports for the admin. "Sales" are placed orders that were not cancelled (online orders
 * once paid, COD orders when placed). Amounts are what the customer paid on the order, in paise.
 */
export const COUNTED_ORDER: Prisma.OrderWhereInput = { placedAt: { not: null }, status: { notIn: ["PENDING_PAYMENT", "CANCELLED"] } };

export function periodStart(days: number, now = new Date()) {
  return new Date(now.getTime() - days * 86_400_000);
}

export async function salesSummary(since: Date) {
  const where: Prisma.OrderWhereInput = { ...COUNTED_ORDER, placedAt: { gte: since } };
  const [agg, refunds] = await Promise.all([
    db.order.aggregate({ where, _sum: { grandTotal: true, discountTotal: true, giftCardTotal: true, loyaltyTotal: true }, _count: true }),
    db.refund.aggregate({ where: { status: "SUCCEEDED", createdAt: { gte: since } }, _sum: { amount: true } }),
  ]);
  const revenue = agg._sum.grandTotal ?? 0;
  return {
    orders: agg._count,
    revenue,
    aov: agg._count ? Math.round(revenue / agg._count) : 0,
    discounts: agg._sum.discountTotal ?? 0,
    giftCards: agg._sum.giftCardTotal ?? 0,
    points: agg._sum.loyaltyTotal ?? 0,
    refunds: refunds._sum.amount ?? 0,
  };
}

/** Revenue and order count per day (India time), with empty days filled in. */
export async function dailySales(days: number, now = new Date()) {
  const since = periodStart(days, now);
  const rows = await db.$queryRaw<{ day: string; revenue: bigint; orders: bigint }[]>`
    SELECT to_char(("placedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day,
           COALESCE(SUM("grandTotal"), 0)::bigint AS revenue, COUNT(*)::bigint AS orders
    FROM "Order"
    WHERE "placedAt" >= ${since} AND "status" NOT IN ('PENDING_PAYMENT', 'CANCELLED')
    GROUP BY 1 ORDER BY 1`;
  const byDay = new Map(rows.map((r) => [r.day, { revenue: Number(r.revenue), orders: Number(r.orders) }]));
  const out: { day: string; revenue: number; orders: number }[] = [];
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
  for (let i = days - 1; i >= 0; i--) {
    const day = fmt.format(new Date(now.getTime() - i * 86_400_000));
    out.push({ day, ...(byDay.get(day) ?? { revenue: 0, orders: 0 }) });
  }
  return out;
}

/** Distinct browsing sessions reaching each step, plus orders placed in the same period. */
export async function funnel(since: Date) {
  const rows = await db.$queryRaw<{ name: string; sessions: bigint }[]>`
    SELECT "name", COUNT(DISTINCT "sessionId")::bigint AS sessions
    FROM "AnalyticsEvent"
    WHERE "createdAt" >= ${since} AND "sessionId" IS NOT NULL
      AND "name" IN ('page_view', 'product_view', 'add_to_cart', 'begin_checkout')
    GROUP BY "name"`;
  const n = (k: string) => Number(rows.find((r) => r.name === k)?.sessions ?? 0);
  const orders = await db.order.count({ where: { ...COUNTED_ORDER, placedAt: { gte: since } } });
  const visits = Math.max(n("page_view"), n("product_view"), n("add_to_cart"), n("begin_checkout"));
  return [
    { step: "Visited the store", count: visits },
    { step: "Viewed a product", count: n("product_view") },
    { step: "Added to cart", count: n("add_to_cart") },
    { step: "Started checkout", count: n("begin_checkout") },
    { step: "Placed an order", count: orders },
  ];
}

export async function topProducts(since: Date, take = 10) {
  const rows = await db.$queryRaw<{ productId: string | null; name: string; units: bigint; revenue: bigint }[]>`
    SELECT v."productId" AS "productId", MAX(oi."productName") AS name,
           SUM(oi."quantity" - oi."returnedQty")::bigint AS units, SUM(oi."total")::bigint AS revenue
    FROM "OrderItem" oi
    JOIN "Order" o ON o."id" = oi."orderId"
    LEFT JOIN "ProductVariant" v ON v."id" = oi."variantId"
    WHERE o."placedAt" >= ${since} AND o."status" NOT IN ('PENDING_PAYMENT', 'CANCELLED')
    GROUP BY v."productId", CASE WHEN v."productId" IS NULL THEN oi."productName" END
    ORDER BY revenue DESC
    LIMIT ${take}`;
  return rows.map((r) => ({ productId: r.productId, name: r.name, units: Number(r.units), revenue: Number(r.revenue) }));
}

export async function mostViewed(since: Date, take = 10) {
  const rows = await db.analyticsEvent.groupBy({
    by: ["productId"],
    where: { name: "product_view", createdAt: { gte: since }, productId: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { productId: "desc" } },
    take,
  });
  const ids = rows.map((r) => r.productId!).filter(Boolean);
  const products = await db.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  const carts = await db.analyticsEvent.groupBy({ by: ["productId"], where: { name: "add_to_cart", createdAt: { gte: since }, productId: { in: ids } }, _count: { _all: true } });
  return rows.map((r) => ({
    productId: r.productId!,
    name: products.find((p) => p.id === r.productId)?.name ?? "Deleted product",
    views: r._count._all,
    addToCarts: carts.find((c) => c.productId === r.productId)?._count._all ?? 0,
  }));
}

export async function searches(since: Date, take = 10) {
  const [top, zero] = await Promise.all([
    db.$queryRaw<{ query: string; count: bigint; avgResults: number }[]>`
      SELECT lower("query") AS query, COUNT(*)::bigint AS count, AVG("resultCount")::float AS "avgResults"
      FROM "SearchQuery" WHERE "createdAt" >= ${since}
      GROUP BY 1 ORDER BY count DESC LIMIT ${take}`,
    db.$queryRaw<{ query: string; count: bigint }[]>`
      SELECT lower("query") AS query, COUNT(*)::bigint AS count
      FROM "SearchQuery" WHERE "createdAt" >= ${since} AND "resultCount" = 0
      GROUP BY 1 ORDER BY count DESC LIMIT ${take}`,
  ]);
  return {
    top: top.map((r) => ({ query: r.query, count: Number(r.count), avgResults: Math.round(r.avgResults) })),
    zero: zero.map((r) => ({ query: r.query, count: Number(r.count) })),
  };
}

export async function couponUsage(since: Date, take = 10) {
  const rows = await db.couponRedemption.groupBy({
    by: ["couponId"],
    where: { createdAt: { gte: since }, order: COUNTED_ORDER },
    _count: { _all: true },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
    take,
  });
  const coupons = await db.coupon.findMany({ where: { id: { in: rows.map((r) => r.couponId) } }, select: { id: true, code: true } });
  return rows.map((r) => ({ code: coupons.find((c) => c.id === r.couponId)?.code ?? "?", uses: r._count._all, discount: r._sum.amount ?? 0 }));
}

/** Where sessions came from: utm_source first, then the referring site, otherwise "Direct". */
export async function trafficSources(since: Date, take = 8) {
  const rows = await db.$queryRaw<{ source: string; sessions: bigint }[]>`
    SELECT source, COUNT(*)::bigint AS sessions FROM (
      SELECT "sessionId", COALESCE(MAX("utmSource"), MAX("referrer"), 'Direct') AS source
      FROM "AnalyticsEvent"
      WHERE "createdAt" >= ${since} AND "sessionId" IS NOT NULL
      GROUP BY "sessionId"
    ) s GROUP BY source ORDER BY sessions DESC LIMIT ${take}`;
  return rows.map((r) => ({ source: r.source, sessions: Number(r.sessions) }));
}

/** Customers (by email) who ordered in the period, and how many of them had ordered before. */
export async function repeatCustomers(since: Date) {
  const rows = await db.$queryRaw<{ customers: bigint; repeat: bigint }[]>`
    WITH p AS (
      SELECT DISTINCT lower("email") AS email FROM "Order"
      WHERE "placedAt" >= ${since} AND "status" NOT IN ('PENDING_PAYMENT', 'CANCELLED')
    )
    SELECT COUNT(*)::bigint AS customers,
           COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM "Order" o WHERE lower(o."email") = p.email AND o."placedAt" < ${since}
               AND o."status" NOT IN ('PENDING_PAYMENT', 'CANCELLED')
           ) OR (
             SELECT COUNT(*) FROM "Order" o WHERE lower(o."email") = p.email AND o."placedAt" >= ${since}
               AND o."status" NOT IN ('PENDING_PAYMENT', 'CANCELLED')
           ) > 1)::bigint AS repeat
    FROM p`;
  const r = rows[0];
  return { customers: Number(r?.customers ?? 0), repeat: Number(r?.repeat ?? 0) };
}

/** Carts with items that haven't been touched for an hour and never became an order. */
export async function abandonedCarts(since: Date, take = 10) {
  const where: Prisma.CartWhereInput = {
    status: { in: ["ACTIVE", "ABANDONED"] },
    lastActivityAt: { gte: since, lt: new Date(Date.now() - 3_600_000) },
    items: { some: { savedForLater: false } },
  };
  const [count, recent] = await Promise.all([
    db.cart.count({ where }),
    db.cart.findMany({
      where,
      orderBy: { lastActivityAt: "desc" },
      take,
      select: {
        id: true,
        email: true,
        lastActivityAt: true,
        user: { select: { email: true, name: true } },
        items: { where: { savedForLater: false }, select: { quantity: true } },
      },
    }),
  ]);
  return {
    count,
    recent: recent.map((c) => ({
      id: c.id,
      who: c.user?.name || c.user?.email || c.email || "Guest",
      items: c.items.reduce((s, i) => s + i.quantity, 0),
      lastActivityAt: c.lastActivityAt,
    })),
  };
}
