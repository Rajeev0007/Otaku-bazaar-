"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "@/components/ui/icon";
import { useShopper } from "@/components/store/shopper-context";

/** App-style bottom navigation on phones. Hidden on product pages, which show a sticky buy bar instead. */
export function MobileTabBar() {
  const pathname = usePathname();
  const { cartCount, setCartOpen, user } = useShopper();
  if (pathname.startsWith("/p/")) return null;
  const items: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
    { href: "/", label: "Home", icon: "home", match: (p) => p === "/" },
    { href: "/shop", label: "Shop", icon: "grid", match: (p) => p.startsWith("/shop") || p.startsWith("/c/") || p.startsWith("/anime") || p.startsWith("/search") },
    { href: "/wishlist", label: "Wishlist", icon: "heart", match: (p) => p.startsWith("/wishlist") },
    { href: user ? "/account" : "/login", label: user ? "Account" : "Sign in", icon: "user", match: (p) => p.startsWith("/account") || p.startsWith("/login") },
  ];
  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-40 border-t border-line pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Mobile tabs">
      <div className="grid grid-cols-5">
        {items.slice(0, 2).map((i) => (
          <Tab key={i.href} {...i} active={i.match(pathname)} />
        ))}
        <button onClick={() => setCartOpen(true)} className="relative flex flex-col items-center gap-1 py-2.5 text-[0.65rem] font-medium text-muted" aria-label={`Cart, ${cartCount} items`}>
          <span className="relative">
            <Icon name="bag" size={22} />
            {cartCount > 0 && <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[0.6rem] font-bold text-accent-fg">{cartCount}</span>}
          </span>
          Cart
        </button>
        {items.slice(2).map((i) => (
          <Tab key={i.href} {...i} active={i.match(pathname)} />
        ))}
      </div>
    </nav>
  );
}

function Tab({ href, label, icon, active }: { href: string; label: string; icon: IconName; active: boolean }) {
  return (
    <Link href={href} className={cn("flex flex-col items-center gap-1 py-2.5 text-[0.65rem] font-medium transition", active ? "text-fg" : "text-muted")} aria-current={active ? "page" : undefined}>
      <Icon name={icon} size={22} filled={active && icon === "heart"} strokeWidth={active ? 2 : 1.7} />
      {label}
    </Link>
  );
}
