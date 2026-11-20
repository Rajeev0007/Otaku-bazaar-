"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { InventoryReason, ProductStatus } from "@prisma/client";
import { assertPermission, ForbiddenError } from "@/server/auth/session";
import { AdminError, deleteProduct, saveProduct, setProductStatus } from "@/server/admin/products";
import { adjustStock, InventoryError, setStock } from "@/server/inventory/service";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { fieldErrors } from "@/lib/validation";
import { slugify } from "@/lib/utils";
import { storeSettingsSchema, updateStoreSettings } from "@/server/settings";
import type { Permission } from "@/server/auth/permissions";

export type AdminResult<T = undefined> = { ok: true; message?: string; data?: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

async function guarded<T>(permission: Permission, fn: (actorId: string) => Promise<AdminResult<T>>): Promise<AdminResult<T>> {
  try {
    const user = await assertPermission(permission);
    return await fn(user.id);
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    if (err instanceof z.ZodError) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(err) };
    if (err instanceof AdminError || err instanceof InventoryError) return { ok: false, error: err.message };
    console.error("[admin]", err);
    return { ok: false, error: "Something went wrong. Nothing was saved." };
  }
}

// ── Products ──

export async function saveProductAction(productId: string | null, payload: unknown): Promise<AdminResult<{ id: string; slug: string }>> {
  return guarded("products.write", async (actorId) => {
    const p = await saveProduct(payload, actorId, productId ?? undefined);
    revalidatePath("/admin/products");
    revalidatePath(`/p/${p.slug}`);
    return { ok: true, message: productId ? "Product saved." : "Product created.", data: { id: p.id, slug: p.slug } };
  });
}

export async function deleteProductAction(productId: string): Promise<AdminResult> {
  return guarded("products.delete", async (actorId) => {
    const r = await deleteProduct(z.string().max(40).parse(productId), actorId);
    revalidatePath("/admin/products");
    return { ok: true, message: r === "archived" ? "Product has order history, so it was archived instead of deleted." : "Product deleted." };
  });
}

export async function bulkStatusAction(ids: string[], status: ProductStatus): Promise<AdminResult> {
  return guarded(status === "ARCHIVED" ? "products.delete" : "products.write", async (actorId) => {
    await setProductStatus(ids, z.nativeEnum(ProductStatus).parse(status), actorId);
    revalidatePath("/admin/products");
    return { ok: true, message: `${ids.length} product${ids.length === 1 ? "" : "s"} updated.` };
  });
}

// ── Inventory ──

const adjustSchema = z.object({
  variantId: z.string().max(40),
  mode: z.enum(["adjust", "set"]),
  quantity: z.coerce.number().int().min(-1_000_000).max(1_000_000),
  reason: z.nativeEnum(InventoryReason).default("ADJUSTMENT"),
  note: z.string().trim().max(300).optional(),
});

export async function adjustStockAction(raw: unknown): Promise<AdminResult<{ onHand: number }>> {
  return guarded("inventory.write", async (actorId) => {
    const input = adjustSchema.parse(raw);
    const onHand =
      input.mode === "set"
        ? await setStock(input.variantId, input.quantity, actorId, input.note)
        : await adjustStock({ variantId: input.variantId, delta: input.quantity, reason: input.reason, note: input.note, actorId });
    await audit({ actorId, action: "inventory.adjust", entityType: "ProductVariant", entityId: input.variantId, data: { ...input, onHandAfter: onHand } });
    revalidatePath("/admin/inventory");
    return { ok: true, message: `Stock updated to ${onHand}.`, data: { onHand } };
  });
}

