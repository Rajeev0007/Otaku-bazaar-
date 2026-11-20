"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/** Horizontal, touch-scrollable rail with desktop arrow controls. */
export function RailScroller({ children, label, className }: { children: ReactNode; label: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: "smooth" });

  return (
    <div className={cn("group/rail relative", className)}>
      <div ref={ref} role="region" aria-label={label} tabIndex={0} className="scrollbar-none snap-rail -mx-4 flex scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:gap-5 sm:px-6 xl:-mx-10 xl:scroll-px-10 xl:px-10">
        {children}
      </div>
      {(["left", "right"] as const).map((side) => {
        const hidden = side === "left" ? edges.start : edges.end;
        return (
          <button
            key={side}
            type="button"
            onClick={() => scroll(side === "left" ? -1 : 1)}
            aria-label={side === "left" ? "Scroll left" : "Scroll right"}
            className={cn(
              "glass absolute top-[38%] z-20 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-line shadow-soft transition hover:scale-105 md:grid",
              side === "left" ? "-left-3" : "-right-3",
              hidden ? "pointer-events-none opacity-0" : "opacity-0 group-hover/rail:opacity-100",
            )}
          >
            <Icon name={side === "left" ? "chevron-left" : "chevron-right"} size={20} />
          </button>
        );
      })}
    </div>
  );
}
