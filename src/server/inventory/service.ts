import { InventoryReason, Prisma } from "@prisma/client";
import { db, type Tx } from "@/server/db";
import { syncProductAggregates } from "@/server/catalog/sync";

export class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryError";
  }
}

export type StockInfo = { onHand: number; reserved: number; allowBackorder: boolean } | null | undefined;

/** Units a shopper can buy right now. Backorderable items are capped only by the per-line limit. */
export function availableQuantity(inv: StockInfo): number {
  if (!inv) return 0;
  if (inv.allowBackorder) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, inv.onHand - inv.reserved);
}

/**
 * Atomically changes on-hand stock and writes a ledger entry.
 * The UPDATE refuses to take on-hand below reserved units, which prevents overselling under concurrency.
 */
export async function adjustStock(
  input: { variantId: string; delta: number; reason: InventoryReason; note?: string; actorId?: string; refType?: string; refId?: string },
  tx?: Tx,
) {
  if (!Number.isInteger(input.delta) || input.delta === 0) throw new InventoryError("Adjustment must be a non-zero whole number.");
  const run = async (t: Tx) => {
    const rows = await t.$queryRaw<{ id: string; onHand: number; productId: string }[]>(Prisma.sql`
      UPDATE "InventoryItem" i SET "onHand" = i."onHand" + ${input.delta}, "updatedAt" = now()
      FROM "ProductVariant" v
      WHERE i."variantId" = ${input.variantId} AND v."id" = i."variantId"
        AND i."onHand" + ${input.delta} >= GREATEST(i."reserved", 0)
      RETURNING i."id", i."onHand", v."productId"`);
    const row = rows[0];
    if (!row) {
      const exists = await t.inventoryItem.findUnique({ where: { variantId: input.variantId } });
      throw new InventoryError(exists ? "Not enough stock for this adjustment (units are reserved by open orders)." : "Inventory record not found.");
    }
    await t.inventoryTransaction.create({
      data: {
        inventoryId: row.id,
        delta: input.delta,
        onHandAfter: row.onHand,
        reason: input.reason,
        note: input.note?.slice(0, 500),
        actorId: input.actorId,
        refType: input.refType,
        refId: input.refId,
      },
    });
    await syncProductAggregates(row.productId, t);
    return row.onHand;
  };
  return tx ? run(tx) : db.$transaction(run);
}

/** Sets on-hand to an absolute count (stocktake), recording the difference. */
export async function setStock(variantId: string, onHand: number, actorId?: string, note?: string) {
  if (!Number.isInteger(onHand) || onHand < 0) throw new InventoryError("Stock must be zero or a positive whole number.");
  return db.$transaction(async (tx) => {
    const inv = await tx.inventoryItem.findUnique({ where: { variantId } });
    if (!inv) throw new InventoryError("Inventory record not found.");
    const delta = onHand - inv.onHand;
    if (delta === 0) return inv.onHand;
    return adjustStock({ variantId, delta, reason: InventoryReason.CORRECTION, actorId, note: note ?? "Stock count" }, tx);
  });
}

export async function lowStockVariants(limit = 20) {
  return db.$queryRaw<{ variantId: string; sku: string; title: string; productName: string; productId: string; available: number; threshold: number }[]>`
    SELECT v."id" AS "variantId", v."sku", v."title", p."name" AS "productName", p."id" AS "productId",
           (i."onHand" - i."reserved")::int AS "available", i."lowStockThreshold" AS "threshold"
    FROM "InventoryItem" i
    JOIN "ProductVariant" v ON v."id" = i."variantId"
    JOIN "Product" p ON p."id" = v."productId"
    WHERE p."status" <> 'ARCHIVED' AND v."isActive" AND i."onHand" - i."reserved" <= i."lowStockThreshold"
    ORDER BY (i."onHand" - i."reserved") ASC, p."name"
    LIMIT ${limit}`;
}
