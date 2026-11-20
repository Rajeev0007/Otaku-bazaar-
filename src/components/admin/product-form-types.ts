// Shared between the server (initial values) and the client product form.

export type VariantRow = {
  id?: string;
  sku: string;
  title: string;
  size: string;
  color: string;
  colorHex: string;
  style: string;
  price: string;
  compareAtPrice: string;
  costPrice: string;
  stock: string;
  onHand?: number;
  lowStockThreshold: string;
  allowBackorder: boolean;
  isActive: boolean;
};

export type ProductFormValues = {
  name: string;
  slug: string;
  subtitle: string;
  description: string;
  kind: string;
  status: string;
  categoryId: string;
  franchiseId: string;
  brandId: string;
  tags: string;
  material: string;
  careInstructions: string;
  dimensions: string;
  weightGrams: string;
  warranty: string;
  authenticity: string;
  videoUrl: string;
  returnable: boolean;
  returnWindowDays: string;
  isFeatured: boolean;
  isLimited: boolean;
  isNewArrival: boolean;
  seoTitle: string;
  seoDescription: string;
  /** ISO 8601 timestamp (UTC) or "" */
  launchAt: string;
  images: { url: string; alt: string }[];
  variants: VariantRow[];
};

export const emptyVariant = (): VariantRow => ({ sku: "", title: "", size: "", color: "", colorHex: "", style: "", price: "", compareAtPrice: "", costPrice: "", stock: "0", lowStockThreshold: "5", allowBackorder: false, isActive: true });