export async function setThresholdAction(variantId: string, threshold: number): Promise<AdminResult> {
  return guarded("inventory.write", async (actorId) => {
    const t = z.number().int().min(0).max(10_000).parse(threshold);
    await db.inventoryItem.update({ where: { variantId: z.string().max(40).parse(variantId) }, data: { lowStockThreshold: t } });
    await audit({ actorId, action: "inventory.threshold", entityType: "ProductVariant", entityId: variantId, data: { threshold: t } });
    revalidatePath("/admin/inventory");
    return { ok: true, message: "Alert threshold saved." };
  });
}

// ── Catalog taxonomy ──

const taxonomySchema = z.object({
  kind: z.enum(["category", "franchise"]),
  id: z.string().max(40).optional(),
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(1000).optional(),
  imageUrl: z.string().trim().max(1000).optional(),
  parentId: z.string().max(40).optional(),
  accentColor: z.union([z.literal(""), z.string().regex(/^#[0-9a-fA-F]{6}$/)]).optional(),
  isTrending: z.boolean().optional(),
  isActive: z.boolean().optional(),
  showInMenu: z.boolean().optional(),
  position: z.coerce.number().int().min(0).max(1000).default(0),
  returnWindowDays: z.union([z.literal(""), z.coerce.number().int().min(0).max(365)]).optional(),
  seoTitle: z.string().trim().max(70).optional(),
  seoDescription: z.string().trim().max(170).optional(),
});

export async function saveTaxonomyAction(raw: unknown): Promise<AdminResult> {
  return guarded("catalog.write", async (actorId) => {
    const t = taxonomySchema.parse(raw);
    const slug = slugify(t.slug || t.name);
    if (!slug) return { ok: false, error: "Enter a valid name or slug." };
    const common = { name: t.name, slug, description: t.description || null, imageUrl: t.imageUrl || null, position: t.position, seoTitle: t.seoTitle || null, seoDescription: t.seoDescription || null };
    if (t.kind === "category") {
      if (t.parentId && t.parentId === t.id) return { ok: false, error: "A category can't be its own parent." };
      const data = { ...common, parentId: t.parentId || null, isActive: t.isActive ?? true, showInMenu: t.showInMenu ?? true, returnWindowDays: typeof t.returnWindowDays === "number" ? t.returnWindowDays : null };
      const clash = await db.category.findFirst({ where: { slug, ...(t.id ? { NOT: { id: t.id } } : {}) } });
      if (clash) return { ok: false, error: `The URL /c/${slug} is already used.` };
      const row = t.id ? await db.category.update({ where: { id: t.id }, data }) : await db.category.create({ data });
      await audit({ actorId, action: t.id ? "category.update" : "category.create", entityType: "Category", entityId: row.id, data: { name: row.name } });
    } else {
      const data = { ...common, accentColor: t.accentColor || null, isTrending: t.isTrending ?? false };
      const clash = await db.animeFranchise.findFirst({ where: { slug, ...(t.id ? { NOT: { id: t.id } } : {}) } });
      if (clash) return { ok: false, error: `The URL /anime/${slug} is already used.` };
      const row = t.id ? await db.animeFranchise.update({ where: { id: t.id }, data }) : await db.animeFranchise.create({ data });
      await audit({ actorId, action: t.id ? "franchise.update" : "franchise.create", entityType: "AnimeFranchise", entityId: row.id, data: { name: row.name } });
    }
    // Names feed product search text; re-sync affected products.
    if (t.id) {
      const { syncProductAggregates } = await import("@/server/catalog/sync");
      const products = await db.product.findMany({ where: t.kind === "category" ? { categoryId: t.id } : { franchiseId: t.id }, select: { id: true } });
      for (const p of products) await syncProductAggregates(p.id);
    }
    revalidatePath("/admin/catalog");
    revalidatePath("/", "layout");
    return { ok: true, message: "Saved." };
  });
}

export async function deleteTaxonomyAction(kind: "category" | "franchise", id: string): Promise<AdminResult> {
  return guarded("catalog.write", async (actorId) => {
    if (kind === "category") {
      const count = await db.product.count({ where: { categoryId: id } });
      if (count) return { ok: false, error: `Move or delete the ${count} product(s) in this category first.` };
      await db.category.updateMany({ where: { parentId: id }, data: { parentId: null } });
      await db.category.delete({ where: { id } });
    } else {
      await db.animeFranchise.delete({ where: { id } });
    }
    await audit({ actorId, action: `${kind}.delete`, entityType: kind === "category" ? "Category" : "AnimeFranchise", entityId: id });
    revalidatePath("/admin/catalog");
    revalidatePath("/", "layout");
    return { ok: true, message: "Deleted." };
  });
}

// ── Homepage & banners ──

export async function updateSectionAction(id: string, patch: { isActive?: boolean; title?: string; subtitle?: string; move?: "up" | "down" }): Promise<AdminResult> {
  return guarded("content.write", async (actorId) => {
    const p = z.object({ isActive: z.boolean().optional(), title: z.string().max(120).optional(), subtitle: z.string().max(240).optional(), move: z.enum(["up", "down"]).optional() }).parse(patch);
    const sections = await db.homepageSection.findMany({ orderBy: { position: "asc" } });
    const idx = sections.findIndex((s) => s.id === id);
    if (idx < 0) return { ok: false, error: "Section not found." };
    if (p.move) {
      const swap = p.move === "up" ? idx - 1 : idx + 1;
      if (swap >= 0 && swap < sections.length) {
        const order = [...sections];
        [order[idx], order[swap]] = [order[swap]!, order[idx]!];
        await db.$transaction(order.map((s, i) => db.homepageSection.update({ where: { id: s.id }, data: { position: i } })));
      }
    }
    if (p.isActive !== undefined || p.title !== undefined || p.subtitle !== undefined) {
      await db.homepageSection.update({ where: { id }, data: { isActive: p.isActive, title: p.title, subtitle: p.subtitle } });
    }
    await audit({ actorId, action: "homepage.section", entityType: "HomepageSection", entityId: id, data: p });
    revalidatePath("/");
    revalidatePath("/admin/homepage");
    return { ok: true, message: "Homepage updated." };
  });
}

const bannerSchema = z.object({
  id: z.string().max(40).optional(),
  placement: z.enum(["hero", "promo"]),
  title: z.string().trim().min(2).max(120),
  subtitle: z.string().trim().max(240).optional(),
  ctaLabel: z.string().trim().max(40).optional(),
  ctaHref: z.string().trim().max(300).refine((v) => !v || (v.startsWith("/") && !v.startsWith("//")) || v.startsWith("https://"), "Link must start with / or https://").optional(),
  imageUrl: z.string().trim().min(1).max(1000),
  position: z.coerce.number().int().min(0).max(100).default(0),
  isActive: z.boolean().default(true),
  startsAt: z.union([z.literal(""), z.coerce.date()]).optional(),
  endsAt: z.union([z.literal(""), z.coerce.date()]).optional(),
});

export async function saveBannerAction(raw: unknown): Promise<AdminResult> {
  return guarded("content.write", async (actorId) => {
    const b = bannerSchema.parse(raw);
    const data = {
      placement: b.placement,
      title: b.title,
      subtitle: b.subtitle || null,
      ctaLabel: b.ctaLabel || null,
      ctaHref: b.ctaHref || null,
      imageUrl: b.imageUrl,
      position: b.position,
      isActive: b.isActive,
      startsAt: b.startsAt instanceof Date ? b.startsAt : null,
      endsAt: b.endsAt instanceof Date ? b.endsAt : null,
    };
    const row = b.id ? await db.banner.update({ where: { id: b.id }, data }) : await db.banner.create({ data });
    await audit({ actorId, action: b.id ? "banner.update" : "banner.create", entityType: "Banner", entityId: row.id, data: { title: row.title } });
    revalidatePath("/");
    revalidatePath("/admin/homepage");
    return { ok: true, message: "Banner saved." };
  });
}

export async function deleteBannerAction(id: string): Promise<AdminResult> {
  return guarded("content.write", async (actorId) => {
    await db.banner.delete({ where: { id: z.string().max(40).parse(id) } });
    await audit({ actorId, action: "banner.delete", entityType: "Banner", entityId: id });
    revalidatePath("/");
    revalidatePath("/admin/homepage");
    return { ok: true, message: "Banner deleted." };
  });
}

// ── Pages ──

export async function savePageAction(raw: unknown): Promise<AdminResult> {
  return guarded("content.write", async (actorId) => {
    const p = z
      .object({
        id: z.string().max(40).optional(),
        title: z.string().trim().min(2).max(120),
        slug: z.string().trim().max(80).optional(),
        body: z.string().max(100_000),
        isPublished: z.boolean().default(true),
        seoTitle: z.string().trim().max(70).optional(),
        seoDescription: z.string().trim().max(170).optional(),
      })
      .parse(raw);
    const slug = slugify(p.slug || p.title);
    const clash = await db.page.findFirst({ where: { slug, ...(p.id ? { NOT: { id: p.id } } : {}) } });
    if (clash) return { ok: false, error: `The URL /pages/${slug} is already used.` };
    const data = { title: p.title, slug, body: p.body, isPublished: p.isPublished, seoTitle: p.seoTitle || null, seoDescription: p.seoDescription || null };
    const row = p.id ? await db.page.update({ where: { id: p.id }, data }) : await db.page.create({ data });
    await audit({ actorId, action: p.id ? "page.update" : "page.create", entityType: "Page", entityId: row.id, data: { slug } });
    revalidatePath(`/pages/${slug}`);
    revalidatePath("/admin/pages");
    return { ok: true, message: "Page saved." };
  });
}

// ── Settings ──

export async function saveSettingsAction(raw: unknown): Promise<AdminResult> {
  return guarded("settings.write", async (actorId) => {
    const patch = storeSettingsSchema.partial().parse(raw);
    await updateStoreSettings(patch);
    await audit({ actorId, action: "settings.update", entityType: "Setting", entityId: "store", data: patch as object });
    revalidatePath("/", "layout");
    return { ok: true, message: "Settings saved." };
  });
}

// ── Staff ──

export async function setStaffRolesAction(email: string, roleKeys: string[]): Promise<AdminResult> {
  return guarded("staff.manage", async (actorId) => {
    const e = z.string().trim().toLowerCase().email().parse(email);
    const keys = z.array(z.string().max(40)).max(10).parse(roleKeys);
    const user = await db.user.findUnique({ where: { email: e } });
    if (!user) return { ok: false, error: "No account with that email. Ask them to register first." };
    if (user.id === actorId && !keys.includes("super_admin")) {
      const otherSupers = await db.userRole.count({ where: { role: { key: "super_admin" }, NOT: { userId: actorId } } });
      if (!otherSupers) return { ok: false, error: "You are the only Super Admin. Assign another Super Admin before removing your own access." };
    }
    const roles = await db.role.findMany({ where: { key: { in: keys } } });
    await db.$transaction([
      db.userRole.deleteMany({ where: { userId: user.id } }),
      ...roles.map((r) => db.userRole.create({ data: { userId: user.id, roleId: r.id } })),
      db.user.update({ where: { id: user.id }, data: { isStaff: roles.length > 0 } }),
      // Force re-login so new permissions apply immediately and removed access is revoked.
      ...(user.id === actorId ? [] : [db.session.deleteMany({ where: { userId: user.id } })]),
    ]);
    await audit({ actorId, action: "staff.roles", entityType: "User", entityId: user.id, data: { email: e, roles: keys } });
    revalidatePath("/admin/staff");
    return { ok: true, message: roles.length ? `${e} now has: ${roles.map((r) => r.name).join(", ")}.` : `Removed staff access for ${e}.` };
  });
}
