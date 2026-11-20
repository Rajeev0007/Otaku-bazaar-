"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { Icon } from "@/components/ui/icon";
import { useShopper } from "@/components/store/shopper-context";
import { SearchBox } from "@/components/store/search-box";
import { ThemeToggle } from "@/components/store/theme-toggle";
import { CartDrawer } from "@/components/store/cart-drawer";
import { ProductImage } from "@/components/store/product-image";

type Cat = { slug: string; name: string; imageUrl: string | null; children: { slug: string; name: string }[] };
type Franchise = { slug: string; name: string; isTrending: boolean; imageUrl: string | null };
type Featured = { slug: string; name: string; image: string | null; price: number; currency: string };

export function HeaderClient({ storeName, logoUrl, categories, franchises, featured }: { storeName: string; logoUrl: string; categories: Cat[]; franchises: Franchise[]; featured: Featured[] }) {
  const [menu, setMenu] = useState<null | "shop" | "anime">(null);
  const [drawer, setDrawer] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pathname = usePathname();
  const { cartCount, user, wishlistIds, setCartOpen } = useShopper();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenu(null);
    setDrawer(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (setMenu(null), setDrawer(false));
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openMenu = (m: "shop" | "anime") => {
    clearTimeout(closeTimer.current);
    setMenu(m);
  };
  const scheduleClose = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMenu(null), 140);
  };

  const navLink = "relative flex h-full items-center px-3 text-sm font-medium text-muted transition hover:text-fg";

  return (
    <>
      <header className={cn("sticky top-0 z-40 border-b transition-colors duration-300", scrolled || menu ? "glass border-line" : "border-transparent bg-bg")}>
        <div className="container-page flex h-16 items-center gap-3 lg:h-[4.5rem]">
          <button className="-ml-2 grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2 lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu" aria-expanded={drawer}>
            <Icon name="menu" size={22} />
          </button>

          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={`${storeName} home`}>
            <Image src={logoUrl} alt="" width={36} height={36} className="h-9 w-9 rounded-full object-cover" priority />
            <span className="hidden text-[0.95rem] font-semibold tracking-tight sm:block">{storeName}</span>
          </Link>

          <nav className="ml-6 hidden h-full items-stretch lg:flex" aria-label="Main">
            <button className={cn(navLink, menu === "shop" && "text-fg")} onMouseEnter={() => openMenu("shop")} onMouseLeave={scheduleClose} onClick={() => setMenu(menu === "shop" ? null : "shop")} aria-expanded={menu === "shop"} aria-haspopup="true">
              Shop <Icon name="chevron-down" size={14} className="ml-1" />
            </button>
            <button className={cn(navLink, menu === "anime" && "text-fg")} onMouseEnter={() => openMenu("anime")} onMouseLeave={scheduleClose} onClick={() => setMenu(menu === "anime" ? null : "anime")} aria-expanded={menu === "anime"} aria-haspopup="true">
              Anime <Icon name="chevron-down" size={14} className="ml-1" />
            </button>
            <Link href="/c/clothing" className={navLink}>Clothing</Link>
            <Link href="/c/figures-collectibles" className={navLink}>Collectibles</Link>
            <Link href="/shop?new=1&sort=newest" className={navLink}>New</Link>
            <Link href="/c/gifts" className={navLink}>Gifts</Link>
            <Link href="/shop?sale=1&sort=discount" className={cn(navLink, "text-accent hover:text-accent")}>Sale</Link>
          </nav>

          <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
            <SearchBox />
            <ThemeToggle className="hidden sm:grid" />
            <Link href={user ? "/account" : "/login"} className="hidden h-10 w-10 place-items-center rounded-full hover:bg-surface-2 md:grid" aria-label={user ? "My account" : "Sign in"}>
              <Icon name="user" size={21} />
            </Link>
            <Link href="/wishlist" className="relative hidden h-10 w-10 place-items-center rounded-full hover:bg-surface-2 md:grid" aria-label={`Wishlist${wishlistIds.length ? `, ${wishlistIds.length} items` : ""}`}>
              <Icon name="heart" size={21} />
              {wishlistIds.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" />}
            </Link>
            <button onClick={() => setCartOpen(true)} className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2" aria-label={`Cart, ${cartCount} items`}>
              <Icon name="bag" size={21} />
              {cartCount > 0 && (
                <span key={cartCount} className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 animate-fade-up place-items-center rounded-full bg-accent px-1 text-[0.65rem] font-bold text-accent-fg">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mega menus */}
        <div
          onMouseEnter={() => clearTimeout(closeTimer.current)}
          onMouseLeave={scheduleClose}
          className={cn("absolute inset-x-0 top-full hidden border-b border-line bg-bg/95 shadow-soft backdrop-blur-xl transition-all duration-300 lg:block", menu ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0")}
        >
          {menu === "shop" && (
            <div className="container-page grid grid-cols-12 gap-8 py-8">
              <div className="col-span-8 grid grid-cols-4 gap-x-6 gap-y-7">
                {categories.map((c) => (
                  <div key={c.slug}>
                    <Link href={`/c/${c.slug}`} className="text-sm font-semibold hover:text-accent">{c.name}</Link>
                    {c.children.length > 0 && (
                      <ul className="mt-2.5 space-y-2">
                        {c.children.map((ch) => (
                          <li key={ch.slug}>
                            <Link href={`/c/${ch.slug}`} className="text-sm text-muted transition hover:text-fg">{ch.name}</Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
                <div>
                  <p className="text-sm font-semibold">Discover</p>
                  <ul className="mt-2.5 space-y-2 text-sm text-muted">
                    <li><Link href="/shop" className="hover:text-fg">All products</Link></li>
                    <li><Link href="/shop?sort=trending" className="hover:text-fg">Trending</Link></li>
                    <li><Link href="/shop?sort=bestselling" className="hover:text-fg">Best sellers</Link></li>
                    <li><Link href="/shop?limited=1" className="hover:text-fg">Limited editions</Link></li>
                    <li><Link href="/shop?sale=1&sort=discount" className="text-accent hover:underline">Deals</Link></li>
                  </ul>
                </div>
              </div>
              <div className="col-span-4">
                <p className="eyebrow mb-3">Trending now</p>
                <div className="space-y-2">
                  {featured.map((f) => (
                    <Link key={f.slug} href={`/p/${f.slug}`} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-surface-2">
                      <div className="relative h-16 w-13 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                        {f.image && <ProductImage src={f.image} alt="" fill sizes="52px" className="object-cover" />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{f.name}</p>
                        <p className="text-xs text-muted">{formatMoney(f.price, f.currency)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
          {menu === "anime" && (
            <div className="container-page py-8">
              <div className="mb-4 flex items-center justify-between">
                <p className="eyebrow">Shop by anime</p>
                <Link href="/anime" className="text-sm text-muted hover:text-fg">All series →</Link>
              </div>
              <div className="grid grid-cols-6 gap-3">
                {franchises.map((f) => (
                  <Link key={f.slug} href={`/anime/${f.slug}`} className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-surface-2">
                    {f.imageUrl && <ProductImage src={f.imageUrl} alt="" fill sizes="200px" className="object-cover opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-100" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                    <div className="absolute inset-x-3 bottom-3">
                      {f.isTrending && <span className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-widest text-accent">Trending</span>}
                      <span className="text-sm font-semibold text-white">{f.name}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Mobile drawer */}
      <div className={cn("fixed inset-0 z-[60] lg:hidden", drawer ? "visible" : "invisible")} aria-hidden={!drawer}>
        <div className={cn("absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity", drawer ? "opacity-100" : "opacity-0")} onClick={() => setDrawer(false)} />
        <nav className={cn("absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-bg shadow-soft transition-transform duration-300 ease-[var(--ease-out-expo)]", drawer ? "translate-x-0" : "-translate-x-full")} aria-label="Mobile">
          <div className="flex h-16 items-center justify-between border-b border-line px-4">
            <span className="font-semibold">{storeName}</span>
            <button onClick={() => setDrawer(false)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2" aria-label="Close menu">
              <Icon name="x" size={22} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-3">
            <MobileGroup title="Shop by category">
              {categories.map((c) => (
                <details key={c.slug} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-3 py-3 text-[0.95rem] hover:bg-surface-2">
                    <Link href={`/c/${c.slug}`}>{c.name}</Link>
                    {c.children.length > 0 && <Icon name="chevron-down" size={16} className="text-muted transition group-open:rotate-180" />}
                  </summary>
                  {c.children.length > 0 && (
                    <div className="mb-2 ml-3 border-l border-line pl-3">
                      {c.children.map((ch) => (
                        <Link key={ch.slug} href={`/c/${ch.slug}`} className="block rounded-lg px-3 py-2 text-sm text-muted hover:text-fg">{ch.name}</Link>
                      ))}
                    </div>
                  )}
                </details>
              ))}
            </MobileGroup>
            <MobileGroup title="Shop by anime">
              <div className="flex flex-wrap gap-2 px-3 py-2">
                {franchises.map((f) => (
                  <Link key={f.slug} href={`/anime/${f.slug}`} className="rounded-full border border-line px-3 py-1.5 text-sm text-muted hover:border-fg hover:text-fg">{f.name}</Link>
                ))}
              </div>
            </MobileGroup>
            <MobileGroup title="Discover">
              {[["/shop?new=1&sort=newest", "New arrivals"], ["/shop?sort=trending", "Trending"], ["/shop?sort=bestselling", "Best sellers"], ["/shop?limited=1", "Limited editions"], ["/shop?sale=1&sort=discount", "Sale"]].map(([href, label]) => (
                <Link key={href} href={href!} className="block rounded-xl px-3 py-3 text-[0.95rem] hover:bg-surface-2">{label}</Link>
              ))}
            </MobileGroup>
          </div>
          <div className="flex items-center justify-between border-t border-line p-4">
            <Link href={user ? "/account" : "/login"} className="flex items-center gap-2 text-sm font-medium">
              <Icon name="user" size={18} /> {user ? (user.name ?? "My account") : "Sign in / Register"}
            </Link>
            <ThemeToggle />
          </div>
        </nav>
      </div>

      <CartDrawer />
    </>
  );
}

function MobileGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="eyebrow px-3 pb-1 pt-3">{title}</p>
      {children}
    </div>
  );
}
