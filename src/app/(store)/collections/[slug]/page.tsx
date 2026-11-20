import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "@/server/db";
import { ProductListing, type SearchParams } from "@/components/store/listing";

const getCollection = cache((slug: string) => {
  const now = new Date();
  return db.collection.findFirst({
    where: { slug, isActive: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] },
  });
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await getCollection((await params).slug);
  if (!c) return {};
  return { title: c.seoTitle ?? c.name, description: c.seoDescription ?? c.description ?? undefined, alternates: { canonical: `/collections/${c.slug}` } };
}

export default async function CollectionPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: SearchParams }) {
  const { slug } = await params;
  const c = await getCollection(slug);
  if (!c) notFound();
  return (
    <ProductListing
      scope={{ collectionSlug: c.slug }}
      eyebrow="Collection"
      title={c.name}
      description={c.description}
      crumbs={[{ label: "Home", href: "/" }, { label: "Collections" }, { label: c.name }]}
      searchParams={await searchParams}
      basePath={`/collections/${c.slug}`}
    />
  );
}
