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

/** Fire-and-forget back-in-stock emails after anything that may add stock. */
async function afterStockChange() {
  const { sendDueStockAlerts } = await import("@/server/inventory/alerts");
  await sendDueStockAlerts().catch((e) => console.error("[stock alerts]", e));
}

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
    await afterStockChange();
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
    await afterStockChange();
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

// ── Integrations (email, Google) ──

export async function saveIntegrationsAction(raw: unknown): Promise<AdminResult> {
  return guarded("settings.write", async (actorId) => {
    const { saveIntegrations } = await import("@/server/integrations");
    try {
      await saveIntegrations(raw);
    } catch (err) {
      if (err instanceof Error && !(err instanceof z.ZodError)) return { ok: false, error: err.message };
      throw err;
    }
    // Never log secret values.
    await audit({ actorId, action: "settings.integrations", entityType: "Setting", entityId: "integrations" });
    revalidatePath("/admin/integrations");
    return { ok: true, message: "Integrations saved." };
  });
}

export async function sendTestEmailAction(): Promise<AdminResult> {
  return guarded("settings.write", async () => {
    const { getCurrentUser } = await import("@/server/auth/session");
    const { sendEmail, emailLayout } = await import("@/server/email");
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Please sign in." };
    const ok = await sendEmail({
      to: user.email,
      userId: user.id,
      template: "admin.test",
      subject: "Test email from The Otaku Bazaar",
      text: "Email sending works.",
      html: emailLayout("Email works 🎉", "<p>Your store can send emails.</p>"),
    });
    return ok ? { ok: true, message: `Test email sent to ${user.email}.` } : { ok: false, error: "Sending failed. Check the API key and that your domain is verified in Resend (see Admin → Integrations)." };
  });
}

// ── Demo catalog ──

export async function loadDemoCatalogAction(): Promise<AdminResult> {
  return guarded("products.write", async (actorId) => {
    const { loadDemoCatalog } = await import("@/server/admin/demo");
    const n = await loadDemoCatalog();
    await audit({ actorId, action: "demo.load", entityType: "Product", data: { count: n } });
    revalidatePath("/", "layout");
    return { ok: true, message: `${n} demo products are in the store. Remove them before launch.` };
  });
}

export async function removeDemoCatalogAction(): Promise<AdminResult> {
  return guarded("products.delete", async (actorId) => {
    const { removeDemoCatalog } = await import("@/server/admin/demo");
    const r = await removeDemoCatalog(actorId);
    revalidatePath("/", "layout");
    return { ok: true, message: `Removed demo catalog: ${r.deleted} deleted, ${r.archived} archived.` };
  });
}

// ── Customers ──

export async function setCustomerStatusAction(userId: string, status: "ACTIVE" | "SUSPENDED" | "BANNED", reason: string): Promise<AdminResult> {
  return guarded("customers.write", async (actorId) => {
    const s = z.enum(["ACTIVE", "SUSPENDED", "BANNED"]).parse(status);
    const id = z.string().max(40).parse(userId);
    if (id === actorId) return { ok: false, error: "You can't change your own account status." };
    const user = await db.user.findUnique({ where: { id }, select: { isStaff: true, email: true } });
    if (!user) return { ok: false, error: "Customer not found." };
    if (user.isStaff) return { ok: false, error: "This is a staff account. Remove their staff roles first (Staff & roles)." };
    await db.$transaction([
      db.user.update({ where: { id }, data: { status: s } }),
      ...(s === "ACTIVE" ? [] : [db.session.deleteMany({ where: { userId: id } })]),
    ]);
    await audit({ actorId, action: "customer.status", entityType: "User", entityId: id, data: { email: user.email, status: s, reason: z.string().max(300).parse(reason) } });
    revalidatePath(`/admin/customers/${id}`);
    return { ok: true, message: s === "ACTIVE" ? "Account reactivated." : `Account ${s.toLowerCase()} and signed out everywhere.` };
  });
}

export async function setCustomerTagsAction(userId: string, data: Record<string, unknown>): Promise<AdminResult> {
  return guarded("customers.write", async (actorId) => {
    const tags = z
      .string()
      .max(400)
      .parse(data.tags ?? "")
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 20);
    await db.user.update({ where: { id: z.string().max(40).parse(userId) }, data: { tags: [...new Set(tags)] } });
    await audit({ actorId, action: "customer.tags", entityType: "User", entityId: userId, data: { tags } });
    revalidatePath(`/admin/customers/${userId}`);
    return { ok: true, message: "Tags saved." };
  });
}

// ── Reviews & questions ──

