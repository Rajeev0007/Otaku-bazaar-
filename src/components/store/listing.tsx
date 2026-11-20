import Link from "next/link";
import { Suspense } from "react";
import { filtersToSearchParams, parseFilters, PAGE_SIZE, type ListingFilters } from "@/lib/catalog-filters";
import { getFacets, listProducts, type ListingScope } from "@/server/catalog/queries";
import { getStoreSettings } from "@/server/settings";
import { Breadcrumbs, EmptyState, Pagination, type Crumb } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { ProductGrid } from "@/components/store/product-rail";
import { FilterPanel, ListingToolbar, ActiveFilters } from "@/components/store/filters";
import { breadcrumbJsonLd, JsonLd } from "@/lib/seo";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function ProductListing({
  scope = {},
  title,
  description,
  eyebrow,
  crumbs,
  searchParams,
  basePath,
  hideFacets = [],
  hero,
}: {
  scope?: ListingScope;
  title: string;
  description?: string | null;
  eyebrow?: string;
  crumbs: Crumb[];
  searchParams: Awaited<SearchParams>;
  basePath: string;
  hideFacets?: ("categories" | "anime")[];
  hero?: React.ReactNode;
}) {
  const filters = parseFilters(searchParams);
  const settings = await getStoreSettings();
  const scopeKey = JSON.stringify(scope);
  const [result, facets] = await Promise.all([listProducts(filters, scope, settings.baseCurrency), getFacets(scopeKey, scope)]);
  const hrefFor = (page: number) => {
    const p = filtersToSearchParams({ ...filters, page });
    const qs = p.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const from = result.total === 0 ? 0 : (result.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(result.total, result.page * PAGE_SIZE);
  const dense = searchParams.density === "dense";

  return (
    <div className="container-page pb-10 pt-6">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      {hero ?? (
        <header className="mb-6 mt-5 sm:mb-8">
          {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
          <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-muted">{description}</p>}
        </header>
      )}
      <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-10">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pb-8 pr-2">
            <Suspense>
              <FilterPanel facets={facets} currency={settings.baseCurrency} hide={hideFacets} />
            </Suspense>
          </div>
        </aside>
        <div className="min-w-0">
          <Suspense>
            <ListingToolbar total={result.total} from={from} to={to} facets={facets} currency={settings.baseCurrency} hide={hideFacets} />
            <ActiveFilters facets={facets} />
          </Suspense>
          {result.products.length ? (
            <div className={dense ? "dense" : undefined}>
              <ProductGrid products={result.products} view={filters.view} />
              <div className="mt-12">
                <Pagination page={result.page} pageCount={result.pageCount} hrefFor={hrefFor} />
              </div>
            </div>
          ) : (
            <NoResults filters={filters} basePath={basePath} />
          )}
        </div>
      </div>
    </div>
  );
}

function NoResults({ filters, basePath }: { filters: ListingFilters; basePath: string }) {
  return (
    <EmptyState
      icon="search"
      title={filters.q ? `No results for “${filters.q}”` : "No products match these filters"}
      description="Try removing a filter, widening the price range, or searching for an anime name or product type."
      action={
        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink href={basePath} variant="outline">Clear all filters</ButtonLink>
          <ButtonLink href="/shop?sort=trending">Browse trending</ButtonLink>
        </div>
      }
      className="mt-6"
    />
  );
}

export function ListingSkeleton() {
  return (
    <div className="container-page pb-10 pt-6">
      <div className="skeleton h-3 w-40 rounded" />
      <div className="skeleton mt-6 h-9 w-72 rounded-lg" />
      <div className="mt-10 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:ml-[300px] xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i}>
            <div className="skeleton aspect-[4/5] rounded-[var(--radius-card)]" />
            <div className="skeleton mt-3 h-3 w-1/3 rounded" />
            <div className="skeleton mt-2 h-4 w-4/5 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CategoryChips({ items }: { items: { slug: string; name: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="scrollbar-none -mx-4 mb-6 flex gap-2 overflow-x-auto px-4">
      {items.map((c) => (
        <Link key={c.slug} href={`/c/${c.slug}`} className="shrink-0 rounded-full border border-line px-4 py-2 text-sm text-muted transition hover:border-fg hover:text-fg">
          {c.name}
        </Link>
      ))}
    </div>
  );
}
