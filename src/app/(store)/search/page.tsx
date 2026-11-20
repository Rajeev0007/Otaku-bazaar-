import type { Metadata } from "next";
import { ProductListing, type SearchParams } from "@/components/store/listing";
import { parseFilters } from "@/lib/catalog-filters";
import { correctQuery, logSearch, searchProductIds } from "@/server/catalog/search";
import { getCurrentUser } from "@/server/auth/session";
import { SearchHistoryRecorder } from "@/components/store/search-history";

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const q = parseFilters(await searchParams).q;
  // Search result pages should not be indexed.
  return { title: q ? `Search: ${q}` : "Search", robots: { index: false, follow: true } };
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const f = parseFilters(sp);
  const corrected = f.q ? await correctQuery(f.q) : null;
  if (f.q && f.page === 1) {
    const [ids, user] = await Promise.all([searchProductIds(f.q, 500), getCurrentUser()]);
    await logSearch(f.q, ids.length, user?.id);
  }
  return (
    <>
      {f.q && <SearchHistoryRecorder q={f.q} />}
      <ProductListing
        title={f.q ? `Results for “${f.q}”` : "Search"}
        description={f.q ? (corrected ? `Including results for “${corrected}”` : null) : "Search by product name, anime, category, tag or SKU."}
        crumbs={[{ label: "Home", href: "/" }, { label: "Search" }]}
        searchParams={sp}
        basePath="/search"
      />
    </>
  );
}
