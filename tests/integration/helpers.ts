import { db } from "@/server/db";
import { randomToken } from "@/server/security/crypto";

/** Creates an isolated category + product with variants and stock for a test. */
export async function makeProduct(opts: { stock?: number[]; status?: "ACTIVE" | "DRAFT"; price?: number } = {}) {
  const tag = randomToken(6).replace(/[^a-zA-Z0-9]/g, "x").toLowerCase();
  const category = await db.category.create({ data: { slug: `test-cat-${tag}`, name: `Test ${tag}` } });
  const stock = opts.stock ?? [5];
  const product = await db.product.create({
    data: {
      slug: `test-product-${tag}`,
      name: `Test Product ${tag}`,
      description: "Integration test product",
      status: opts.status ?? "ACTIVE",
      categoryId: category.id,
      variants: {
        create: stock.map((onHand, i) => ({
          sku: `TEST-${tag}-${i}`.toUpperCase(),
          title: `V${i}`,
          size: ["S", "M", "L", "XL"][i] ?? null,
          price: opts.price ?? 49_900,
          position: i,
          inventory: { create: { onHand } },
        })),
      },
    },
    include: { variants: { orderBy: { position: "asc" }, include: { inventory: true } } },
  });
  return { product, category, variants: product.variants };
}

export async function makeUser(email?: string) {
  const e = email ?? `user-${randomToken(6).replace(/[^a-zA-Z0-9]/g, "x").toLowerCase()}@test.local`;
  return db.user.create({ data: { email: e, name: "Test User", wishlists: { create: {} } } });
}
