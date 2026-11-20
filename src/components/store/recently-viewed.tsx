"use client";

import { useEffect, useState } from "react";
import type { ProductCardData } from "@/server/catalog/queries";
import { SectionHeading } from "@/components/ui/misc";
import { ProductCard } from "@/components/store/product-card";
import { RailScroller } from "@/components/store/rail-scroller";

const KEY = "ob-recently-viewed";

export function rememberViewed(productId: string) {
  try {
    const ids: string[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    localStorage.setItem(KEY, JSON.stringify([productId, ...ids.filter((x) => x !== productId)].slice(0, 20)));
  } catch {}
}

export function RecordView({ productId }: { productId: string }) {
  useEffect(() => rememberViewed(productId), [productId]);
  return null;
}

/** Recently viewed rail. Uses this device's history (and the account's history when signed in, merged server-side). */
export function RecentlyViewed({ title = "Recently viewed", excludeId }: { title?: string; excludeId?: string }) {
  const [products, setProducts] = useState<ProductCardData[] | null>(null);
  useEffect(() => {
    let ids: string[] = [];
    try {
      ids = (JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]).filter((x) => x !== excludeId).slice(0, 12);
    } catch {}
    const ctrl = new AbortController();
    fetch(`/api/products/recent?ids=${encodeURIComponent(ids.join(","))}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: ProductCardData[]) => setProducts(list.filter((p) => p.id !== excludeId)))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [excludeId]);
  if (!products?.length) return null;
  return (
    <section className="container-page py-10 sm:py-14">
      <SectionHeading title={title} />
      <RailScroller label={title}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} className="w-[46vw] shrink-0 sm:w-[30vw] md:w-[23vw] lg:w-[18.5%] xl:w-[15.6%]" />
        ))}
      </RailScroller>
    </section>
  );
}
