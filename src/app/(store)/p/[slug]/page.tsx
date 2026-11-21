import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { frequentlyBoughtTogether, getProductBySlug, ratingBreakdown, relatedProducts } from "@/server/catalog/queries";
import { availableQuantity } from "@/server/inventory/service";
import { getStoreSettings } from "@/server/settings";
import { getCurrentUser } from "@/server/auth/session";
import { recordView } from "@/server/wishlist/service";
import { Badge, Breadcrumbs, Rating } from "@/components/ui/misc";
import { Icon } from "@/components/ui/icon";
import { ProductGallery } from "@/components/store/product-gallery";
import { PurchasePanel, type PanelVariant } from "@/components/store/purchase-panel";
import { TrackOnMount } from "@/components/store/analytics";
import { ProductRail } from "@/components/store/product-rail";
import { ProductCard } from "@/components/store/product-card";
import { RecentlyViewed, RecordView } from "@/components/store/recently-viewed";
import { AskQuestion, ShareButton } from "@/components/store/product-extras";
import { ProductImage } from "@/components/store/product-image";
import { Markdown } from "@/lib/markdown";
import { formatMoney } from "@/lib/money";
import { breadcrumbJsonLd, JsonLd, productJsonLd } from "@/lib/seo";
import { appUrl, cn } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProductBySlug((await params).slug);
  if (!p) return { title: "Product not found" };
  const description = p.seoDescription ?? p.description.split("\n")[0]!.slice(0, 160);
  const image = p.images[0]?.url;
  return {
    title: p.seoTitle ?? p.name,
    description,
    alternates: { canonical: `/p/${p.slug}` },
    openGraph: { title: p.name, description, images: image ? [image] : undefined, type: "website" },
  };
}

const REVIEW_SORTS = { recent: "Most recent", helpful: "Most helpful", high: "Highest rated", low: "Lowest rated" } as const;

