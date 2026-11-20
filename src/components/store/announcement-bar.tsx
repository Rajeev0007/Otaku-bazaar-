"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function AnnouncementBar({ items }: { items: { text: string; href?: string }[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % items.length), 5000);
    return () => clearInterval(t);
  }, [items.length]);
  if (!items.length) return null;
  return (
    <div className="relative z-50 h-9 overflow-hidden border-b border-line bg-surface text-center text-xs font-medium tracking-wide text-muted">
      {items.map((item, n) => {
        const content = <span className="px-4">{item.text}</span>;
        return (
          <div
            key={n}
            aria-hidden={n !== i}
            className="absolute inset-0 flex items-center justify-center transition-all duration-500"
            style={{ opacity: n === i ? 1 : 0, transform: `translateY(${n === i ? 0 : n < i ? -100 : 100}%)` }}
          >
            {item.href ? (
              <Link href={item.href} tabIndex={n === i ? 0 : -1} className="transition hover:text-fg">
                {content}
              </Link>
            ) : (
              content
            )}
          </div>
        );
      })}
    </div>
  );
}
