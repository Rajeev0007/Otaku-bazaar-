/*
 * Seed: roles/permissions, store settings, taxonomy, DEMO products, homepage layout, policy templates.
 * Demo products use generated placeholder art and are tagged "demo" so they can be bulk-archived before launch.
 * Demo staff/customer accounts are created only when SEED_DEMO_ACCOUNTS=true and NODE_ENV !== "production".
 *
 * Safe to re-run: everything is upserted by a natural key.
 */
import { PrismaClient, ProductKind, InventoryReason } from "@prisma/client";
import { DEFAULT_ROLES, PERMISSIONS } from "../src/server/auth/permissions";
import { hashPassword } from "../src/server/security/crypto";
import { buildSearchText } from "../src/server/catalog/sync";
import { demoArtUrl, type ArtKind } from "../src/lib/demo-art";
import { discountPercent } from "../src/lib/money";
import { POLICY_PAGES } from "./seed-pages";

const db = new PrismaClient();

// Deterministic PRNG so every seed run produces the same catalog.
let s = 20261120;
const rand = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!;
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

const FRANCHISES = [
  { slug: "jujutsu-kaisen", name: "Jujutsu Kaisen", mark: "JJK", color: "#6c5ce7", trending: true },
  { slug: "one-piece", name: "One Piece", mark: "OP", color: "#e74c3c", trending: true },
  { slug: "naruto", name: "Naruto", mark: "NRT", color: "#f39c12", trending: true },
  { slug: "demon-slayer", name: "Demon Slayer", mark: "DS", color: "#16a085", trending: true },
  { slug: "attack-on-titan", name: "Attack on Titan", mark: "AOT", color: "#8d6e63", trending: false },
  { slug: "dragon-ball", name: "Dragon Ball", mark: "DB", color: "#ff7a18", trending: false },
  { slug: "chainsaw-man", name: "Chainsaw Man", mark: "CSM", color: "#ff4d4d", trending: true },
  { slug: "spy-x-family", name: "Spy x Family", mark: "SXF", color: "#ff7eb6", trending: false },
  { slug: "my-hero-academia", name: "My Hero Academia", mark: "MHA", color: "#2ecc71", trending: false },
  { slug: "solo-leveling", name: "Solo Leveling", mark: "SL", color: "#4aa3ff", trending: true },
] as const;

type Cat = { slug: string; name: string; children?: { slug: string; name: string }[]; returnWindowDays?: number };
const CATEGORIES: Cat[] = [
  { slug: "clothing", name: "Clothing", children: [
    { slug: "oversized-t-shirts", name: "Oversized T-Shirts" },
    { slug: "hoodies-sweatshirts", name: "Hoodies & Sweatshirts" },
    { slug: "caps", name: "Caps" },
  ] },
  { slug: "accessories", name: "Accessories", children: [
    { slug: "keychains", name: "Keychains" },
    { slug: "jewelry", name: "Jewelry & Wearables" },
    { slug: "stickers", name: "Stickers" },
    { slug: "desk-accessories", name: "Desk Accessories" },
  ] },
  { slug: "figures-collectibles", name: "Figures & Collectibles", returnWindowDays: 3 },
  { slug: "posters-wall-art", name: "Posters & Wall Art" },
  { slug: "phone-accessories", name: "Phone Accessories" },
  { slug: "gaming", name: "Gaming" },
  { slug: "bags", name: "Bags & Backpacks" },
  { slug: "cosplay", name: "Cosplay" },
  { slug: "manga", name: "Manga", returnWindowDays: 0 },
  { slug: "gifts", name: "Gifts", children: [
    { slug: "gift-sets", name: "Gift Sets" },
    { slug: "mystery-boxes", name: "Mystery Boxes" },
  ] },
];

type Template = {
  category: string;
  kind: ArtKind;
  names: string[];
  price: [number, number]; // rupees
  variants: "apparel" | "cap" | "phone" | "poster" | "single" | "color";
  material?: string;
  care?: string;
  dimensions?: string;
  weight: number;
  productKind?: ProductKind;
  tags: string[];
};