export async function moderateReviewAction(reviewId: string, decision: "APPROVED" | "REJECTED" | "DELETE"): Promise<AdminResult> {
  return guarded("reviews.moderate", async (actorId) => {
    const id = z.string().max(40).parse(reviewId);
    const d = z.enum(["APPROVED", "REJECTED", "DELETE"]).parse(decision);
    const review = await db.review.findUnique({ where: { id }, select: { productId: true } });
    if (!review) return { ok: false, error: "Review not found." };
    if (d === "DELETE") await db.review.delete({ where: { id } });
    else await db.review.update({ where: { id }, data: { status: d } });
    const { recomputeRating } = await import("@/server/catalog/sync");
    await recomputeRating(review.productId);
    await audit({ actorId, action: `review.${d.toLowerCase()}`, entityType: "Review", entityId: id });
    revalidatePath("/admin/reviews");
    return { ok: true, message: d === "DELETE" ? "Review deleted." : `Review ${d.toLowerCase()}.` };
  });
}

export async function answerQuestionAction(questionId: string, data: Record<string, unknown>): Promise<AdminResult> {
  return guarded("reviews.moderate", async (actorId) => {
    const id = z.string().max(40).parse(questionId);
    if (data.reject === true) {
      await db.productQuestion.update({ where: { id }, data: { status: "REJECTED" } });
      revalidatePath("/admin/reviews");
      return { ok: true, message: "Question hidden." };
    }
    const answer = z.string().trim().min(2, "Write an answer").max(2000).parse(data.answer);
    const user = await db.user.findUnique({ where: { id: actorId }, select: { name: true } });
    await db.productQuestion.update({ where: { id }, data: { answer, status: "APPROVED", answeredBy: user?.name ?? "The Otaku Bazaar", answeredAt: new Date() } });
    await audit({ actorId, action: "question.answer", entityType: "ProductQuestion", entityId: id });
    revalidatePath("/admin/reviews");
    return { ok: true, message: "Answer published on the product page." };
  });
}

// ── Newsletter ──

export async function unsubscribeAction(id: string): Promise<AdminResult> {
  return guarded("marketing.write", async (actorId) => {
    await db.newsletterSubscriber.update({ where: { id: z.string().max(40).parse(id) }, data: { unsubscribedAt: new Date() } });
    await audit({ actorId, action: "newsletter.unsubscribe", entityType: "NewsletterSubscriber", entityId: id });
    revalidatePath("/admin/newsletter");
    return { ok: true, message: "Unsubscribed." };
  });
}

// ── Orders ──

export async function updateOrderStatusAction(orderId: string, data: Record<string, unknown>): Promise<AdminResult> {
  return guarded("orders.write", async (actorId) => {
    const { updateOrderStatus, OrderError } = await import("@/server/orders/service");
    const input = z
      .object({
        status: z.enum(["PROCESSING", "PACKED", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "DELAYED", "DELIVERY_FAILED", "RETURNED"]),
        message: z.string().trim().max(300).optional(),
        carrier: z.string().trim().max(60).optional(),
        trackingNumber: z.string().trim().max(80).optional(),
        trackingUrl: z.union([z.literal(""), z.string().trim().url().max(400)]).optional(),
      })
      .parse(data);
    try {
      await updateOrderStatus(z.string().max(40).parse(orderId), input.status, { actorId, ...input });
    } catch (err) {
      if (err instanceof OrderError) return { ok: false, error: err.message };
      throw err;
    }
    await audit({ actorId, action: "order.status", entityType: "Order", entityId: orderId, data: { status: input.status } });
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Order updated. The customer has been emailed." };
  });
}

export async function adminCancelOrderAction(orderId: string, data: Record<string, unknown>): Promise<AdminResult> {
  return guarded("orders.refund", async (actorId) => {
    const { cancelOrder, OrderError } = await import("@/server/orders/service");
    const reason = z.string().trim().min(3, "Enter a reason").max(300).parse(data.reason);
    try {
      const r = await cancelOrder(z.string().max(40).parse(orderId), { reason, actorId });
      await audit({ actorId, action: "order.cancel", entityType: "Order", entityId: orderId, data: { reason } });
    await afterStockChange();
      revalidatePath(`/admin/orders/${orderId}`);
      return { ok: true, message: r.refundId ? "Cancelled, stock returned and a full refund started." : "Cancelled and stock returned." };
    } catch (err) {
      if (err instanceof OrderError) return { ok: false, error: err.message };
      throw err;
    }
  });
}

