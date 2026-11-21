// Shared between the server (initial values) and the client product editor.

export type VariantRow = {
  id?: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string;
  style: string;
  /** Rupees as typed. "" = use the product's main price. */
  price: string;
  compareAtPrice: string;
  costPrice: string;
  stock: string;
  reserved?: number;
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
  /** Main price / compare-at price (rupees), applied to every option unless overridden. */
  price: string;
  compareAtPrice: string;
  lowStockThreshold: string;
  allowBackorder: boolean;
  sizes: string[];
  colors: { name: string; hex: string }[];
  styles: string[];
  variants: VariantRow[];
};

export const variantKey = (v: { color: string; size: string; style: string }) => `${v.color}|${v.size}|${v.style}`;

export const emptyVariant = (): VariantRow => ({ sku: "", size: "", color: "", colorHex: "", style: "", price: "", compareAtPrice: "", costPrice: "", stock: "", isActive: true });