const TEMPLATES: Template[] = [
  { category: "oversized-t-shirts", kind: "tshirt", names: ["Signature Oversized Tee", "Character Art Oversized Tee", "Back Print Oversized Tee", "Minimal Logo Oversized Tee", "Manga Panel Oversized Tee", "Vintage Wash Oversized Tee"], price: [799, 1199], variants: "apparel", material: "240 GSM 100% combed cotton, bio-washed", care: "Machine wash cold inside out. Do not iron on print.", weight: 260, tags: ["streetwear", "oversized", "cotton"] },
  { category: "hoodies-sweatshirts", kind: "hoodie", names: ["Heavyweight Hoodie", "Embroidered Crest Hoodie", "Back Print Hoodie", "Graphic Zip Hoodie", "Oversized Sweatshirt"], price: [1799, 2499], variants: "apparel", material: "380 GSM brushed fleece, 80% cotton 20% polyester", care: "Machine wash cold. Tumble dry low.", weight: 650, tags: ["winter", "hoodie", "heavyweight"] },
  { category: "caps", kind: "cap", names: ["Embroidered Dad Cap", "Snapback Crest Cap"], price: [599, 899], variants: "cap", material: "Cotton twill with 3D embroidery", weight: 150, tags: ["cap", "embroidered"] },
  { category: "posters-wall-art", kind: "poster", names: ["Cinematic Art Print", "Minimal Silhouette Poster", "Manga Panel Wall Art", "Metal Poster Edition"], price: [349, 1499], variants: "poster", material: "300 GSM matte art paper", dimensions: "A3: 29.7 × 42 cm, A2: 42 × 59.4 cm", weight: 200, tags: ["wall art", "room decor"] },
  { category: "phone-accessories", kind: "phone", names: ["Glass Back Phone Case", "MagSafe Compatible Case", "Phone Grip & Stand"], price: [449, 899], variants: "phone", material: "Tempered glass back, TPU bumper", weight: 60, tags: ["phone case", "protection"] },
  { category: "keychains", kind: "keychain", names: ["Acrylic Keychain", "Metal Enamel Keychain", "Rubber Chibi Keychain"], price: [149, 349], variants: "single", material: "Double-sided acrylic, zinc alloy ring", dimensions: "6 × 4 cm", weight: 25, tags: ["keychain", "gift under 500"] },
  { category: "figures-collectibles", kind: "figure", names: ["Premium PVC Figure", "Nendo-style Chibi Figure", "Limited Statue"], price: [1499, 7999], variants: "single", material: "PVC & ABS, hand-painted", dimensions: "Height approx. 18 cm", weight: 600, tags: ["figure", "collectible"] },
  { category: "stickers", kind: "sticker", names: ["Vinyl Sticker Pack (20 pcs)", "Holographic Sticker Sheet"], price: [149, 299], variants: "single", material: "Waterproof matte vinyl", weight: 30, tags: ["stickers", "laptop"] },
  { category: "desk-accessories", kind: "mug", names: ["Ceramic Mug", "Desk Mat XL"], price: [399, 999], variants: "single", material: "Ceramic, dishwasher safe", weight: 400, tags: ["desk", "work from home"] },
  { category: "bags", kind: "bag", names: ["Canvas Tote Bag", "Everyday Backpack"], price: [549, 2299], variants: "color", material: "12 oz cotton canvas / 600D polyester", weight: 500, tags: ["bag", "college"] },
  { category: "jewelry", kind: "jewelry", names: ["Pendant Necklace", "Ring Set", "Charm Bracelet"], price: [299, 899], variants: "single", material: "Stainless steel, hypoallergenic", weight: 40, tags: ["jewelry", "gift"] },
  { category: "gaming", kind: "gaming", names: ["RGB Mouse Pad", "Controller Skin"], price: [499, 1299], variants: "single", material: "Micro-weave cloth top, rubber base", weight: 300, tags: ["gaming", "setup"] },
  { category: "cosplay", kind: "cosplay", names: ["Cosplay Headband", "Cosplay Accessory Kit"], price: [299, 1499], variants: "single", material: "Metal plate, cotton band", weight: 120, tags: ["cosplay", "convention"] },
  { category: "manga", kind: "manga", names: ["Manga Box Set Vol. 1–3"], price: [1299, 1999], variants: "single", material: "Paperback, English edition", weight: 700, tags: ["manga", "reading"] },
];

