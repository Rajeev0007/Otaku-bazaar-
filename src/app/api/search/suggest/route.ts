import { NextResponse } from "next/server";
import { getSuggestions, trendingSearches } from "@/server/catalog/search";
import { productRail, type ProductCardData } from "@/server/catalog/queries";
import { rateLimit } from "@/server/security/rate-limit";

function toSuggest(p: ProductCardData) {
  const inStockVariants = p.variants.filter((v) => v.inventory && (v.inventory.allowBackorder || v.inventory.onHand - v.inventory.reserved > 0));
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    image: p.images[0]?.url ?? null,
    price: p.minPrice,
    compareAt: p.maxCompareAt,
    currency: p.currency,
    rating: p.ratingAvg,
    ratingCount: p.ratingCount,
    inStock: p.inStock,
    franchise: p.franchise?.name ?? null,
    singleVariantId: p.variants.length === 1 && inStockVariants.length === 1 ? inStockVariants[0]!.id : null,
  };
}

export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimit(`suggest:${ip}`, 120, 60);
  if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 80);
  if (!q.trim()) {
    const [trending, popular] = await Promise.all([trendingSearches(8), productRail("bestsellers", 4)]);
    return NextResponse.json(
      { products: popular.map(toSuggest), categories: [], anime: [], didYouMean: null, trending },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
    );
  }
  const s = await getSuggestions(q);
  return NextResponse.json(
    { products: s.products.map(toSuggest), categories: s.categories, anime: s.anime, didYouMean: s.didYouMean, trending: [] },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=120" } },
  );
}
