import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/server/db";
import { Breadcrumbs } from "@/components/ui/misc";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Shop by Anime", description: "Merch from every series we carry.", alternates: { canonical: "/anime" } };

export default async function AnimeIndexPage() {
  const list = await db.animeFranchise.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: { where: { status: "ACTIVE" } } } } } });
  return (
    <div className="container-page pb-16 pt-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Anime" }]} />
      <h1 className="mb-8 mt-5 text-3xl font-semibold sm:text-4xl">Shop by anime</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((f) => (
          <Link key={f.slug} href={`/anime/${f.slug}`} className="group relative flex h-32 items-end overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface p-5 transition hover:border-line-strong">
            <div className="absolute inset-0 opacity-60 transition group-hover:opacity-100" style={{ background: `radial-gradient(120% 90% at 100% 0%, ${f.accentColor ?? "#f0506e"}55, transparent 60%)` }} />
            <div className="relative">
              <p className="text-lg font-semibold">{f.name}</p>
              <p className="text-sm text-muted">{f._count.products} products</p>
            </div>
            <Icon name="arrow-right" className="absolute right-5 top-5 text-muted transition group-hover:translate-x-0.5 group-hover:text-fg" />
          </Link>
        ))}
      </div>
    </div>
  );
}