const SPECIAL = [
  { name: "Otaku Mystery Box — Classic", category: "mystery-boxes", kind: "mystery" as ArtKind, price: 1499, compareAt: 2499, productKind: ProductKind.MYSTERY_BOX, desc: "5–7 surprise items worth more than the box price: apparel, accessories and collectibles from popular series. Contents vary; no duplicates within a box." },
  { name: "Otaku Mystery Box — Premium", category: "mystery-boxes", kind: "mystery" as ArtKind, price: 3499, compareAt: 5999, productKind: ProductKind.MYSTERY_BOX, desc: "Our biggest surprise box. Includes at least one figure or hoodie, plus 6+ curated accessories." },
  { name: "First Anime Gift Set", category: "gift-sets", kind: "gift" as ArtKind, price: 999, compareAt: 1349, productKind: ProductKind.BUNDLE, desc: "A ready-to-gift set with a keychain, sticker pack and art print, packed in a premium box." },
  { name: "Collector's Desk Bundle", category: "gift-sets", kind: "gift" as ArtKind, price: 2199, compareAt: 2797, productKind: ProductKind.BUNDLE, desc: "Desk mat, mug and acrylic standee. Saves 20% versus buying separately." },
];

const COLORS = [
  { name: "Black", hex: "#111114" },
  { name: "Off White", hex: "#ece9e2" },
  { name: "Charcoal", hex: "#3a3a40" },
  { name: "Maroon", hex: "#5c1a22" },
  { name: "Navy", hex: "#1c2541" },
];

function roundPrice(r: number) {
  return Math.max(99, Math.round(r / 50) * 50 - 1);
}

async function seedRoles() {
  for (const [key, description] of Object.entries(PERMISSIONS)) {
    await db.permission.upsert({ where: { key }, create: { key, description }, update: { description } });
  }
  const perms = await db.permission.findMany();
  for (const [key, role] of Object.entries(DEFAULT_ROLES)) {
    const r = await db.role.upsert({ where: { key }, create: { key, name: role.name, description: role.description, isSystem: true }, update: { name: role.name, description: role.description } });
    await db.rolePermission.deleteMany({ where: { roleId: r.id } });
    await db.rolePermission.createMany({ data: role.permissions.map((p) => ({ roleId: r.id, permissionId: perms.find((x) => x.key === p)!.id })) });
  }
}

async function seedMarkets() {
  const india = await db.market.upsert({
    where: { code: "IN" },
    create: { code: "IN", name: "India", currency: "INR", countries: ["IN"], isActive: true, isDefault: true, taxInclusive: true, taxRateBps: 1800, taxLabel: "GST", paymentProviders: ["razorpay", "cod"] },
    update: {},
  });
  await db.market.upsert({
    where: { code: "INTL" },
    create: { code: "INTL", name: "International", currency: "USD", countries: ["US", "GB", "CA", "AU", "SG", "AE", "DE", "FR", "JP"], fxRate: 0.012, isActive: false, taxInclusive: false, taxRateBps: 0, taxLabel: "Tax", dutiesMessage: "Import duties and taxes may be charged by your country on delivery.", paymentProviders: ["stripe", "paypal"] },
    update: {},
  });
  const zone = await db.shippingZone.findFirst({ where: { marketId: india.id, name: "All India" } });
  const z = zone ?? (await db.shippingZone.create({ data: { name: "All India", marketId: india.id, countries: ["IN"] } }));
  const rates = [
    { code: "standard", name: "Standard delivery", baseRate: 4900, freeOver: 99900, minDays: 4, maxDays: 7 },
    { code: "express", name: "Express delivery", baseRate: 14900, minDays: 2, maxDays: 3 },
    { code: "premium", name: "Next-day (metro cities)", baseRate: 24900, minDays: 1, maxDays: 1 },
  ];
  for (const r of rates) await db.shippingRate.upsert({ where: { zoneId_code: { zoneId: z.id, code: r.code } }, create: { zoneId: z.id, ...r }, update: {} });
}

