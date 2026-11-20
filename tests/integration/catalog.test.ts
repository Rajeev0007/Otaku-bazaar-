import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { listProducts } from "@/server/catalog/queries";
import { searchProductIds } from "@/server/catalog/search";
import { saveProduct, AdminError } from "@/server/admin/products";
import { parseFilters } from "@/lib/catalog-filters";
import { makeProduct, makeUser } from "./helpers";

afterAll(() => db.$disconnect());

describe("admin product management", () => {
  it("creates a product with variants, stock ledger, search text and audit entry", async () => {
    const admin = await makeUser();
    const { category } = await makeProduct();
    const sku = `ADM-${Date.now()}`;
    const run = Date.now().toString(36);
    const p = await saveProduct(
      {
        name: `Integration Kitsune Hoodie ${run}`,
        description: "A cosy hoodie for tests.",
        status: "ACTIVE",
        categoryId: category.id,
        tags: ["Winter"],
        images: [{ url: "/img/logo.png", alt: "" }],
        variants: [
          { sku: `${sku}-M`, size: "M", color: "Black", price: "1999", compareAtPrice: "2499", stock: 4 },
          { sku: `${sku}-L`, size: "L", color: "Black", price: "1999", compareAtPrice: "", stock: 0 },
        ],
      },
      admin.id,
    );
    const saved = await db.product.findUniqueOrThrow({ where: { id: p.id }, include: { variants: { include: { inventory: { include: { transactions: true } } } } } });
    expect(saved.slug).toBe(`integration-kitsune-hoodie-${run}`);
    expect(saved.minPrice).toBe(199_900);
    expect(saved.discountPercent).toBe(20);
    expect(saved.inStock).toBe(true);
    expect(saved.searchText).toContain(sku.toLowerCase());
    expect(saved.variants.find((v) => v.size === "M")!.inventory!.transactions[0]!.reason).toBe("INITIAL");
    expect(await db.auditLog.count({ where: { entityId: p.id, action: "product.create" } })).toBe(1);
    expect((await searchProductIds("kitsune hoodi")).includes(p.id)).toBe(true);
  });

  it("rejects duplicate SKUs and invalid compare-at prices", async () => {
    const admin = await makeUser();
    const { category, variants } = await makeProduct();
    await expect(
      saveProduct({ name: "Dup", description: "Duplicate sku test", categoryId: category.id, variants: [{ sku: variants[0]!.sku, price: "100" }] }, admin.id),
    ).rejects.toThrow(AdminError);
    await expect(
      saveProduct({ name: "Bad price", description: "Compare at lower", categoryId: category.id, variants: [{ sku: `BAD-${Date.now()}`, price: "500", compareAtPrice: "400" }] }, admin.id),
    ).rejects.toThrow(/Compare-at/);
  });
});

describe("listing filters", () => {
  it("combines category, size and stock filters", async () => {
    const { category, product } = await makeProduct({ stock: [0, 3] }); // S out, M in
    const { syncProductAggregates } = await import("@/server/catalog/sync");
    await syncProductAggregates(product.id);
    const inM = await listProducts(parseFilters(new URLSearchParams(`category=${category.slug}&size=M&instock=1`)));
    expect(inM.products.map((p) => p.id)).toContain(product.id);
    const inXL = await listProducts(parseFilters(new URLSearchParams(`category=${category.slug}&size=XL`)));
    expect(inXL.total).toBe(0);
  });

  it("hides drafts and products scheduled in the future", async () => {
    const draft = await makeProduct({ status: "DRAFT" });
    const future = await makeProduct();
    await db.product.update({ where: { id: future.product.id }, data: { launchAt: new Date(Date.now() + 86_400_000) } });
    const r1 = await listProducts(parseFilters(new URLSearchParams(`category=${draft.category.slug}`)));
    const r2 = await listProducts(parseFilters(new URLSearchParams(`category=${future.category.slug}`)));
    expect(r1.total + r2.total).toBe(0);
  });
});
