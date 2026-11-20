import Link from "next/link";
import type { ProductKind } from "@prisma/client";
import { db } from "@/server/db";
import { productRail, type RailSource } from "@/server/catalog/queries";
import { ProductRail } from "@/components/store/product-rail";
import { HeroCarousel } from "@/components/store/hero-carousel";
import { RecentlyViewed } from "@/components/store/recently-viewed";
import { NewsletterForm } from "@/components/store/newsletter-form";
import { ProductImage } from "@/components/store/product-image";
import { Rating, SectionHeading } from "@/components/ui/misc";
import { Icon, type IconName } from "@/components/ui/icon";
import { organizationJsonLd, JsonLd } from "@/lib/seo";

type SectionConfig = { source?: RailSource; href?: string; kinds?: ProductKind[] };

export default async function HomePage() {
  const sections = await db.homepageSection.findMany({ where: { isActive: true }, orderBy: { position: "asc" } });
  const now = new Date();
  const rendered = await Promise.all(
    sections.map(async (s) => {
      const cfg = (s.config ?? {}) as SectionConfig;
      switch (s.type) {
        case "HERO": {
          const slides = await db.banner.findMany({
            where: { placement: "hero", isActive: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] },
            orderBy: { position: "asc" },
          });
          return <HeroCarousel key={s.id} slides={slides} />;
        }
        case "PRODUCT_RAIL": {
          const products = await productRail(cfg.source ?? "trending", 12, cfg.kinds?.length ? { kind: { in: cfg.kinds } } : {});
          return <ProductRail key={s.id} title={s.title ?? ""} subtitle={s.subtitle} href={cfg.href} products={products} />;
        }
        case "CATEGORIES":
          return <CategoryTiles key={s.id} title={s.title ?? "Shop by category"} />;
        case "FRANCHISES":
          return <FranchiseTiles key={s.id} title={s.title ?? "Shop by anime"} />;
        case "COLLECTIONS":
          return <Collections key={s.id} title={s.title ?? "Featured collections"} />;
        case "PROMO_BANNER":
          return <PromoBanner key={s.id} />;
        case "REVIEWS":
          return <Reviews key={s.id} title={s.title ?? "Loved by fans"} />;
        case "RECENTLY_VIEWED":
          return <RecentlyViewed key={s.id} title={s.title ?? "Recently viewed"} />;
        case "VALUE_PROPS":
          return <ValueProps key={s.id} />;
        case "NEWSLETTER":
          return <Newsletter key={s.id} title={s.title} subtitle={s.subtitle} />;
        default:
          return null;
      }
    }),
  );
  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      {rendered}
    </>
  );
}