async function seedTaxonomy() {
  let pos = 0;
  for (const c of CATEGORIES) {
    const parent = await db.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, position: pos++, returnWindowDays: c.returnWindowDays, imageUrl: demoArtUrl(TEMPLATES.find((t) => t.category === c.slug || c.children?.some((ch) => ch.slug === t.category))?.kind ?? "gift", "#f0506e", c.name, "OB") },
      update: { name: c.name, position: pos - 1 },
    });
    let cpos = 0;
    for (const ch of c.children ?? []) {
      await db.category.upsert({
        where: { slug: ch.slug },
        create: { slug: ch.slug, name: ch.name, parentId: parent.id, position: cpos++, imageUrl: demoArtUrl(TEMPLATES.find((t) => t.category === ch.slug)?.kind ?? "gift", "#f0506e", ch.name, "OB") },
        update: { name: ch.name, parentId: parent.id },
      });
    }
  }
  for (const [i, f] of FRANCHISES.entries()) {
    await db.animeFranchise.upsert({
      where: { slug: f.slug },
      create: { slug: f.slug, name: f.name, accentColor: f.color, isTrending: f.trending, position: i, imageUrl: demoArtUrl("figure", f.color, f.name, f.mark), bannerUrl: demoArtUrl("banner", f.color, f.name, f.mark), description: `Merch, apparel and collectibles inspired by ${f.name}.` },
      update: { accentColor: f.color, isTrending: f.trending, position: i },
    });
  }
  await db.brand.upsert({ where: { slug: "otaku-bazaar-originals" }, create: { slug: "otaku-bazaar-originals", name: "Otaku Bazaar Originals" }, update: {} });
  await db.brand.upsert({ where: { slug: "collectors-studio" }, create: { slug: "collectors-studio", name: "Collector's Studio" }, update: {} });
}

function variantsFor(t: Template, base: number, skuBase: string) {
  const compare = rand() < 0.45 ? roundPrice(base * (1.2 + rand() * 0.4)) : null;
  const v: { sku: string; title: string; size?: string; color?: string; colorHex?: string; style?: string; price: number; compareAtPrice: number | null }[] = [];
  if (t.variants === "apparel") {
    const colors = [COLORS[0]!, pick(COLORS.slice(1))];
    for (const c of colors) for (const size of ["S", "M", "L", "XL", "XXL"]) {
      v.push({ sku: `${skuBase}-${c.name.slice(0, 3).toUpperCase()}-${size}`, title: `${c.name} / ${size}`, size, color: c.name, colorHex: c.hex, price: base + (size === "XXL" ? 100 : 0), compareAtPrice: compare ? compare + (size === "XXL" ? 100 : 0) : null });
    }
  } else if (t.variants === "cap") {
    for (const c of [COLORS[0]!, COLORS[1]!, COLORS[4]!]) v.push({ sku: `${skuBase}-${c.name.slice(0, 3).toUpperCase()}`, title: c.name, color: c.name, colorHex: c.hex, price: base, compareAtPrice: compare });
  } else if (t.variants === "phone") {
    for (const m of ["iPhone 15", "iPhone 16", "iPhone 16 Pro", "Galaxy S24", "Pixel 9", "OnePlus 12"]) v.push({ sku: `${skuBase}-${m.replace(/\s+/g, "").toUpperCase()}`, title: m, style: m, price: base, compareAtPrice: compare });
  } else if (t.variants === "poster") {
    v.push({ sku: `${skuBase}-A3`, title: "A3", size: "A3", price: base, compareAtPrice: compare });
    v.push({ sku: `${skuBase}-A2`, title: "A2", size: "A2", price: roundPrice(base * 1.6), compareAtPrice: compare ? roundPrice(compare * 1.6) : null });
  } else if (t.variants === "color") {
    for (const c of [COLORS[0]!, COLORS[1]!]) v.push({ sku: `${skuBase}-${c.name.slice(0, 3).toUpperCase()}`, title: c.name, color: c.name, colorHex: c.hex, price: base, compareAtPrice: compare });
  } else {
    v.push({ sku: skuBase, title: "Default", price: base, compareAtPrice: compare });
  }
  return v;
}

