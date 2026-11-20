// Admin product management (framework-independent). All writes are validated, transactional and audited.
import { InventoryReason, Prisma, ProductKind, ProductStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { syncProductAggregates } from "@/server/catalog/sync";
import { slugify } from "@/lib/utils";

const money = z.coerce.number().min(0).max(10_000_000).transform((rupees) => Math.round(rupees * 100));
const optionalMoney = z.union([z.literal(""), z.null(), z.undefined(), money]).transform((v) => (typeof v === "number" ? v : null));
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));

export const variantInput = z.object({
  id: z.string().max(40).optional(),
  sku: z.string().trim().min(2).max(64).regex(/^[A-Za-z0-9._-]+$/, "SKU may contain letters, numbers, dot, dash and underscore"),
  title: z.string().trim().max(80).optional(),
  size: optionalText(20),
  color: optionalText(40),
  colorHex: z.union([z.literal(""), z.string().regex(/^#[0-9a-fA-F]{6}$/)]).optional().transform((v) => v || null),
  style: optionalText(60),
  price: money,
  compareAtPrice: optionalMoney,
  costPrice: optionalMoney,
  stock: z.coerce.number().int().min(0).max(1_000_000).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).max(10_000).default(5),
  allowBackorder: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const productInput = z
  .object({
    name: z.string().trim().min(2).max(160),
    slug: z.string().trim().max(100).optional(),
    subtitle: optionalText(200),
    description: z.string().trim().min(10, "Write at least a short description").max(20_000),
    kind: z.nativeEnum(ProductKind).default("STANDARD"),
    status: z.nativeEnum(ProductStatus).default("DRAFT"),
    categoryId: z.string().min(1, "Choose a category").max(40),
    franchiseId: optionalText(40),
    brandId: optionalText(40),
    tags: z.array(z.string().trim().toLowerCase().max(40)).max(30).default([]),
    material: optionalText(300),
    careInstructions: optionalText(1000),
    dimensions: optionalText(200),
    weightGrams: z.coerce.number().int().min(1).max(100_000).default(250),
    warranty: optionalText(300),
    authenticity: optionalText(500),
    videoUrl: z.union([z.literal(""), z.string().url().max(500)]).optional().transform((v) => v || null),
    returnable: z.boolean().default(true),
    returnWindowDays: z.union([z.literal(""), z.coerce.number().int().min(0).max(365)]).optional().transform((v) => (typeof v === "number" ? v : null)),
    isFeatured: z.boolean().default(false),
    isLimited: z.boolean().default(false),
    isNewArrival: z.boolean().default(false),
    seoTitle: optionalText(70),
    seoDescription: optionalText(170),
    launchAt: z.union([z.literal(""), z.coerce.date()]).optional().transform((v) => (v instanceof Date ? v : null)),
    images: z.array(z.object({ url: z.string().min(1).max(1000), alt: z.string().trim().max(200).default("") })).max(20).default([]),
    variants: z.array(variantInput).min(1, "Add at least one variant").max(100),
  })
  .superRefine((p, ctx) => {
    const skus = p.variants.map((v) => v.sku.toUpperCase());
    if (new Set(skus).size !== skus.length) ctx.addIssue({ code: "custom", path: ["variants"], message: "Each variant needs a unique SKU." });
    p.variants.forEach((v, i) => {
      if (v.compareAtPrice !== null && v.compareAtPrice <= v.price) ctx.addIssue({ code: "custom", path: ["variants", i, "compareAtPrice"], message: "Compare-at price must be higher than the price." });
    });
    if (p.status === "SCHEDULED" && !p.launchAt) ctx.addIssue({ code: "custom", path: ["launchAt"], message: "Set a launch date for scheduled products." });
    for (const img of p.images) {
      if (!(img.url.startsWith("/") || /^https:\/\//.test(img.url))) ctx.addIssue({ code: "custom", path: ["images"], message: "Image URLs must be https:// or start with /." });
    }
  });

export type ProductInput = z.input<typeof productInput>;

export class AdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminError";
  }
}

function variantTitle(v: { title?: string | null; color: string | null; size: string | null; style: string | null }) {
  return v.title?.trim() || [v.color, v.size, v.style].filter(Boolean).join(" / ") || "Default";
}

async function uniqueSlug(base: string, excludeId?: string) {
  const root = slugify(base) || "product";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const clash = await db.product.findFirst({ where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) }, select: { id: true } });
    if (!clash) return candidate;
  }
  throw new AdminError("Could not generate a unique URL slug.");
}

export async function saveProduct(raw: unknown, actorId: string, productId?: string) {
  const input = productInput.parse(raw);
  const slug = await uniqueSlug(input.slug || input.name, productId);
  const skuClash = await db.productVariant.findFirst({
    where: { sku: { in: input.variants.map((v) => v.sku), mode: "insensitive" }, ...(productId ? { NOT: { productId } } : {}) },
    select: { sku: true },
  });
  if (skuClash) throw new AdminError(`SKU ${skuClash.sku} is already used by another product.`);

  const data = {
    name: input.name,
    slug,
    subtitle: input.subtitle,
    description: input.description,
    kind: input.kind,
    status: input.status,
    categoryId: input.categoryId,
    franchiseId: input.franchiseId,
    brandId: input.brandId,
    tags: [...new Set(input.tags.filter(Boolean))],
    material: input.material,
    careInstructions: input.careInstructions,
    dimensions: input.dimensions,
    weightGrams: input.weightGrams,
    warranty: input.warranty,
    authenticity: input.authenticity,
    videoUrl: input.videoUrl,
    returnable: input.returnable,
    returnWindowDays: input.returnWindowDays,
    isFeatured: input.isFeatured,
    isLimited: input.isLimited,
    isNewArrival: input.isNewArrival,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    launchAt: input.launchAt,
  } satisfies Prisma.ProductUncheckedUpdateInput;

  return db.$transaction(async (tx) => {
    const existing = productId ? await tx.product.findUnique({ where: { id: productId }, include: { variants: { include: { inventory: true } } } }) : null;
    if (productId && !existing) throw new AdminError("Product not found.");

    const product = existing
      ? await tx.product.update({ where: { id: existing.id }, data: { ...data, publishedAt: existing.publishedAt ?? (input.status === "ACTIVE" ? new Date() : null) } })
      : await tx.product.create({ data: { ...data, currency: "INR", publishedAt: input.status === "ACTIVE" ? new Date() : null } });

    // Images: replace the ordered list (customer photos are untouched).
    await tx.productImage.deleteMany({ where: { productId: product.id, isCustomerPhoto: false } });
    if (input.images.length) {
      await tx.productImage.createMany({ data: input.images.map((img, i) => ({ productId: product.id, url: img.url, alt: img.alt || `${input.name} — image ${i + 1}`, position: i })) });
    }

    // Variants: update by id, create new, deactivate removed ones (kept for order history).
    const keepIds = new Set<string>();
    for (const [i, v] of input.variants.entries()) {
      const fields = {
        sku: v.sku,
        title: variantTitle(v),
        size: v.size,
        color: v.color,
        colorHex: v.colorHex,
        style: v.style,
        price: v.price,
        compareAtPrice: v.compareAtPrice,
        costPrice: v.costPrice,
        position: i,
        isActive: v.isActive,
      };
      const current = v.id ? existing?.variants.find((x) => x.id === v.id) : undefined;
      if (current) {
        keepIds.add(current.id);
        await tx.productVariant.update({ where: { id: current.id }, data: fields });
        await tx.inventoryItem.upsert({
          where: { variantId: current.id },
          create: { variantId: current.id, onHand: 0, lowStockThreshold: v.lowStockThreshold, allowBackorder: v.allowBackorder },
          update: { lowStockThreshold: v.lowStockThreshold, allowBackorder: v.allowBackorder },
        });
      } else {
        const created = await tx.productVariant.create({ data: { ...fields, productId: product.id } });
        keepIds.add(created.id);
        const onHand = v.stock ?? 0;
        await tx.inventoryItem.create({
          data: {
            variantId: created.id,
            onHand,
            lowStockThreshold: v.lowStockThreshold,
            allowBackorder: v.allowBackorder,
            transactions: onHand ? { create: { delta: onHand, onHandAfter: onHand, reason: InventoryReason.INITIAL, actorId, note: "Initial stock" } } : undefined,
          },
        });
      }
    }
    if (existing) {
      const removed = existing.variants.filter((v) => !keepIds.has(v.id)).map((v) => v.id);
      if (removed.length) await tx.productVariant.updateMany({ where: { id: { in: removed } }, data: { isActive: false } });
    }

    await syncProductAggregates(product.id, tx);
    await audit({ actorId, action: existing ? "product.update" : "product.create", entityType: "Product", entityId: product.id, data: { name: product.name, status: product.status } }, tx);
    return product;
  });
}

/** Archives products that have order history (keeps references intact); hard-deletes the rest. */
export async function deleteProduct(productId: string, actorId: string) {
  return db.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId }, include: { variants: { select: { id: true, _count: { select: { orderItems: true } } } } } });
    if (!product) throw new AdminError("Product not found.");
    const hasOrders = product.variants.some((v) => v._count.orderItems > 0);
    if (hasOrders) {
      await tx.product.update({ where: { id: productId }, data: { status: "ARCHIVED" } });
      await audit({ actorId, action: "product.archive", entityType: "Product", entityId: productId, data: { name: product.name, reason: "has orders" } }, tx);
      return "archived" as const;
    }
    await tx.product.delete({ where: { id: productId } });
    await audit({ actorId, action: "product.delete", entityType: "Product", entityId: productId, data: { name: product.name } }, tx);
    return "deleted" as const;
  });
}

export async function setProductStatus(productIds: string[], status: ProductStatus, actorId: string) {
  const ids = z.array(z.string().max(40)).max(200).parse(productIds);
  await db.$transaction(async (tx) => {
    await tx.product.updateMany({ where: { id: { in: ids } }, data: { status, ...(status === "ACTIVE" ? { publishedAt: new Date() } : {}) } });
    await audit({ actorId, action: "product.bulk_status", entityType: "Product", data: { ids, status } }, tx);
  });
}
