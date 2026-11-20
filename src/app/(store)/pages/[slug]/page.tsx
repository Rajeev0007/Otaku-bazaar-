import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "@/server/db";
import { Breadcrumbs } from "@/components/ui/misc";
import { Markdown } from "@/lib/markdown";

const getPage = cache((slug: string) => db.page.findFirst({ where: { slug, isPublished: true } }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getPage((await params).slug);
  if (!p) return {};
  return { title: p.seoTitle ?? p.title, description: p.seoDescription ?? undefined, alternates: { canonical: `/pages/${p.slug}` } };
}

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const page = await getPage((await params).slug);
  if (!page) notFound();
  return (
    <div className="container-page pb-16 pt-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: page.title }]} />
      <article className="mx-auto mt-8 max-w-3xl">
        <h1 className="text-3xl font-semibold sm:text-4xl">{page.title}</h1>
        <p className="mt-2 text-xs text-subtle">Last updated {page.updatedAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
        <Markdown source={page.body} className="prose-store mt-6" />
      </article>
    </div>
  );
}
