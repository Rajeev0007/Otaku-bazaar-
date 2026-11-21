"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "@/components/ui/icon";

type Item = { href: string; label: string; icon: IconName };

export function AdminNav({ items, user }: { items: Item[]; user: { name: string | null; email: string } }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  const current = items.find((i) => (i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href)));

  const list = (
    <nav className="flex flex-col gap-0.5 px-3" aria-label="Admin">
      {items.map((i) => {
        const active = current?.href === i.href;
        return (
          <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition", active ? "bg-surface-3 font-medium text-fg" : "text-muted hover:bg-surface-2 hover:text-fg")}>
            <Icon name={i.icon} size={18} />
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
  const footer = (
    <div className="border-t border-line p-4 text-xs text-muted">
      <p className="truncate font-medium text-fg">{user.name ?? user.email}</p>
      <p className="truncate">{user.email}</p>
      <div className="mt-3 flex gap-3">
        <Link href="/" className="hover:text-fg">View store</Link>
        <Link href="/account" className="hover:text-fg">My account</Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Phone / tablet top bar */}
      <header className="glass sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line px-3 lg:hidden">
        <button onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2" aria-label="Open admin menu" aria-expanded={open}>
          <Icon name="menu" size={22} />
        </button>
        <span className="min-w-0 flex-1 truncate font-semibold">{current?.label ?? "Admin"}</span>
        <Link href="/" className="rounded-full border border-line px-3 py-1.5 text-xs">Store ↗</Link>
      </header>
      <div className={cn("fixed inset-0 z-50 lg:hidden", open ? "visible" : "invisible")} aria-hidden={!open}>
        <div className={cn("absolute inset-0 bg-black/60 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={() => setOpen(false)} />
        <div className={cn("absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-surface transition-transform duration-300", open ? "translate-x-0" : "-translate-x-full")}>
          <div className="flex h-14 items-center justify-between px-4">
            <span className="font-semibold">Otaku Bazaar <span className="text-xs font-normal text-muted">Admin</span></span>
            <button onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2" aria-label="Close menu"><Icon name="x" size={20} /></button>
          </div>
          <div className="flex-1 overflow-y-auto pb-4">{list}</div>
          {footer}
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden border-r border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <Link href="/admin" className="flex h-16 shrink-0 items-center px-5 font-semibold">
          Otaku Bazaar <span className="ml-1.5 text-xs font-normal text-muted">Admin</span>
        </Link>
        <div className="flex-1 overflow-y-auto pb-4">{list}</div>
        {footer}
      </aside>
    </>
  );
}
