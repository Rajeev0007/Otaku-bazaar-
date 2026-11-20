import type { MetadataRoute } from "next";
import { db } from "@/server/db";
import { appUrl } from "@/lib/utils";

// Rendered on request so builds never need database access.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, franchises, collections, pages] = await Promise.all([
    db.product.findMany({ where: { status: "ACTIVE" }, select: { slug: true, updatedAt: true } }),
    db.category.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
    db.animeFranchise.findMany({ select: { slug: true, updatedAt: true } }),
    db.collection.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
    db.page.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
  ]);
  return [
    { url: appUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: appUrl("/shop"), changeFrequency: "daily", priority: 0.9 },
    { url: appUrl("/anime"), changeFrequency: "weekly", priority: 0.7 },
    ...categories.map((c) => ({ url: appUrl(`/c/${c.slug}`), lastModified: c.updatedAt, changeFrequency: "daily" as const, priority: 0.8 })),
    ...franchises.map((f) => ({ url: appUrl(`/anime/${f.slug}`), lastModified: f.updatedAt, changeFrequency: "daily" as const, priority: 0.8 })),
    ...collections.map((c) => ({ url: appUrl(`/collections/${c.slug}`), lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...products.map((p) => ({ url: appUrl(`/p/${p.slug}`), lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...pages.map((p) => ({ url: appUrl(`/pages/${p.slug}`), lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.3 })),
  ];
}
