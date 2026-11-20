import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { adjustStock, InventoryError, setStock } from "@/server/inventory/service";
import { makeProduct } from "./helpers";

afterAll(() => db.$disconnect());

describe("inventory", () => {
  it("records every change in the ledger and keeps product stock flags in sync", async () => {
    const { product, variants } = await makeProduct({ stock: [2] });
    const v = variants[0]!;
    await adjustStock({ variantId: v.id, delta: -2, reason: "ADJUSTMENT" });
    expect((await db.product.findUnique({ where: { id: product.id } }))!.inStock).toBe(false);
    await adjustStock({ variantId: v.id, delta: 10, reason: "RESTOCK", note: "PO-1" });
    expect((await db.product.findUnique({ where: { id: product.id } }))!.inStock).toBe(true);
    const ledger = await db.inventoryTransaction.findMany({ where: { inventory: { variantId: v.id } }, orderBy: { createdAt: "asc" } });
    expect(ledger.map((l) => [l.delta, l.onHandAfter])).toEqual([[-2, 0], [10, 10]]);
  });

  it("never lets on-hand drop below zero or below reserved units", async () => {
    const { variants } = await makeProduct({ stock: [3] });
    const v = variants[0]!;
    await expect(adjustStock({ variantId: v.id, delta: -4, reason: "DAMAGE" })).rejects.toThrow(InventoryError);
    await db.inventoryItem.update({ where: { variantId: v.id }, data: { reserved: 2 } });
    await expect(adjustStock({ variantId: v.id, delta: -2, reason: "DAMAGE" })).rejects.toThrow(/reserved/);
    expect((await db.inventoryItem.findUnique({ where: { variantId: v.id } }))!.onHand).toBe(3);
  });

  it("is safe under concurrent decrements (no overselling)", async () => {
    const { variants } = await makeProduct({ stock: [5] });
    const v = variants[0]!;
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => adjustStock({ variantId: v.id, delta: -1, reason: "SALE" })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    expect((await db.inventoryItem.findUnique({ where: { variantId: v.id } }))!.onHand).toBe(0);
  });

  it("stock counts record the difference", async () => {
    const { variants } = await makeProduct({ stock: [7] });
    await setStock(variants[0]!.id, 4, undefined, "Cycle count");
    const last = await db.inventoryTransaction.findFirst({ where: { inventory: { variantId: variants[0]!.id } }, orderBy: { createdAt: "desc" } });
    expect(last).toMatchObject({ delta: -3, onHandAfter: 4, reason: "CORRECTION" });
  });
});
