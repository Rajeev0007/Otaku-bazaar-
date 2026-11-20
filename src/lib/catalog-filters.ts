// Product listing filters <-> URL search params. Pure functions shared by server pages and client controls,
// so every filtered view is a shareable URL.

export const SORTS = {
  featured: "Featured",
  newest: "Newest",
  bestselling: "Best selling",
  trending: "Trending",
  popular: "Most popular",
  rating: "Top rated",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  discount: "Biggest discount",
} as const;

export type SortKey = keyof typeof SORTS;

export type ListingFilters = {
  q?: string;
  categories: string[];
  anime: string[];
  sizes: string[];
  colors: string[];
  brands: string[];
  types: string[];
  minPrice?: number; // major units, as typed by the shopper
  maxPrice?: number;
  rating?: number;
  discount?: number;
  inStock: boolean;
  sale: boolean;
  isNew: boolean;
  limited: boolean;
  sort: SortKey;
  page: number;
  view: "grid" | "list";
};

export const PAGE_SIZE = 24;
export const PRODUCT_TYPES = { STANDARD: "Merch", BUNDLE: "Bundles", MYSTERY_BOX: "Mystery boxes", PRE_ORDER: "Pre-orders", GIFT_CARD: "Gift cards" } as const;

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

function get(params: Params, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

function list(params: Params, key: string, max = 20): string[] {
  const raw = get(params, key);
  if (!raw) return [];
  return [...new Set(raw.split(",").map((s) => s.trim()).filter((s) => s && s.length <= 60))].slice(0, max);
}

function num(params: Params, key: string, min: number, max: number): number | undefined {
  const raw = get(params, key);
  if (raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : undefined;
}

export function parseFilters(params: Params): ListingFilters {
  const sort = get(params, "sort");
  const q = get(params, "q")?.trim().slice(0, 80);
  return {
    q: q || undefined,
    categories: list(params, "category"),
    anime: list(params, "anime"),
    sizes: list(params, "size"),
    colors: list(params, "color"),
    brands: list(params, "brand"),
    types: list(params, "type").filter((t) => t in PRODUCT_TYPES),
    minPrice: num(params, "min", 0, 10_000_000),
    maxPrice: num(params, "max", 0, 10_000_000),
    rating: num(params, "rating", 1, 5),
    discount: num(params, "discount", 1, 90),
    inStock: get(params, "instock") === "1",
    sale: get(params, "sale") === "1",
    isNew: get(params, "new") === "1",
    limited: get(params, "limited") === "1",
    sort: sort && sort in SORTS ? (sort as SortKey) : "featured",
    page: num(params, "page", 1, 500) ?? 1,
    view: get(params, "view") === "list" ? "list" : "grid",
  };
}

export function filtersToSearchParams(f: Partial<ListingFilters>): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  const lists: [keyof ListingFilters, string][] = [
    ["categories", "category"],
    ["anime", "anime"],
    ["sizes", "size"],
    ["colors", "color"],
    ["brands", "brand"],
    ["types", "type"],
  ];
  for (const [k, key] of lists) {
    const v = f[k] as string[] | undefined;
    if (v?.length) p.set(key, v.join(","));
  }
  if (f.minPrice !== undefined) p.set("min", String(f.minPrice));
  if (f.maxPrice !== undefined) p.set("max", String(f.maxPrice));
  if (f.rating) p.set("rating", String(f.rating));
  if (f.discount) p.set("discount", String(f.discount));
  if (f.inStock) p.set("instock", "1");
  if (f.sale) p.set("sale", "1");
  if (f.isNew) p.set("new", "1");
  if (f.limited) p.set("limited", "1");
  if (f.sort && f.sort !== "featured") p.set("sort", f.sort);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  if (f.view === "list") p.set("view", "list");
  return p;
}

export function activeFilterCount(f: ListingFilters): number {
  return (
    f.categories.length + f.anime.length + f.sizes.length + f.colors.length + f.brands.length + f.types.length +
    (f.minPrice !== undefined || f.maxPrice !== undefined ? 1 : 0) +
    (f.rating ? 1 : 0) + (f.discount ? 1 : 0) + (f.inStock ? 1 : 0) + (f.sale ? 1 : 0) + (f.isNew ? 1 : 0) + (f.limited ? 1 : 0)
  );
}

/** Normalises a search query the same way product search text is built. */
export function normalizeQuery(q: string): string {
  return q
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}
