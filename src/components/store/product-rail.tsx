import type { ProductCardData } from "@/server/catalog/queries";
import { SectionHeading } from "@/components/ui/misc";
import { ProductCard } from "@/components/store/product-card";
import { RailScroller } from "@/components/store/rail-scroller";

export function ProductRail({ title, subtitle, href, products, eyebrow }: { title: string; subtitle?: string | null; href?: string; products: ProductCardData[]; eyebrow?: string }) {
  if (!products.length) return null;
  return (
    <section className="container-page py-10 sm:py-14">
      <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} href={href} />
      <RailScroller label={title}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} className="w-[46vw] shrink-0 sm:w-[30vw] md:w-[23vw] lg:w-[18.5%] xl:w-[15.6%]" />
        ))}
      </RailScroller>
    </section>
  );
}

export function ProductGrid({ products, view = "grid", priorityCount = 4 }: { products: ProductCardData[]; view?: "grid" | "list"; priorityCount?: number }) {
  if (view === "list") {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        {products.map((p, i) => (
          <ProductCard key={p.id} product={p} layout="list" priority={i < 2} />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4 [.dense_&]:md:grid-cols-4 [.dense_&]:xl:grid-cols-5">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < priorityCount} />
      ))}
    </div>
  );
}
