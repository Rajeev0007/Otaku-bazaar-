"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { ProductImage } from "@/components/store/product-image";

type Slide = { id: string; title: string; subtitle: string | null; ctaLabel: string | null; ctaHref: string | null; imageUrl: string; mobileImageUrl: string | null };

export function HeroCarousel({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef<number | null>(null);
  const n = slides.length;

  useEffect(() => {
    if (n < 2 || paused) return;
    const t = setTimeout(() => setI((x) => (x + 1) % n), 6500);
    return () => clearTimeout(t);
  }, [i, n, paused]);

  if (!n) return null;
  const go = (d: number) => setI((x) => (x + d + n) % n);

  return (
    <section
      className="container-page pt-3 sm:pt-5"
      aria-roledescription="carousel"
      aria-label="Featured"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        className="relative h-[68vh] min-h-[440px] max-h-[720px] overflow-hidden rounded-[1.75rem] bg-surface sm:h-[62vh]"
        onTouchStart={(e) => (touch.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          if (touch.current === null) return;
          const dx = (e.changedTouches[0]?.clientX ?? 0) - touch.current;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          touch.current = null;
        }}
      >
        {slides.map((s, idx) => (
          <div key={s.id} className={cn("absolute inset-0 transition-opacity duration-1000", idx === i ? "opacity-100" : "pointer-events-none opacity-0")} aria-hidden={idx !== i} role="group" aria-roledescription="slide" aria-label={`${idx + 1} of ${n}`}>
            <ProductImage src={s.imageUrl} alt="" fill priority={idx === 0} sizes="100vw" className={cn("object-cover transition-transform duration-[7000ms] ease-out", idx === i ? "scale-105" : "scale-100")} />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent sm:hidden" />
            <div className="relative flex h-full max-w-2xl flex-col justify-end p-6 pb-16 sm:justify-center sm:p-12 lg:p-16">
              <p className={cn("eyebrow mb-4 text-white/70", idx === i && "animate-fade-up")}>The Otaku Bazaar</p>
              <h1 className={cn("text-4xl font-semibold leading-[1.05] text-white sm:text-5xl lg:text-6xl", idx === i && "animate-fade-up [animation-delay:80ms]")}>{s.title}</h1>
              {s.subtitle && <p className={cn("mt-4 max-w-md text-base text-white/75 sm:text-lg", idx === i && "animate-fade-up [animation-delay:160ms]")}>{s.subtitle}</p>}
              {s.ctaHref && (
                <div className={cn("mt-8 flex flex-wrap gap-3", idx === i && "animate-fade-up [animation-delay:240ms]")}>
                  <Link href={s.ctaHref} tabIndex={idx === i ? 0 : -1} className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-black transition hover:bg-white/90">
                    {s.ctaLabel ?? "Shop now"} <Icon name="arrow-right" size={16} />
                  </Link>
                  <Link href="/shop?new=1&sort=newest" tabIndex={idx === i ? 0 : -1} className="inline-flex h-12 items-center rounded-full border border-white/30 px-6 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10">
                    New arrivals
                  </Link>
                </div>
              )}
            </div>
          </div>
        ))}
        {n > 1 && (
          <div className="absolute bottom-5 left-6 right-6 flex items-center justify-between sm:left-12 lg:left-16">
            <div className="flex gap-2">
              {slides.map((s, idx) => (
                <button key={s.id} onClick={() => setI(idx)} className="group relative h-1 w-10 overflow-hidden rounded-full bg-white/25" aria-label={`Go to slide ${idx + 1}`} aria-current={idx === i}>
                  <span className={cn("absolute inset-y-0 left-0 rounded-full bg-white transition-[width] duration-500", idx === i ? "w-full" : "w-0")} />
                </button>
              ))}
            </div>
            <div className="hidden gap-2 sm:flex">
              <button onClick={() => go(-1)} className="grid h-10 w-10 place-items-center rounded-full border border-white/25 text-white backdrop-blur hover:bg-white/10" aria-label="Previous slide">
                <Icon name="chevron-left" size={18} />
              </button>
              <button onClick={() => go(1)} className="grid h-10 w-10 place-items-center rounded-full border border-white/25 text-white backdrop-blur hover:bg-white/10" aria-label="Next slide">
                <Icon name="chevron-right" size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