function description(name: string, franchise: string, t: Template) {
  return [
    `${name} inspired by ${franchise}, designed in-house for fans who care about quality.`,
    "",
    "Why you'll love it:",
    `- Premium build: ${t.material ?? "high-quality materials"}`,
    "- Rich, fade-resistant print and colours",
    "- Packed securely and inspected before dispatch",
    "",
    "This is demo catalog content. Replace it with your real product copy in Admin → Products.",
  ].join("\n");
}

async function upsertProduct(input: {
  slug: string; name: string; categorySlug: string; franchiseSlug?: string; brandSlug: string; description: string; kind: ProductKind;
  images: string[]; variants: ReturnType<typeof variantsFor>; tags: string[]; material?: string; care?: string; dimensions?: string; weight: number;
  isFeatured: boolean; isLimited: boolean; isNew: boolean; salesCount: number; trendingScore: number; createdAt: Date; returnable?: boolean;
}) {
  const category = await db.category.findUniqueOrThrow({ where: { slug: input.categorySlug } });
  const franchise = input.franchiseSlug ? await db.animeFranchise.findUniqueOrThrow({ where: { slug: input.franchiseSlug } }) : null;
  const brand = await db.brand.findUniqueOrThrow({ where: { slug: input.brandSlug } });
  const prices = input.variants.map((v) => v.price * 100);
  const product = await db.product.upsert({
    where: { slug: input.slug },
    create: {
      slug: input.slug, name: input.name, description: input.description, kind: input.kind, status: "ACTIVE",
      categoryId: category.id, franchiseId: franchise?.id, brandId: brand.id, tags: [...input.tags, "demo"],
      material: input.material, careInstructions: input.care, dimensions: input.dimensions, weightGrams: input.weight,
      authenticity: "[Describe licensing or originality, e.g. 'Original fan-art design by Otaku Bazaar Originals'.]",
      isFeatured: input.isFeatured, isLimited: input.isLimited, isNewArrival: input.isNew,
      salesCount: input.salesCount, trendingScore: input.trendingScore, publishedAt: input.createdAt, createdAt: input.createdAt,
      returnable: input.returnable ?? true,
      minPrice: Math.min(...prices), maxPrice: Math.max(...prices),
      images: { create: input.images.map((url, i) => ({ url, alt: `${input.name} — view ${i + 1}`, position: i, width: 800, height: 1000 })) },
    },
    update: {},
  });
  for (const [i, v] of input.variants.entries()) {
    const variant = await db.productVariant.upsert({
      where: { sku: v.sku },
      create: { productId: product.id, sku: v.sku, title: v.title, size: v.size, color: v.color, colorHex: v.colorHex, style: v.style, price: v.price * 100, compareAtPrice: v.compareAtPrice ? v.compareAtPrice * 100 : null, position: i },
      update: {},
    });
    const exists = await db.inventoryItem.findUnique({ where: { variantId: variant.id } });
    if (!exists) {
      // A few variants start sold out or low so stock states are visible in the demo.
      const onHand = rand() < 0.08 ? 0 : rand() < 0.12 ? int(1, 4) : int(8, 60);
      await db.inventoryItem.create({
        data: { variantId: variant.id, onHand, transactions: { create: { delta: onHand, onHandAfter: onHand, reason: InventoryReason.INITIAL, note: "Seed stock" } } },
      });
    }
  }
  return product;
}