async function CategoryTiles({ title }: { title: string }) {
  const cats = await db.category.findMany({ where: { isActive: true, parentId: null }, orderBy: { position: "asc" }, take: 10, include: { _count: { select: { products: true } } } });
  return (
    <section className="container-page py-10 sm:py-14">
      <SectionHeading title={title} href="/shop" linkLabel="All products" />
      <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-5 sm:gap-4 sm:overflow-visible sm:px-0">
        {cats.map((c) => (
          <Link key={c.slug} href={`/c/${c.slug}`} className="group relative aspect-[3/4] w-[38vw] shrink-0 overflow-hidden rounded-[var(--radius-card)] bg-surface-2 sm:w-auto">
            {c.imageUrl && <ProductImage src={c.imageUrl} alt="" fill sizes="(min-width: 640px) 20vw, 38vw" className="object-cover transition duration-700 group-hover:scale-105" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />
            <div className="absolute inset-x-4 bottom-4 text-white">
              <p className="font-semibold leading-tight">{c.name}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-white/70 transition group-hover:text-white">
                Shop now <Icon name="arrow-right" size={12} />
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

async function FranchiseTiles({ title }: { title: string }) {
  const list = await db.animeFranchise.findMany({ orderBy: [{ isTrending: "desc" }, { position: "asc" }], take: 10, include: { _count: { select: { products: true } } } });
  return (
    <section className="container-page py-10 sm:py-14">
      <SectionHeading eyebrow="Trending anime" title={title} href="/anime" linkLabel="All series" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {list.map((f) => (
          <Link key={f.slug} href={`/anime/${f.slug}`} className="group relative flex h-28 items-end overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface p-4 transition hover:border-line-strong sm:h-36">
            <div className="absolute inset-0 opacity-60 transition duration-500 group-hover:opacity-100" style={{ background: `radial-gradient(120% 90% at 100% 0%, ${f.accentColor ?? "#f0506e"}55, transparent 60%)` }} />
            <div className="relative">
              <p className="font-semibold">{f.name}</p>
              <p className="text-xs text-muted">{f._count.products} products</p>
            </div>
            <Icon name="arrow-right" size={18} className="absolute right-4 top-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-fg" />
          </Link>
        ))}
      </div>
    </section>
  );
}

async function Collections({ title }: { title: string }) {
  const cols = await db.collection.findMany({ where: { isActive: true, isFeatured: true }, orderBy: { position: "asc" }, take: 3 });
  if (!cols.length) return null;
  return (
    <section className="container-page py-10 sm:py-14">
      <SectionHeading title={title} />
      <div className="grid gap-4 md:grid-cols-3">
        {cols.map((c, i) => (
          <Link key={c.slug} href={`/collections/${c.slug}`} className={`group relative overflow-hidden rounded-[var(--radius-card)] bg-surface-2 ${i === 0 ? "aspect-[4/3] md:row-span-2 md:aspect-auto" : "aspect-[16/9]"}`}>
            {c.imageUrl && <ProductImage src={c.imageUrl} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition duration-700 group-hover:scale-105" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
            <div className="absolute inset-x-6 bottom-6 text-white">
              <p className="text-xl font-semibold">{c.name}</p>
              {c.description && <p className="mt-1 max-w-sm text-sm text-white/70">{c.description}</p>}
              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium">
                Explore <Icon name="arrow-right" size={14} className="transition group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

async function PromoBanner() {
  const b = await db.banner.findFirst({ where: { placement: "promo", isActive: true }, orderBy: { position: "asc" } });
  if (!b) return null;
  return (
    <section className="container-page py-10 sm:py-14">
      <div className="relative overflow-hidden rounded-[1.75rem] bg-surface">
        <ProductImage src={b.imageUrl} alt="" fill sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent" />
        <div className="relative max-w-xl p-8 sm:p-14">
          <h2 className="text-3xl font-semibold text-white sm:text-4xl">{b.title}</h2>
          {b.subtitle && <p className="mt-3 text-white/75">{b.subtitle}</p>}
          {b.ctaHref && (
            <Link href={b.ctaHref} className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-black hover:bg-white/90">
              {b.ctaLabel ?? "Shop now"} <Icon name="arrow-right" size={16} />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

async function Reviews({ title }: { title: string }) {
  const reviews = await db.review.findMany({
    where: { status: "APPROVED", rating: { gte: 4 } },
    orderBy: [{ helpfulCount: "desc" }, { createdAt: "desc" }],
    take: 6,
    include: { product: { select: { name: true, slug: true } } },
  });
  if (!reviews.length) return null;
  return (
    <section className="container-page py-10 sm:py-14">
      <SectionHeading title={title} />
      <div className="scrollbar-none snap-rail -mx-4 flex gap-4 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0">
        {reviews.map((r) => (
          <figure key={r.id} className="w-[80vw] shrink-0 rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:w-auto">
            <Rating value={r.rating} />
            {r.title && <p className="mt-4 font-semibold">{r.title}</p>}
            <blockquote className="mt-2 line-clamp-4 text-sm text-muted">“{r.body}”</blockquote>
            <figcaption className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4 text-xs">
              <span className="font-medium">
                {r.authorName}
                {r.isVerified && <span className="ml-2 text-success">✓ Verified purchase</span>}
              </span>
              <Link href={`/p/${r.product.slug}`} className="truncate text-muted hover:text-fg">
                {r.product.name}
              </Link>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function ValueProps() {
  const items: [IconName, string, string][] = [
    ["truck", "Free shipping over ₹999", "Fast, tracked delivery across India"],
    ["refresh", "Easy returns", "7-day returns on eligible items"],
    ["shield", "Secure checkout", "UPI, cards, net banking & more"],
    ["sparkles", "Premium quality", "Every piece checked before dispatch"],
  ];
  return (
    <section className="container-page py-10">
      <div className="grid grid-cols-2 gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:gap-6 sm:p-8 lg:grid-cols-4">
        {items.map(([icon, title, body]) => (
          <div key={title} className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
              <Icon name={icon} size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-0.5 text-xs text-muted">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Newsletter({ title, subtitle }: { title: string | null; subtitle: string | null }) {
  return (
    <section className="container-page py-10 sm:py-14">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-line bg-surface p-8 sm:p-14">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative grid items-center gap-8 lg:grid-cols-2">
          <div>
            <p className="eyebrow mb-3">Newsletter</p>
            <h2 className="text-3xl font-semibold">{title ?? "Get early access to drops"}</h2>
            {subtitle && <p className="mt-3 text-muted">{subtitle}</p>}
          </div>
          <NewsletterForm source="homepage" />
        </div>
      </div>
    </section>
  );
}
