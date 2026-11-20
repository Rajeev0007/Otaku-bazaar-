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

export async function productFormValues(id: string): Promise<ProductFormValues | null> {
  const p = await db.product.findUnique({
    where: { id },
    include: { images: { where: { isCustomerPhoto: false }, orderBy: { position: "asc" } }, variants: { orderBy: { position: "asc" }, include: { inventory: true } } },
  });
  if (!p) return null;
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
    tags: p.tags.filter((t) => t !== "demo").join(", ") + (p.tags.includes("demo") ? ", demo" : ""),
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
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      title: v.title,
      size: v.size ?? "",
      color: v.color ?? "",
      colorHex: v.colorHex ?? "",
      style: v.style ?? "",
      price: r(v.price),
      compareAtPrice: r(v.compareAtPrice),
      costPrice: r(v.costPrice),
      stock: "",
      onHand: v.inventory?.onHand ?? 0,
      lowStockThreshold: String(v.inventory?.lowStockThreshold ?? 5),
      allowBackorder: v.inventory?.allowBackorder ?? false,
      isActive: v.isActive,
    })),
  };
}

export function blankProduct(): ProductFormValues {
  return {
    name: "", slug: "", subtitle: "", description: "", kind: "STANDARD", status: "DRAFT", categoryId: "", franchiseId: "", brandId: "", tags: "",
    material: "", careInstructions: "", dimensions: "", weightGrams: "250", warranty: "", authenticity: "", videoUrl: "", returnable: true, returnWindowDays: "",
    isFeatured: false, isLimited: false, isNewArrival: true, seoTitle: "", seoDescription: "", launchAt: "", images: [], variants: [emptyVariant()],
  };
}