async function seedProducts() {
  const now = Date.now();
  let n = 0;
  const brands = ["otaku-bazaar-originals", "collectors-studio"];
  for (const t of TEMPLATES) {
    for (const name of t.names) {
      // Each template line is produced for two franchises to give a realistic, filterable catalog.
      const fs = [FRANCHISES[n % FRANCHISES.length]!, FRANCHISES[(n + 3) % FRANCHISES.length]!];
      for (const f of fs) {
        n++;
        const full = `${f.name} ${name}`;
        const slug = full.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        const base = roundPrice(t.price[0] + rand() * (t.price[1] - t.price[0]));
        const skuBase = `OB-${f.mark}-${String(n).padStart(3, "0")}`;
        const color = f.color;
        await upsertProduct({
          slug, name: full, categorySlug: t.category, franchiseSlug: f.slug, brandSlug: t.category === "figures-collectibles" ? brands[1]! : brands[0]!,
          description: description(name, f.name, t), kind: t.productKind ?? ProductKind.STANDARD,
          images: [1, 2, 3].map((v) => demoArtUrl(t.kind, color, f.name, f.mark, v)),
          variants: variantsFor(t, base, skuBase), tags: [...t.tags, f.name.toLowerCase()], material: t.material, care: t.care, dimensions: t.dimensions, weight: t.weight,
          isFeatured: rand() < 0.2, isLimited: t.category === "figures-collectibles" ? rand() < 0.6 : rand() < 0.08, isNew: rand() < 0.3,
          salesCount: int(0, 900), trendingScore: Math.round(rand() * 1000) / 10, createdAt: new Date(now - int(0, 120) * 86_400_000),
          returnable: t.category !== "manga",
        });
      }
    }
  }
  for (const [i, sp] of SPECIAL.entries()) {
    const slug = sp.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    await upsertProduct({
      slug, name: sp.name, categorySlug: sp.category, brandSlug: "otaku-bazaar-originals", description: `${sp.desc}\n\nThis is demo catalog content.`, kind: sp.productKind,
      images: [1, 2].map((v) => demoArtUrl(sp.kind, "#f0506e", "Otaku Bazaar", "OB", v)),
      variants: [{ sku: `OB-SPC-${String(i + 1).padStart(3, "0")}`, title: "Default", price: sp.price, compareAtPrice: sp.compareAt }],
      tags: ["gift", "bundle"], weight: 900, isFeatured: true, isLimited: false, isNew: rand() < 0.5, salesCount: int(50, 600), trendingScore: 60 + rand() * 40,
      createdAt: new Date(now - int(0, 60) * 86_400_000), returnable: sp.productKind !== ProductKind.MYSTERY_BOX,
    });
  }
  console.log(`  products: ${await db.product.count()}, variants: ${await db.productVariant.count()}`);
}

async function seedCollections() {
  const cols = [
    { slug: "limited-drops", name: "Limited Drops", description: "Small-batch releases. Once they're gone, they're gone.", where: { isLimited: true } },
    { slug: "gifts-under-999", name: "Gifts under ₹999", description: "Thoughtful picks for every fan, all under ₹999.", where: { minPrice: { lte: 99_900 }, inStock: true } },
    { slug: "streetwear-essentials", name: "Streetwear Essentials", description: "Oversized tees, heavyweight hoodies and caps.", where: { category: { slug: { in: ["oversized-t-shirts", "hoodies-sweatshirts", "caps"] } } } },
  ];
  for (const [i, c] of cols.entries()) {
    const col = await db.collection.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, description: c.description, isFeatured: true, position: i, imageUrl: demoArtUrl("banner", ["#f0506e", "#6c5ce7", "#16a085"][i]!, c.name, "OB") },
      update: {},
    });
    const products = await db.product.findMany({ where: c.where, take: 16, orderBy: { trendingScore: "desc" }, select: { id: true } });
    for (const [pos, p] of products.entries()) {
      await db.collectionProduct.upsert({ where: { collectionId_productId: { collectionId: col.id, productId: p.id } }, create: { collectionId: col.id, productId: p.id, position: pos }, update: {} });
    }
  }
}

