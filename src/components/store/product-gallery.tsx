"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { ProductImage } from "@/components/store/product-image";

type Img = { url: string; alt: string };

export function ProductGallery({ images, videoUrl, name, badge }: { images: Img[]; videoUrl?: string | null; name: string; badge?: React.ReactNode }) {
  const media = [...images.map((i) => ({ type: "image" as const, ...i })), ...(videoUrl ? [{ type: "video" as const, url: videoUrl, alt: `${name} video` }] : [])];
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [full, setFull] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  // Mobile swipe rail -> active index
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const onScroll = () => setActive(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!full) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(false);
      if (e.key === "ArrowRight") setActive((a) => (a + 1) % media.length);
      if (e.key === "ArrowLeft") setActive((a) => (a - 1 + media.length) % media.length);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [full, media.length]);

  if (!media.length) return <div className="aspect-[4/5] rounded-[var(--radius-card)] bg-surface-2" />;
  const current = media[active] ?? media[0]!;

  return (
    <div className="lg:flex lg:gap-4">
      {/* Desktop thumbnails */}
      <div className="hidden w-20 shrink-0 flex-col gap-3 lg:flex">
        {media.map((m, i) => (
          <button key={m.url} onClick={() => setActive(i)} className={cn("relative aspect-[4/5] overflow-hidden rounded-xl border-2 bg-surface-2 transition", i === active ? "border-fg" : "border-transparent opacity-70 hover:opacity-100")} aria-label={`Show ${m.type === "video" ? "video" : `image ${i + 1}`}`} aria-current={i === active}>
            {m.type === "image" ? <ProductImage src={m.url} alt="" fill sizes="80px" className="object-cover" /> : <span className="grid h-full place-items-center"><Icon name="play" size={20} filled /></span>}
          </button>
        ))}
      </div>

      {/* Desktop main image with hover zoom */}
      <div className="relative hidden flex-1 lg:block">
        <div
          className={cn("relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-surface-2", current.type === "image" && "cursor-zoom-in")}
          onMouseMove={(e) => {
            if (current.type !== "image") return;
            const r = e.currentTarget.getBoundingClientRect();
            setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
          }}
          onMouseLeave={() => setZoom(null)}
          onClick={() => current.type === "image" && setFull(true)}
        >
          {current.type === "image" ? (
            <ProductImage src={current.url} alt={current.alt} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover transition-transform duration-200" style={zoom ? { transform: "scale(2)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined} />
          ) : (
            <video src={current.url} controls playsInline className="h-full w-full object-cover" />
          )}
          {badge && <div className="absolute left-4 top-4">{badge}</div>}
          <button onClick={(e) => (e.stopPropagation(), setFull(true))} className="glass absolute bottom-4 right-4 grid h-10 w-10 place-items-center rounded-full border border-line" aria-label="Open fullscreen gallery">
            <Icon name="expand" size={18} />
          </button>
        </div>
      </div>

      {/* Mobile swipe gallery */}
      <div className="relative -mx-4 sm:-mx-6 lg:hidden">
        <div ref={railRef} className="scrollbar-none snap-rail flex overflow-x-auto">
          {media.map((m, i) => (
            <div key={m.url} className="relative aspect-[4/5] w-full shrink-0 bg-surface-2" onClick={() => m.type === "image" && (setActive(i), setFull(true))}>
              {m.type === "image" ? <ProductImage src={m.url} alt={m.alt} fill priority={i === 0} sizes="100vw" className="object-cover" /> : <video src={m.url} controls playsInline className="h-full w-full object-cover" />}
            </div>
          ))}
        </div>
        {badge && <div className="absolute left-4 top-4">{badge}</div>}
        {media.length > 1 && (
          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5">
            {media.map((m, i) => (
              <span key={m.url} className={cn("h-1.5 rounded-full bg-white/90 transition-all", i === active ? "w-6" : "w-1.5 opacity-50")} />
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen */}
      {full && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label={`${name} gallery`}>
          <div className="flex items-center justify-between p-4 text-white">
            <span className="text-sm text-white/70">
              {active + 1} / {media.length}
            </span>
            <button onClick={() => setFull(false)} className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10" aria-label="Close gallery">
              <Icon name="x" size={24} />
            </button>
          </div>
          <div className="relative flex-1">
            {current.type === "image" ? <ProductImage src={current.url} alt={current.alt} fill sizes="100vw" className="object-contain" /> : <video src={current.url} controls autoPlay playsInline className="h-full w-full object-contain" />}
            {media.length > 1 && (
              <>
                <button onClick={() => setActive((a) => (a - 1 + media.length) % media.length)} className="absolute left-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Previous image">
                  <Icon name="chevron-left" size={24} />
                </button>
                <button onClick={() => setActive((a) => (a + 1) % media.length)} className="absolute right-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Next image">
                  <Icon name="chevron-right" size={24} />
                </button>
              </>
            )}
          </div>
          <div className="flex justify-center gap-2 p-4">
            {media.map((m, i) => (
              <button key={m.url} onClick={() => setActive(i)} className={cn("relative h-16 w-13 overflow-hidden rounded-lg border-2", i === active ? "border-white" : "border-transparent opacity-50")} aria-label={`Show item ${i + 1}`}>
                {m.type === "image" ? <ProductImage src={m.url} alt="" fill sizes="52px" className="object-cover" /> : <span className="grid h-full place-items-center text-white"><Icon name="play" size={16} filled /></span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