export async function retryRefundAction(refundId: string): Promise<AdminResult> {
  return guarded("orders.refund", async (actorId) => {
    const { processRefund } = await import("@/server/orders/service");
    const r = await processRefund(z.string().max(40).parse(refundId));
    await audit({ actorId, action: "refund.retry", entityType: "Refund", entityId: refundId, data: { status: r.status } });
    revalidatePath(`/admin/orders/${r.orderId}`);
    return r.status === "SUCCEEDED" ? { ok: true, message: "Refund succeeded." } : { ok: false, error: "Refund failed again. Check the Razorpay dashboard." };
  });
}

export async function addOrderNoteAction(orderId: string, data: Record<string, unknown>): Promise<AdminResult> {
  return guarded("orders.write", async (actorId) => {
    const o = await db.order.findUniqueOrThrow({ where: { id: z.string().max(40).parse(orderId) }, select: { status: true } });
    const note = z.string().trim().min(1).max(500).parse(data.note);
    await db.orderEvent.create({ data: { orderId, status: o.status, message: note, isPublic: data.public === true, actorId } });
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: data.public === true ? "Update shared with the customer." : "Internal note added." };
  });
}

// ── Coupons ──

const couponSchema = z
  .object({
    id: z.string().max(40).optional(),
    code: z.string().trim().toUpperCase().min(3).max(30).regex(/^[A-Z0-9_-]+$/, "Use letters, numbers, - and _ only"),
    description: z.string().trim().max(200).optional(),
    type: z.enum(["PERCENT", "FIXED", "FREE_SHIPPING", "BOGO"]),
    value: z.coerce.number().min(0).max(1_000_000).default(0),
    minSubtotal: z.coerce.number().min(0).max(10_000_000).default(0),
    maxDiscount: z.union([z.literal(""), z.coerce.number().min(0).max(10_000_000)]).optional(),
    usageLimit: z.union([z.literal(""), z.coerce.number().int().min(1)]).optional(),
    perCustomerLimit: z.union([z.literal(""), z.coerce.number().int().min(1)]).optional(),
    firstOrderOnly: z.boolean().default(false),
    startsAt: z.union([z.literal(""), z.coerce.date()]).optional(),
    endsAt: z.union([z.literal(""), z.coerce.date()]).optional(),
    categoryIds: z.string().max(2000).optional(),
    franchiseIds: z.string().max(2000).optional(),
    isActive: z.boolean().default(true),
  })
  .superRefine((c, ctx) => {
    if (c.type === "PERCENT" && (c.value <= 0 || c.value > 90)) ctx.addIssue({ code: "custom", path: ["value"], message: "Percent must be 1–90" });
    if (c.type === "FIXED" && c.value <= 0) ctx.addIssue({ code: "custom", path: ["value"], message: "Enter the amount in ₹" });
  });

export async function saveCouponAction(raw: unknown): Promise<AdminResult> {
  return guarded("marketing.write", async (actorId) => {
    const c = couponSchema.parse(raw);
    const rupees = (v: number) => Math.round(v * 100);
    const ids = (s?: string) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []);
    const data = {
      code: c.code,
      description: c.description || null,
      type: c.type,
      value: c.type === "FIXED" ? rupees(c.value) : c.type === "PERCENT" ? Math.round(c.value) : 0,
      minSubtotal: rupees(c.minSubtotal),
      maxDiscount: typeof c.maxDiscount === "number" ? rupees(c.maxDiscount) : null,
      usageLimit: typeof c.usageLimit === "number" ? c.usageLimit : null,
      perCustomerLimit: typeof c.perCustomerLimit === "number" ? c.perCustomerLimit : null,
      firstOrderOnly: c.firstOrderOnly,
      startsAt: c.startsAt instanceof Date ? c.startsAt : null,
      endsAt: c.endsAt instanceof Date ? c.endsAt : null,
      categoryIds: ids(c.categoryIds),
      franchiseIds: ids(c.franchiseIds),
      isActive: c.isActive,
    };
    const clash = await db.coupon.findFirst({ where: { code: c.code, ...(c.id ? { NOT: { id: c.id } } : {}) } });
    if (clash) return { ok: false, error: `Code ${c.code} already exists.` };
    const row = c.id ? await db.coupon.update({ where: { id: c.id }, data }) : await db.coupon.create({ data });
    await audit({ actorId, action: c.id ? "coupon.update" : "coupon.create", entityType: "Coupon", entityId: row.id, data: { code: row.code } });
    revalidatePath("/admin/coupons");
    return { ok: true, message: `Coupon ${row.code} saved.` };
  });
}