export default async function ProductPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const settings = await getStoreSettings();
  const user = await getCurrentUser();
  await recordView(user?.id ?? null, product.id);

  const rsort = (sp.rsort && sp.rsort in REVIEW_SORTS ? sp.rsort : "recent") as keyof typeof REVIEW_SORTS;
  const rstar = sp.rstar ? Math.min(5, Math.max(1, Number(sp.rstar) || 0)) : undefined;
  const [breakdown, reviews, questions, related, fbt, customerPhotos] = await Promise.all([
    ratingBreakdown(product.id),
    db.review.findMany({
      where: { productId: product.id, status: "APPROVED", ...(rstar ? { rating: rstar } : {}) },
      orderBy: rsort === "helpful" ? [{ helpfulCount: "desc" }] : rsort === "high" ? [{ rating: "desc" }, { createdAt: "desc" }] : rsort === "low" ? [{ rating: "asc" }, { createdAt: "desc" }] : [{ createdAt: "desc" }],
      take: 10,
    }),
    db.productQuestion.findMany({ where: { productId: product.id, status: "APPROVED", answer: { not: null } }, orderBy: { answeredAt: "desc" }, take: 8 }),
    relatedProducts(product, 12),
    frequentlyBoughtTogether(product, 3),
    db.review.findMany({ where: { productId: product.id, status: "APPROVED", photos: { isEmpty: false } }, select: { id: true, photos: true, authorName: true }, take: 12 }),
  ]);

  const variants: PanelVariant[] = product.variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    title: v.title,
    size: v.size,
    color: v.color,
    colorHex: v.colorHex,
    style: v.style,
    price: v.price,
    compareAtPrice: v.compareAtPrice,
    available: Math.min(availableQuantity(v.inventory), 999),
    lowStockThreshold: v.inventory?.lowStockThreshold ?? 5,
  }));
  const returnDays = product.returnWindowDays ?? product.category.returnWindowDays ?? 7;
  const crumbs = [
    { label: "Home", href: "/" },
    ...(product.category.parent ? [{ label: product.category.parent.name, href: `/c/${product.category.parent.slug}` }] : []),
    { label: product.category.name, href: `/c/${product.category.slug}` },
    { label: product.name },
  ];
  const specs: [string, string][] = [
    ...(product.material ? [["Material", product.material] as [string, string]] : []),
    ...(product.dimensions ? [["Dimensions", product.dimensions] as [string, string]] : []),
    ["Weight", `${product.weightGrams} g (approx.)`],
    ...(product.brand ? [["Brand", product.brand.name] as [string, string]] : []),
    ...(product.franchise ? [["Series", product.franchise.name] as [string, string]] : []),
    ...(product.warranty ? [["Warranty", product.warranty] as [string, string]] : []),
    ...Object.entries((product.specs as Record<string, string> | null) ?? {}),
  ];
  const isApparel = product.variants.some((v) => v.size && ["S", "M", "L", "XL"].includes(v.size));
  const totalReviews = breakdown.reduce((n, b) => n + b.count, 0);
  const badge = product.isLimited ? <Badge tone="gold">Limited edition</Badge> : product.discountPercent >= 10 ? <Badge tone="accent">-{product.discountPercent}%</Badge> : product.isNewArrival ? <Badge tone="glass">New</Badge> : null;

  return (
    <>
      <JsonLd
        data={productJsonLd({
          name: product.name,
          slug: product.slug,
          description: product.description,
          images: product.images.map((i) => i.url),
          sku: product.variants[0]?.sku ?? product.id,
          brand: product.brand?.name,
          currency: product.currency,
          minPrice: product.minPrice,
          maxPrice: product.maxPrice,
          inStock: product.inStock,
          ratingAvg: product.ratingAvg,
          ratingCount: product.ratingCount,
        })}
      />
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <RecordView productId={product.id} />

      <div className="container-page pt-4 sm:pt-6">
        <Breadcrumbs items={crumbs} className="mb-4 sm:mb-6" />
        <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
          <ProductGallery images={product.images} videoUrl={product.videoUrl} name={product.name} badge={badge} />

          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="flex items-start justify-between gap-4">
              {product.franchise ? (
                <Link href={`/anime/${product.franchise.slug}`} className="eyebrow hover:text-fg">
                  {product.franchise.name}
                </Link>
              ) : (
                <span className="eyebrow">{product.category.name}</span>
              )}
              <ShareButton title={product.name} url={appUrl(`/p/${product.slug}`)} />
            </div>
            <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">{product.name}</h1>
            {product.subtitle && <p className="mt-1.5 text-muted">{product.subtitle}</p>}
            {product.ratingCount > 0 && (
              <a href="#reviews" className="mt-3 inline-flex items-center gap-2 text-sm">
                <Rating value={product.ratingAvg} showValue />
                <span className="text-muted underline-offset-4 hover:underline">{product.ratingCount} reviews</span>
              </a>
            )}

            <div className="mt-6">
              <TrackOnMount name="product_view" data={{ productId: product.id }} />
              <PurchasePanel
                productId={product.id}
                productName={product.name}
                currency={product.currency}
                variants={variants}
                maxQty={settings.maxQtyPerLine}
                hasSizeGuide={isApparel}
                taxNote={settings.taxInclusive ? `Inclusive of ${settings.taxLabel}` : "Taxes calculated at checkout"}
              />
            </div>

            <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <Perk icon="truck" title={settings.freeShippingThreshold > 0 ? `Free shipping over ${formatMoney(settings.freeShippingThreshold, settings.baseCurrency)}` : "Tracked delivery"} body="Tracked delivery across India" />
              <Perk icon="refresh" title={product.returnable && returnDays > 0 ? `${returnDays}-day returns` : "Non-returnable"} body={product.returnable && returnDays > 0 ? "On unused items with tags" : "Final sale. Defects are always covered."} href="/pages/returns-policy" />
              <Perk icon="shield" title="Secure checkout" body="Payments via trusted gateways" />
              <Perk icon="sparkles" title="Quality checked" body={product.authenticity && !product.authenticity.startsWith("[") ? product.authenticity : "Inspected before dispatch"} />
            </ul>

            {product.bundleItems.length > 0 && (
              <div className="mt-6 rounded-[var(--radius-card)] border border-line p-4">
                <p className="text-sm font-semibold">What's in the bundle</p>
                <ul className="mt-2 space-y-1 text-sm text-muted">
                  {product.bundleItems.map((b) => (
                    <li key={b.childId}>
                      {b.quantity} × <Link href={`/p/${b.child.slug}`} className="hover:text-fg hover:underline">{b.child.name}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-8 divide-y divide-line border-y border-line">
              <Accordion title="Description" defaultOpen>
                <Markdown source={product.description} />
              </Accordion>
              <Accordion title="Specifications">
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                  {specs.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-muted">{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </Accordion>
              {product.careInstructions && (
                <Accordion title="Care instructions">
                  <p className="text-sm text-muted">{product.careInstructions}</p>
                </Accordion>
              )}
              {isApparel && (
                <Accordion title="Size guide" id="size-guide">
                  <SizeGuide />
                </Accordion>
              )}
              <Accordion title="Shipping & returns">
                <div className="space-y-2 text-sm text-muted">
                  <p>Orders are dispatched within 1–2 business days. Use the delivery checker above for dates to your PIN code.</p>
                  <p>{product.returnable && returnDays > 0 ? `Return eligible items within ${returnDays} days of delivery.` : "This item can't be returned unless it arrives damaged or defective."}{" "}
                    <Link href="/pages/returns-policy" className="text-accent hover:underline">Read the policy</Link>
                  </p>
                </div>
              </Accordion>
            </div>
          </div>
        </div>
      </div>

      {fbt.length > 0 && (
        <section className="container-page pt-16">
          <h2 className="mb-6 text-2xl font-semibold">Frequently bought together</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {fbt.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      <section id="reviews" className="container-page scroll-mt-24 pt-16">
        <h2 className="mb-6 text-2xl font-semibold">Customer reviews</h2>
        <div className="grid gap-10 lg:grid-cols-[320px_1fr]">
          <div>
            {totalReviews > 0 ? (
              <>
                <div className="flex items-end gap-3">
                  <span className="text-5xl font-semibold">{product.ratingAvg.toFixed(1)}</span>
                  <div className="pb-1.5">
                    <Rating value={product.ratingAvg} size={16} />
                    <p className="mt-1 text-xs text-muted">{totalReviews} reviews</p>
                  </div>
                </div>
                <ul className="mt-6 space-y-2">
                  {breakdown.map((b) => (
                    <li key={b.rating}>
                      <Link href={`?rstar=${rstar === b.rating ? "" : b.rating}&rsort=${rsort}#reviews`} scroll={false} className={cn("flex items-center gap-3 text-sm", rstar === b.rating ? "text-fg" : "text-muted hover:text-fg")}>
                        <span className="w-6">{b.rating}★</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <span className="block h-full rounded-full bg-gold" style={{ width: `${totalReviews ? (b.count / totalReviews) * 100 : 0}%` }} />
                        </span>
                        <span className="w-8 text-right text-xs">{b.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-muted">No reviews yet.</p>
            )}
            <p className="mt-6 rounded-2xl bg-surface-2 p-4 text-xs text-muted">Reviews can be written from your account after your order is delivered. Reviews from confirmed orders show a Verified purchase badge.</p>
          </div>
          <div>
            {customerPhotos.length > 0 && (
              <div className="mb-8">
                <p className="mb-3 text-sm font-semibold">Customer photos</p>
                <div className="scrollbar-none flex gap-2 overflow-x-auto">
                  {customerPhotos.flatMap((r) => r.photos.map((url) => ({ url, by: r.authorName, id: r.id }))).map((ph) => (
                    <div key={ph.url} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                      <ProductImage src={ph.url} alt={`Photo by ${ph.by}`} fill sizes="96px" className="object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {totalReviews > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted">Sort:</span>
                {Object.entries(REVIEW_SORTS).map(([k, label]) => (
                  <Link key={k} href={`?rsort=${k}${rstar ? `&rstar=${rstar}` : ""}#reviews`} scroll={false} className={cn("rounded-full px-3 py-1.5", rsort === k ? "bg-fg text-bg" : "border border-line hover:border-fg")}>
                    {label}
                  </Link>
                ))}
                {rstar && (
                  <Link href={`?rsort=${rsort}#reviews`} scroll={false} className="ml-2 text-accent hover:underline">
                    Clear {rstar}★ filter
                  </Link>
                )}
              </div>
            )}
            <ul className="divide-y divide-line">
              {reviews.map((r) => (
                <li key={r.id} className="py-5">
                  <div className="flex items-center justify-between gap-3">
                    <Rating value={r.rating} />
                    <time className="text-xs text-subtle" dateTime={r.createdAt.toISOString()}>
                      {r.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </time>
                  </div>
                  {r.title && <p className="mt-2 font-semibold">{r.title}</p>}
                  <p className="mt-1 text-sm text-muted">{r.body}</p>
                  <p className="mt-2 text-xs">
                    <span className="font-medium">{r.authorName}</span>
                    {r.isVerified && <span className="ml-2 text-success">✓ Verified purchase</span>}
                  </p>
                </li>
              ))}
              {totalReviews > 0 && reviews.length === 0 && <li className="py-6 text-sm text-muted">No reviews match this filter.</li>}
            </ul>
          </div>
        </div>
      </section>

      <section className="container-page pt-16">
        <h2 className="mb-6 text-2xl font-semibold">Questions & answers</h2>
        {questions.length > 0 ? (
          <ul className="mb-6 space-y-4">
            {questions.map((q) => (
              <li key={q.id} className="rounded-2xl border border-line p-4">
                <p className="text-sm font-semibold">Q: {q.question}</p>
                <p className="mt-1.5 text-sm text-muted">A: {q.answer}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-muted">No questions yet. Ask our team anything about this product.</p>
        )}
        <AskQuestion productId={product.id} />
      </section>

      <div className="pt-6">
        <ProductRail title={product.franchise ? `More from ${product.franchise.name}` : "You may also like"} products={related} href={product.franchise ? `/anime/${product.franchise.slug}` : `/c/${product.category.slug}`} />
        <RecentlyViewed excludeId={product.id} />
      </div>
    </>
  );
}

function Perk({ icon, title, body, href }: { icon: "truck" | "refresh" | "shield" | "sparkles"; title: string; body: string; href?: string }) {
  const inner = (
    <>
      <Icon name={icon} size={18} className="mt-0.5 shrink-0 text-accent" />
      <span>
        <span className="block font-medium">{title}</span>
        <span className="text-xs text-muted">{body}</span>
      </span>
    </>
  );
  return <li>{href ? <Link href={href} className="flex gap-3 rounded-2xl bg-surface p-3 hover:bg-surface-2">{inner}</Link> : <div className="flex gap-3 rounded-2xl bg-surface p-3">{inner}</div>}</li>;
}

function Accordion({ title, children, defaultOpen, id }: { title: string; children: React.ReactNode; defaultOpen?: boolean; id?: string }) {
  return (
    <details id={id} open={defaultOpen} className="group scroll-mt-24">
      <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-[0.95rem] font-medium">
        {title}
        <Icon name="plus" size={18} className="text-muted transition group-open:rotate-45" />
      </summary>
      <div className="pb-5">{children}</div>
    </details>
  );
}

function SizeGuide() {
  const rows = [
    ["S", "40", "27.5", "21"],
    ["M", "42", "28.5", "21.5"],
    ["L", "44", "29.5", "22"],
    ["XL", "46", "30.5", "22.5"],
    ["XXL", "48", "31.5", "23"],
  ];
  return (
    <div>
      <p className="mb-3 text-xs text-muted">Garment measurements in inches (oversized fit). Size down for a regular fit.</p>
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-muted">
          <tr>
            <th className="py-2 font-medium">Size</th>
            <th className="py-2 font-medium">Chest</th>
            <th className="py-2 font-medium">Length</th>
            <th className="py-2 font-medium">Shoulder</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r[0]}>
              {r.map((c, i) => (
                <td key={i} className={cn("py-2", i === 0 && "font-medium")}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
