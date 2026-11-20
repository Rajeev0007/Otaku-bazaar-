import { appUrl } from "@/lib/utils";
import { toMajor } from "@/lib/money";

/** Renders JSON-LD safely: "<" is escaped so content can never close the script tag. */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "The Otaku Bazaar",
    url: appUrl("/"),
    logo: appUrl("/img/logo.png"),
  };
}

export function breadcrumbJsonLd(items: { label: string; href?: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, item: c.href ? appUrl(c.href) : undefined })),
  };
}

export function productJsonLd(p: {
  name: string;
  slug: string;
  description: string;
  images: string[];
  sku: string;
  brand?: string | null;
  currency: string;
  minPrice: number;
  maxPrice: number;
  inStock: boolean;
  ratingAvg: number;
  ratingCount: number;
}) {
  const url = appUrl(`/p/${p.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description.slice(0, 500),
    image: p.images.map((i) => (i.startsWith("http") ? i : appUrl(i))),
    sku: p.sku,
    brand: p.brand ? { "@type": "Brand", name: p.brand } : undefined,
    url,
    offers: {
      "@type": p.minPrice === p.maxPrice ? "Offer" : "AggregateOffer",
      priceCurrency: p.currency,
      ...(p.minPrice === p.maxPrice ? { price: toMajor(p.minPrice, p.currency) } : { lowPrice: toMajor(p.minPrice, p.currency), highPrice: toMajor(p.maxPrice, p.currency) }),
      availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url,
    },
    // Only include ratings when real reviews exist.
    ...(p.ratingCount > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.ratingAvg, reviewCount: p.ratingCount } } : {}),
  };
}
