import { db } from "@/server/db";
import { toMajor } from "@/lib/money";
import { emptyVariant, type ProductFormValues } from "@/components/admin/product-form-types";

export async function formOptions() {
  const [categories, franchises, brands] = await Promise.all([
    db.category.findMany({ orderBy: [{ parentId: "asc" }, { position: "asc" }], select: { id: true, name: true, parent: { select: { name: true } } } }),
    db.animeFranchise.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return {
    categories: categories.map((c) => ({ id: c.id, name: c.parent ? `${c.parent.name} › ${c.name}` : c.name })),
    franchises,
    brands,
  };
}

const r = (minor: number | null | undefined) => (minor === null || minor === undefined ? "" : String(toMajor(minor, "INR")));
const uniq = <T,>(a: T[]) => [...new Set(a)];

export async function productFormValues(id: string): Promise<ProductFormValues | null> {
  const p = await db.product.findUnique({
    where: { id },
    include: { images: { where: { isCustomerPhoto: false }, orderBy: { position: "asc" } }, variants: { where: { isActive: true }, orderBy: { position: "asc" }, include: { inventory: true } } },
  });
  if (!p) return null;
  // The most common price becomes the "main" price; options that differ keep their own.
  const counts = new Map<number, number>();
  for (const v of p.variants) counts.set(v.price, (counts.get(v.price) ?? 0) + 1);
  const mainPrice = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  const mainCompare = p.variants.find((v) => v.price === mainPrice)?.compareAtPrice ?? null;
  const first = p.variants[0];
  return {
    name: p.name,
    slug: p.slug,
    subtitle: p.subtitle ?? "",
    description: p.description,
    kind: p.kind,
    status: p.status,
    categoryId: p.categoryId,
    franchiseId: p.franchiseId ?? "",
    brandId: p.brandId ?? "",
    tags: p.tags.join(", "),
    material: p.material ?? "",
    careInstructions: p.careInstructions ?? "",
    dimensions: p.dimensions ?? "",
    weightGrams: String(p.weightGrams),
    warranty: p.warranty ?? "",
    authenticity: p.authenticity ?? "",
    videoUrl: p.videoUrl ?? "",
    returnable: p.returnable,
    returnWindowDays: p.returnWindowDays === null ? "" : String(p.returnWindowDays),
    isFeatured: p.isFeatured,
    isLimited: p.isLimited,
    isNewArrival: p.isNewArrival,
    seoTitle: p.seoTitle ?? "",
    seoDescription: p.seoDescription ?? "",
    launchAt: p.launchAt?.toISOString() ?? "",
    images: p.images.map((i) => ({ url: i.url, alt: i.alt })),
    price: r(mainPrice),
    compareAtPrice: r(mainCompare),
    lowStockThreshold: String(first?.inventory?.lowStockThreshold ?? 5),
    allowBackorder: first?.inventory?.allowBackorder ?? false,
    sizes: uniq(p.variants.map((v) => v.size).filter((x): x is string => !!x)),
    colors: uniq(p.variants.filter((v) => v.color).map((v) => `${v.color}|${v.colorHex ?? ""}`)).map((s) => ({ name: s.split("|")[0]!, hex: s.split("|")[1] || "#888888" })),
    styles: uniq(p.variants.map((v) => v.style).filter((x): x is string => !!x)),
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.size ?? "",
      color: v.color ?? "",
      colorHex: v.colorHex ?? "",
      style: v.style ?? "",
      price: v.price === mainPrice ? "" : r(v.price),
      compareAtPrice: v.price === mainPrice && v.compareAtPrice === mainCompare ? "" : r(v.compareAtPrice),
      costPrice: r(v.costPrice),
      stock: String(v.inventory?.onHand ?? 0),
      reserved: v.inventory?.reserved ?? 0,
      isActive: v.isActive,
    })),
  };
}

export function blankProduct(): ProductFormValues {
  return {
    name: "", slug: "", subtitle: "", description: "", kind: "STANDARD", status: "ACTIVE", categoryId: "", franchiseId: "", brandId: "", tags: "",
    material: "", careInstructions: "", dimensions: "", weightGrams: "250", warranty: "", authenticity: "", videoUrl: "", returnable: true, returnWindowDays: "",
    isFeatured: false, isLimited: false, isNewArrival: true, seoTitle: "", seoDescription: "", launchAt: "", images: [],
    price: "", compareAtPrice: "", lowStockThreshold: "5", allowBackorder: false, sizes: [], colors: [], styles: [], variants: [emptyVariant()],
  };
}