async function syncAggregates() {
  const products = await db.product.findMany({ include: { category: true, franchise: true, brand: true, variants: { include: { inventory: true } } } });
  for (const p of products) {
    const prices = p.variants.map((v) => v.price);
    if (!prices.length) throw new Error(`Product ${p.slug} has no variants`);
    const best = Math.max(0, ...p.variants.map((v) => discountPercent(v.price, v.compareAtPrice)));
    const maxCompareAt = Math.max(0, ...p.variants.map((v) => v.compareAtPrice ?? 0)) || null;
    const reviews = await db.review.aggregate({ where: { productId: p.id, status: "APPROVED" }, _avg: { rating: true }, _count: true });
    await db.product.update({
      where: { id: p.id },
      data: {
        minPrice: Math.min(...prices), maxPrice: Math.max(...prices), maxCompareAt, discountPercent: best,
        inStock: p.variants.some((v) => v.inventory && v.inventory.onHand - v.inventory.reserved > 0),
        ratingAvg: Math.round((reviews._avg.rating ?? 0) * 10) / 10, ratingCount: reviews._count,
        searchText: buildSearchText([p.name, p.subtitle, p.franchise?.name, p.category.name, p.brand?.name, ...p.tags, ...p.variants.flatMap((v) => [v.sku, v.color, v.size, v.style])]),
      },
    });
  }
}

async function seedAccountsAndReviews() {
  const allowed = process.env.SEED_DEMO_ACCOUNTS === "true" && process.env.NODE_ENV !== "production";
  if (!allowed) {
    console.log("  demo accounts: skipped (set SEED_DEMO_ACCOUNTS=true outside production)");
    return;
  }
  const password = await hashPassword(process.env.SEED_DEMO_PASSWORD ?? "OtakuDemo123");
  const staff: [string, string, string][] = [
    ["admin@otakubazaar.test", "Asha Admin", "super_admin"],
    ["manager@otakubazaar.test", "Meera Manager", "store_manager"],
    ["products@otakubazaar.test", "Pranav Products", "product_manager"],
    ["orders@otakubazaar.test", "Omar Orders", "order_manager"],
    ["support@otakubazaar.test", "Sana Support", "support_agent"],
    ["marketing@otakubazaar.test", "Kabir Marketing", "marketing_manager"],
  ];
  for (const [email, name, roleKey] of staff) {
    const role = await db.role.findUniqueOrThrow({ where: { key: roleKey } });
    const u = await db.user.upsert({ where: { email }, create: { email, name, passwordHash: password, isStaff: true, emailVerifiedAt: new Date(), wishlists: { create: {} } }, update: { isStaff: true } });
    await db.userRole.upsert({ where: { userId_roleId: { userId: u.id, roleId: role.id } }, create: { userId: u.id, roleId: role.id }, update: {} });
  }
  const names = ["Riya S.", "Arjun K.", "Neha P.", "Vikram R.", "Ishaan M.", "Tanvi G.", "Aditya B.", "Zoya F."];
  const customers = [];
  for (const [i, name] of names.entries()) {
    const email = i === 0 ? "customer@otakubazaar.test" : `fan${i}@otakubazaar.test`;
    customers.push(await db.user.upsert({ where: { email }, create: { email, name, passwordHash: password, emailVerifiedAt: new Date(), wishlists: { create: {} } }, update: {} }));
  }
  if ((await db.review.count()) > 0) return;
  const bodies: [string, string][] = [
    ["Better than expected", "Print quality is sharp and the colours are exactly like the photos. Packaging was solid too."],
    ["Great gift", "Bought this for my brother's birthday and he loved it. Delivery was quick."],
    ["Premium feel", "Feels premium, not like the cheap stuff on marketplaces. Will order again."],
    ["Good, sizing runs large", "Quality is great. It's an oversized fit so size down if you want it regular."],
    ["Solid", "Does what it says. Would like more design options for this series."],
    ["Okay", "Decent product but took a few extra days to arrive."],
  ];
  const products = await db.product.findMany({ select: { id: true } });
  for (const p of products) {
    const count = rand() < 0.25 ? 0 : int(1, 5);
    for (let i = 0; i < count; i++) {
      const [title, body] = pick(bodies);
      const rating = pick([5, 5, 5, 4, 4, 4, 3, 5, 2]);
      const author = customers[(i + int(0, 7)) % customers.length]!;
      await db.review.create({ data: { productId: p.id, userId: author.id, authorName: author.name ?? "Customer", rating, title, body, status: "APPROVED", isVerified: false, createdAt: new Date(Date.now() - int(1, 90) * 86_400_000) } });
    }
  }
  console.log(`  reviews: ${await db.review.count()} (demo, not verified purchases)`);
}

