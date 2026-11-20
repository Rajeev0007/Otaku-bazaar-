import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "@/server/db";
import { CategoryChips, ProductListing, type SearchParams } from "@/components/store/listing";

const getCategory = cache((slug: string) =>
  db.category.findFirst({
    where: { slug, isActive: true },
    include: { parent: { select: { slug: true, name: true } }, children: { where: { isActive: true }, orderBy: { position: "asc" }, select: { slug: true, name: true } } },
  }),
);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await getCategory((await params).slug);
  if (!c) return {};
  return {
    title: c.seoTitle ?? `${c.name} — Anime ${c.name}`,
    description: c.seoDescription ?? c.description ?? `Shop anime ${c.name.toLowerCase()} at The Otaku Bazaar.`,
    alternates: { canonical: `/c/${c.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: SearchParams }) {
  const { slug } = await params;
  const c = await getCategory(slug);
  if (!c) notFound();
  const crumbs = [{ label: "Home", href: "/" }, { label: "Shop", href: "/shop" }, ...(c.parent ? [{ label: c.parent.name, href: `/c/${c.parent.slug}` }] : []), { label: c.name }];
  return (
    <ProductListing
      scope={{ categorySlug: c.slug }}
      title={c.name}
      description={c.description}
      crumbs={crumbs}
      searchParams={await searchParams}
      basePath={`/c/${c.slug}`}
      hideFacets={c.children.length ? [] : ["categories"]}
      hero={
        <header className="mb-6 mt-5">
          <h1 className="text-3xl font-semibold sm:text-4xl">{c.name}</h1>
          {c.description && <p className="mt-2 max-w-2xl text-muted">{c.description}</p>}
          <div className="mt-5">
            <CategoryChips items={c.children} />
          </div>
        </header>
      }
    />
  );
}
