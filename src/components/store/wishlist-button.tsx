"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { useShopper } from "@/components/store/shopper-context";
import { toggleWishlistAction } from "@/app/actions/wishlist";
import { track } from "@/lib/track";

export function WishlistButton({ productId, productName, variant = "floating", className }: { productId: string; productName: string; variant?: "floating" | "inline" | "large"; className?: string }) {
  const { isWishlisted, setWishlisted } = useShopper();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const saved = isWishlisted(productId);

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    start(async () => {
      setWishlisted(productId, !saved); // optimistic
      const res = await toggleWishlistAction(productId);
      if (!res.ok) {
        setWishlisted(productId, saved);
        if (res.needsLogin) {
          toast({ tone: "info", title: "Sign in to save favourites", description: "Your wishlist syncs across all your devices.", action: { label: "Sign in", href: `/login?next=${encodeURIComponent(pathname)}` } });
        } else toast({ tone: "error", title: res.error });
        return;
      }
      setWishlisted(productId, res.saved);
      if (res.saved) track("wishlist_add", { productId });
      toast({ title: res.saved ? "Saved to wishlist" : "Removed from wishlist", description: productName, action: res.saved ? { label: "View", href: "/wishlist" } : undefined });
      router.refresh();
    });
  }

  const label = saved ? `Remove ${productName} from wishlist` : `Save ${productName} to wishlist`;
  if (variant === "large") {
    return (
      <button type="button" onClick={onClick} disabled={pending} aria-pressed={saved} aria-label={label} className={cn("grid h-13 w-13 shrink-0 place-items-center rounded-full border border-line-strong transition hover:bg-surface-2", saved && "border-accent text-accent", className)}>
        <Icon name="heart" size={22} filled={saved} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={saved}
      aria-label={label}
      className={cn(
        "grid place-items-center rounded-full transition active:scale-90",
        variant === "floating" ? "glass h-9 w-9 border border-line text-fg hover:text-accent" : "h-10 w-10 border border-line hover:bg-surface-2",
        saved && "text-accent",
        className,
      )}
    >
      <Icon name="heart" size={18} filled={saved} />
    </button>
  );
}
