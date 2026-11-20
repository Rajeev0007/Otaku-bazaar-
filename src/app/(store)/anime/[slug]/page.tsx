import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "@/server/db";
import { ProductListing, type SearchParams } from "@/components/store/listing";
import { ProductImage } from "@/components/store/product-image";

const getFranchise = cache((slug: string) => db.animeFranchise.findUnique({ where: { slug }, include: { _count: { select: { products: true } } } }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const f = await getFranchise((await params).slug);
  if (!f) return {};
  return {
    title: f.seoTitle ?? `${f.name} Merch — T-Shirts, Hoodies, Figures & More`,
    description: f.seoDescription ?? `Shop ${f.name} merchandise: apparel, collectibles, posters and accessories. Fast shipping across India.`,
    alternates: { canonical: `/anime/${f.slug}` },
    openGraph: f.bannerUrl ? { images: [f.bannerUrl] } : undefined,
  };
}

export default async function FranchisePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: SearchParams }) {
  const { slug } = await params;
  const f = await getFranchise(slug);
  if (!f) notFound();
  return (
    <ProductListing
      scope={{ franchiseSlug: f.slug }}
      title={f.name}
      crumbs={[{ label: "Home", href: "/" }, { label: "Anime", href: "/anime" }, { label: f.name }]}
      searchParams={await searchParams}
      basePath={`/anime/${f.slug}`}
      hideFacets={["anime"]}
      hero={
        <header className="relative mb-8 mt-5 overflow-hidden rounded-[1.75rem] border border-line bg-surface">
          {f.bannerUrl && <ProductImage src={f.bannerUrl} alt="" fill priority sizes="100vw" className="object-cover opacity-70" />}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent" />
          <div className="relative px-6 py-12 sm:px-12 sm:py-16">
            <p className="eyebrow mb-3 text-white/70">Anime collection · {f._count.products} products</p>
            <h1 className="text-4xl font-semibold text-white sm:text-5xl">{f.name}</h1>
            {f.description && <p className="mt-3 max-w-xl text-white/75">{f.description}</p>}
          </div>
        </header>
      }
    />
  );
}