export async function duplicateProductAction(productId: string): Promise<AdminResult<{ id: string; slug: string }>> {
  return guarded("products.write", async (actorId) => {
    const { duplicateProduct } = await import("@/server/admin/products");
    const p = await duplicateProduct(z.string().max(40).parse(productId), actorId);
    revalidatePath("/admin/products");
    return { ok: true, message: "Copy created", data: { id: p.id, slug: p.slug } };
  });
}

// ── Returns ──

export async function updateReturnAction(returnId: string, data: Record<string, unknown>): Promise<AdminResult> {
  const to = z.enum(["APPROVED", "REJECTED", "PICKUP_SCHEDULED", "RECEIVED", "REFUNDED", "EXCHANGED", "CLOSED"]).parse(data.status);
  return guarded(to === "REFUNDED" ? "orders.refund" : "orders.write", async (actorId) => {
    const { updateReturn, ReturnError } = await import("@/server/returns/service");
    const amount = data.refundAmount === undefined || data.refundAmount === "" ? undefined : Math.round(Number(data.refundAmount) * 100);
    if (amount !== undefined && !(amount > 0)) return { ok: false, error: "Enter a valid refund amount." };
    try {
      const r = await updateReturn(z.string().max(40).parse(returnId), to, {
        actorId,
        note: z.string().trim().max(500).optional().parse(data.note || undefined),
        restock: data.restock === true,
        refundAmount: amount,
        trackingNumber: z.string().trim().max(80).optional().parse(data.trackingNumber || undefined),
      });
      await audit({ actorId, action: `return.${to.toLowerCase()}`, entityType: "ReturnRequest", entityId: r.id });
    } catch (err) {
      if (err instanceof ReturnError) return { ok: false, error: err.message };
      throw err;
    }
    await afterStockChange();
    revalidatePath("/admin/returns");
    return { ok: true, message: "Return updated. The customer has been emailed." };
  });
}

// ── Shipping (Shiprocket) ──

export async function shipWithShiprocketAction(orderId: string): Promise<AdminResult> {
  return guarded("orders.write", async (actorId) => {
    const { shipWithShiprocket, ShippingError } = await import("@/server/shipping/shiprocket");
    try {
      const r = await shipWithShiprocket(z.string().max(40).parse(orderId), actorId);
      await audit({ actorId, action: "order.shiprocket", entityType: "Order", entityId: orderId, data: { awb: r.awb, courier: r.courier } });
      revalidatePath(`/admin/orders/${orderId}`);
      return { ok: true, message: `Booked with ${r.courier}. AWB ${r.awb}. Print the label from the Shipment box.` };
    } catch (err) {
      if (err instanceof ShippingError) return { ok: false, error: err.message };
      throw err;
    }
  });
}

export async function refreshTrackingAction(orderId: string): Promise<AdminResult> {
  return guarded("orders.write", async () => {
    const { refreshTracking, ShippingError } = await import("@/server/shipping/shiprocket");
    try {
      const r = await refreshTracking(z.string().max(40).parse(orderId));
      revalidatePath(`/admin/orders/${orderId}`);
      return { ok: true, message: r.applied ? `Updated to ${String((r as { status?: string }).status).toLowerCase().replace(/_/g, " ")}.` : "No new tracking updates." };
    } catch (err) {
      if (err instanceof ShippingError) return { ok: false, error: err.message };
      throw err;
    }
  });
}

// ── Gift cards & loyalty ──

export async function issueGiftCardAction(raw: unknown): Promise<AdminResult<{ code: string }>> {
  return guarded("marketing.write", async (actorId) => {
    const { issueGiftCard, RewardError } = await import("@/server/rewards/service");
    const i = z
      .object({
        amount: z.coerce.number().min(1).max(100_000),
        recipientEmail: z.union([z.literal(""), z.string().trim().email()]).optional(),
        senderName: z.string().trim().max(80).optional(),
        message: z.string().trim().max(300).optional(),
        expiresAt: z.union([z.literal(""), z.coerce.date()]).optional(),
      })
      .parse(raw);
    try {
      const { giftCard, code } = await issueGiftCard({ amount: Math.round(i.amount * 100), recipientEmail: i.recipientEmail || null, senderName: i.senderName || null, message: i.message || null, expiresAt: i.expiresAt instanceof Date ? i.expiresAt : null, actorId });
      await audit({ actorId, action: "giftcard.issue", entityType: "GiftCard", entityId: giftCard.id, data: { amount: giftCard.initialValue, last4: giftCard.last4, to: giftCard.recipientEmail } });
      revalidatePath("/admin/gift-cards");
      return { ok: true, message: giftCard.recipientEmail ? `Gift card emailed to ${giftCard.recipientEmail}.` : "Gift card created. Copy the code now; it won't be shown again.", data: { code } };
    } catch (err) {
      if (err instanceof RewardError) return { ok: false, error: err.message };
      throw err;
    }
  });
}