async function seedContent() {
  if ((await db.banner.count()) === 0) {
    await db.banner.createMany({
      data: [
        { placement: "hero", title: "The Cursed Collection", subtitle: "Heavyweight hoodies and oversized tees inspired by Jujutsu Kaisen. Limited run.", ctaLabel: "Shop the drop", ctaHref: "/anime/jujutsu-kaisen", imageUrl: demoArtUrl("banner", "#6c5ce7", "Jujutsu Kaisen", "JJK"), position: 0 },
        { placement: "hero", title: "Set sail in style", subtitle: "New One Piece apparel, posters and collectibles.", ctaLabel: "Explore One Piece", ctaHref: "/anime/one-piece", imageUrl: demoArtUrl("banner", "#e74c3c", "One Piece", "OP"), position: 1 },
        { placement: "hero", title: "Mystery boxes are back", subtitle: "Surprise merch worth more than you pay. Every box is different.", ctaLabel: "Open a box", ctaHref: "/c/mystery-boxes", imageUrl: demoArtUrl("banner", "#f0506e", "Mystery", "?"), position: 2 },
        { placement: "promo", title: "Build your collector's shelf", subtitle: "Premium figures and statues, hand-painted and boxed.", ctaLabel: "Shop figures", ctaHref: "/c/figures-collectibles", imageUrl: demoArtUrl("banner", "#16a085", "Figures", "FIG"), position: 0 },
      ],
    });
  }
  if ((await db.homepageSection.count()) === 0) {
    const sections = [
      { type: "HERO" },
      { type: "CATEGORIES", title: "Shop by category" },
      { type: "PRODUCT_RAIL", title: "Trending now", subtitle: "What fans are buying this week", config: { source: "trending", href: "/shop?sort=trending" } },
      { type: "FRANCHISES", title: "Shop by anime" },
      { type: "PRODUCT_RAIL", title: "Deals of the day", subtitle: "Real discounts on in-stock favourites", config: { source: "deals", href: "/shop?sale=1&sort=discount" } },
      { type: "PRODUCT_RAIL", title: "New arrivals", config: { source: "new", href: "/shop?new=1&sort=newest" } },
      { type: "COLLECTIONS", title: "Featured collections" },
      { type: "PRODUCT_RAIL", title: "Best sellers", config: { source: "bestsellers", href: "/shop?sort=bestselling" } },
      { type: "PROMO_BANNER" },
      { type: "PRODUCT_RAIL", title: "Limited editions", subtitle: "Small batches. No restocks.", config: { source: "limited", href: "/shop?limited=1" } },
      { type: "PRODUCT_RAIL", title: "Mystery boxes & bundles", config: { source: "featured", kinds: ["MYSTERY_BOX", "BUNDLE"], href: "/c/gifts" } },
      { type: "PRODUCT_RAIL", title: "Top rated", config: { source: "top_rated", href: "/shop?sort=rating" } },
      { type: "REVIEWS", title: "Loved by fans" },
      { type: "RECENTLY_VIEWED", title: "Recently viewed" },
      { type: "VALUE_PROPS" },
      { type: "NEWSLETTER", title: "Get early access to drops", subtitle: "New releases, restocks and member-only offers. No spam." },
    ];
    await db.homepageSection.createMany({ data: sections.map((sec, i) => ({ ...sec, position: i, config: (sec as { config?: object }).config ?? {} })) });
  }
  for (const p of POLICY_PAGES) {
    await db.page.upsert({ where: { slug: p.slug }, create: { slug: p.slug, title: p.title, body: p.body, kind: p.kind }, update: {} });
  }
  await db.setting.upsert({ where: { key: "store" }, create: { key: "store", value: {} }, update: {} });
}

async function main() {
  console.log("Seeding…");
  await seedRoles();
  await seedMarkets();
  await seedTaxonomy();
  await seedProducts();
  await seedCollections();
  await seedAccountsAndReviews();
  await syncAggregates();
  await seedContent();
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
