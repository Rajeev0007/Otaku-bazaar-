"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";

/** Small floating help button with quick links. Hidden on pages that have their own sticky action bar. */
export function HelpWidget({ whatsapp }: { whatsapp: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (pathname.startsWith("/p/") || pathname.startsWith("/checkout") || pathname.startsWith("/support")) return null;

  const wa = whatsapp.replace(/[^0-9]/g, "");
  const links: { href: string; label: string; external?: boolean }[] = [
    { href: "/track", label: "Track my order" },
    { href: "/account/orders", label: "Return or exchange an item" },
    { href: "/pages/shipping-policy", label: "Shipping times" },
    ...(wa ? [{ href: `https://wa.me/${wa}`, label: "Chat on WhatsApp", external: true }] : []),
    { href: "/support", label: "Send us a message" },
  ];

  return (
    <div ref={ref} className="fixed bottom-20 right-4 z-40 md:bottom-6 md:right-6">
      {open && (
        <div id="help-menu" className="mb-3 w-64 rounded-[var(--radius-card)] border border-line bg-surface p-2 shadow-xl">
          <p className="px-3 pb-1 pt-2 text-sm font-semibold">How can we help?</p>
          <ul>
            {links.map((l) => (
              <li key={l.href}>
                {l.external ? (
                  <a href={l.href} target="_blank" rel="noopener noreferrer" className="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-fg">
                    {l.label}
                  </a>
                ) : (
                  <Link href={l.href} className="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-fg">
                    {l.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="help-menu"
          aria-label={open ? "Close help" : "Help"}
          className="grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-fg shadow-lg transition hover:scale-105"
        >
          <Icon name={open ? "x" : "info"} size={22} />
        </button>
      </div>
    </div>
  );
}
