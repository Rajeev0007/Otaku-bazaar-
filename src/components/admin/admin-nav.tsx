"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "@/components/ui/icon";

export function AdminNav({ items }: { items: { href: string; label: string; icon: IconName }[] }) {
  const pathname = usePathname();
  return (
    <nav className="scrollbar-none flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0" aria-label="Admin">
      {items.map((i) => {
        const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined} className={cn("flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition", active ? "bg-surface-3 font-medium text-fg" : "text-muted hover:bg-surface-2 hover:text-fg")}>
            <Icon name={i.icon} size={18} />
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
