"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Shopper = {
  user: { name: string | null; email: string; isStaff: boolean } | null;
  cartCount: number;
  wishlistIds: string[];
};

type ShopperContextValue = Shopper & {
  setCartCount: (n: number) => void;
  setWishlisted: (productId: string, saved: boolean) => void;
  isWishlisted: (productId: string) => boolean;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
};

const Ctx = createContext<ShopperContextValue | null>(null);

export function ShopperProvider({ initial, children }: { initial: Shopper; children: ReactNode }) {
  const [cartCount, setCartCount] = useState(initial.cartCount);
  const [wishlist, setWishlist] = useState(() => new Set(initial.wishlistIds));
  const [cartOpen, setCartOpen] = useState(false);
  const setWishlisted = useCallback((id: string, saved: boolean) => {
    setWishlist((prev) => {
      const next = new Set(prev);
      if (saved) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const value = useMemo<ShopperContextValue>(
    () => ({
      user: initial.user,
      cartCount,
      wishlistIds: [...wishlist],
      setCartCount,
      setWishlisted,
      isWishlisted: (id) => wishlist.has(id),
      cartOpen,
      setCartOpen,
    }),
    [initial.user, cartCount, wishlist, setWishlisted, cartOpen],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShopper() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useShopper must be used inside ShopperProvider");
  return ctx;
}
