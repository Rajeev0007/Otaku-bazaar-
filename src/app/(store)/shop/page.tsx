import type { Metadata } from "next";
import { ProductListing, type SearchParams } from "@/components/store/listing";
import { parseFilters } from "@/lib/catalog-filters";

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const f = parseFilters(await searchParams);
  const title = f.sale ? "Sale" : f.isNew ? "New Arrivals" : f.limited ? "Limited Editions" : "Shop All Anime Merch";
  return {
    title,
    description: "Browse anime apparel, figures, posters, phone cases and accessories. Filter by anime, size, colour and price.",
    alternates: { canonical: "/shop" },
  };
}

export default async function ShopPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const f = parseFilters(sp);
  const title = f.sale ? "Sale" : f.isNew ? "New arrivals" : f.limited ? "Limited editions" : "All products";
  const description = f.sale
    ? "Real markdowns on in-stock favourites."
    : f.isNew
      ? "The latest drops, fresh from the studio."
      : f.limited
        ? "Small-batch releases. Once they're gone, they're gone."
        : "Apparel, collectibles, wall art and accessories from the series you love.";
  return <ProductListing title={title} description={description} crumbs={[{ label: "Home", href: "/" }, { label: title }]} searchParams={sp} basePath="/shop" />;
}
