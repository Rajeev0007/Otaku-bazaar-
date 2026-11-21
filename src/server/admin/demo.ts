import { db } from "@/server/db";
import { deleteProduct } from "@/server/admin/products";

/** Loads the 84 demo products (tagged "demo"). Safe to run twice: existing ones are kept. */
export async function loadDemoCatalog() {
  const seed = await import("../../../prisma/seed");
  await seed.seedProducts();
  await seed.seedCollections();
  await seed.syncAggregates();
  return db.product.count({ where: { tags: { has: "demo" } } });
}

/** Removes demo products: deletes them, or archives any that already appear in orders. */
export async function removeDemoCatalog(actorId: string) {
  const demo = await db.product.findMany({ where: { tags: { has: "demo" }, status: { not: "ARCHIVED" } }, select: { id: true } });
  let deleted = 0;
  let archived = 0;
  for (const p of demo) {
    (await deleteProduct(p.id, actorId)) === "deleted" ? deleted++ : archived++;
  }
  // Demo reviews belong to demo products and are removed with them; drop leftovers on archived ones too.
  await db.review.deleteMany({ where: { product: { tags: { has: "demo" } }, isVerified: false } });
  return { deleted, archived };
}