export async function setGiftCardActiveAction(id: string, active: boolean): Promise<AdminResult> {
  return guarded("marketing.write", async (actorId) => {
    await db.giftCard.update({ where: { id: z.string().max(40).parse(id) }, data: { isActive: active } });
    await audit({ actorId, action: active ? "giftcard.enable" : "giftcard.disable", entityType: "GiftCard", entityId: id });
    revalidatePath("/admin/gift-cards");
    return { ok: true, message: active ? "Gift card enabled." : "Gift card disabled." };
  });
}

export async function adjustPointsAction(userId: string, data: Record<string, unknown>): Promise<AdminResult> {
  return guarded("customers.write", async (actorId) => {
    const { addPoints, RewardError } = await import("@/server/rewards/service");
    const points = z.coerce.number().int().min(-100_000).max(100_000).refine((n) => n !== 0, "Enter points to add or remove").parse(data.points);
    const note = z.string().trim().min(2, "Add a reason").max(200).parse(data.note);
    try {
      await db.$transaction((tx) => addPoints(tx, z.string().max(40).parse(userId), points, "ADJUSTMENT", note));
    } catch (err) {
      if (err instanceof RewardError) return { ok: false, error: err.message };
      throw err;
    }
    await audit({ actorId, action: "loyalty.adjust", entityType: "User", entityId: userId, data: { points, note } });
    revalidatePath(`/admin/customers/${userId}`);
    return { ok: true, message: `${points > 0 ? "Added" : "Removed"} ${Math.abs(points)} points.` };
  });
}

// ── Support ──

export async function staffReplyAction(ticketId: string, data: Record<string, unknown>): Promise<AdminResult> {
  return guarded("support.write", async (actorId) => {
    const { addMessage } = await import("@/server/support/service");
    await addMessage(z.string().max(40).parse(ticketId), String(data.body ?? ""), { userId: actorId, isStaff: true });
    if (data.close === true) await db.supportTicket.update({ where: { id: ticketId }, data: { status: "RESOLVED" } });
    await audit({ actorId, action: "support.reply", entityType: "SupportTicket", entityId: ticketId });
    revalidatePath(`/admin/support/${ticketId}`);
    return { ok: true, message: "Reply emailed to the customer." };
  });
}

export async function updateTicketAction(ticketId: string, data: Record<string, unknown>): Promise<AdminResult> {
  return guarded("support.write", async (actorId) => {
    const p = z.object({ status: z.enum(["OPEN", "PENDING_CUSTOMER", "PENDING_STAFF", "RESOLVED", "CLOSED"]).optional(), priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional() }).parse(data);
    await db.supportTicket.update({ where: { id: z.string().max(40).parse(ticketId) }, data: p });
    await audit({ actorId, action: "support.update", entityType: "SupportTicket", entityId: ticketId, data: p });
    revalidatePath(`/admin/support/${ticketId}`);
    return { ok: true, message: "Ticket updated." };
  });
}

// ── FAQs (shown on /support) ──

const faqSchema = z.object({
  id: z.string().max(40).optional().or(z.literal("")),
  group: z.enum(["orders", "shipping", "payment", "returns", "account", "general"]),
  question: z.string().trim().min(5, "Write the question").max(200),
  answer: z.string().trim().min(5, "Write the answer").max(2000),
  position: z.coerce.number().int().min(0).max(999).default(0),
});

export async function saveFaqAction(raw: Record<string, unknown>): Promise<AdminResult> {
  return guarded("content.write", async (actorId) => {
    const { id, ...data } = faqSchema.parse(raw);
    const faq = id ? await db.faq.update({ where: { id }, data }) : await db.faq.create({ data });
    await audit({ actorId, action: id ? "faq.update" : "faq.create", entityType: "Faq", entityId: faq.id, data: { name: faq.question } });
    revalidatePath("/support");
    revalidatePath("/admin/faq");
    return { ok: true, message: id ? "FAQ saved." : "FAQ added." };
  });
}

export async function deleteFaqAction(id: string): Promise<AdminResult> {
  return guarded("content.write", async (actorId) => {
    await db.faq.delete({ where: { id: z.string().max(40).parse(id) } });
    await audit({ actorId, action: "faq.delete", entityType: "Faq", entityId: id });
    revalidatePath("/support");
    revalidatePath("/admin/faq");
    return { ok: true, message: "FAQ deleted." };
  });
}
