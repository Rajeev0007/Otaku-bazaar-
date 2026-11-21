import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/server/auth/session";
import { hasPermission, type Permission } from "@/server/auth/permissions";
import { AdminNav } from "@/components/admin/admin-nav";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · The Otaku Bazaar" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const NAV: { href: string; label: string; icon: Parameters<typeof Icon>[0]["name"]; permission: Permission }[] = [
  { href: "/admin", label: "Dashboard", icon: "chart", permission: "dashboard.view" },
  { href: "/admin/orders", label: "Orders", icon: "bag", permission: "orders.read" },
  { href: "/admin/products", label: "Products", icon: "package", permission: "products.read" },
  { href: "/admin/inventory", label: "Inventory", icon: "box", permission: "inventory.read" },
  { href: "/admin/catalog", label: "Categories & anime", icon: "layers", permission: "catalog.write" },
  { href: "/admin/customers", label: "Customers", icon: "users", permission: "customers.read" },
  { href: "/admin/reviews", label: "Reviews & Q&A", icon: "star", permission: "reviews.moderate" },
  { href: "/admin/coupons", label: "Coupons", icon: "tag", permission: "marketing.write" },
  { href: "/admin/newsletter", label: "Newsletter", icon: "mail", permission: "marketing.write" },
  { href: "/admin/homepage", label: "Homepage", icon: "home", permission: "content.write" },
  { href: "/admin/pages", label: "Pages & policies", icon: "edit", permission: "content.write" },
  { href: "/admin/settings", label: "Store settings", icon: "settings", permission: "settings.write" },
  { href: "/admin/integrations", label: "Integrations", icon: "zap", permission: "settings.write" },
  { href: "/admin/staff", label: "Staff & roles", icon: "users", permission: "staff.manage" },
  { href: "/admin/audit", label: "Audit log", icon: "history", permission: "audit.read" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff(undefined, "/admin");
  const items = NAV.filter((n) => hasPermission(user.permissions, n.permission));
  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/admin" className="font-semibold">
            Otaku Bazaar <span className="text-xs font-normal text-muted">Admin</span>
          </Link>
          <Link href="/" className="text-xs text-muted hover:text-fg lg:hidden">
            View store →
          </Link>
        </div>
        <AdminNav items={items.map(({ href, label, icon }) => ({ href, label, icon }))} />
        <div className="hidden border-t border-line p-4 text-xs text-muted lg:mt-6 lg:block">
          <p className="truncate font-medium text-fg">{user.name ?? user.email}</p>
          <p className="truncate">{user.email}</p>
          <div className="mt-3 flex gap-3">
            <Link href="/" className="hover:text-fg">View store</Link>
            <Link href="/account" className="hover:text-fg">My account</Link>
          </div>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
