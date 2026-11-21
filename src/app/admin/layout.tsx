import type { Metadata } from "next";
import { requireStaff } from "@/server/auth/session";
import { hasPermission, type Permission } from "@/server/auth/permissions";
import { AdminNav } from "@/components/admin/admin-nav";
import type { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · The Otaku Bazaar" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const NAV: { href: string; label: string; icon: Parameters<typeof Icon>[0]["name"]; permission: Permission }[] = [
  { href: "/admin", label: "Dashboard", icon: "chart", permission: "dashboard.view" },
  { href: "/admin/orders", label: "Orders", icon: "bag", permission: "orders.read" },
  { href: "/admin/returns", label: "Returns", icon: "refresh", permission: "orders.read" },
  { href: "/admin/support", label: "Support tickets", icon: "mail", permission: "support.read" },
  { href: "/admin/products", label: "Products", icon: "package", permission: "products.read" },
  { href: "/admin/inventory", label: "Inventory", icon: "box", permission: "inventory.read" },
  { href: "/admin/catalog", label: "Categories & anime", icon: "layers", permission: "catalog.write" },
  { href: "/admin/analytics", label: "Analytics", icon: "chart", permission: "dashboard.view" },
  { href: "/admin/customers", label: "Customers", icon: "users", permission: "customers.read" },
  { href: "/admin/reviews", label: "Reviews & Q&A", icon: "star", permission: "reviews.moderate" },
  { href: "/admin/coupons", label: "Coupons", icon: "tag", permission: "marketing.write" },
  { href: "/admin/gift-cards", label: "Gift cards", icon: "gift", permission: "marketing.write" },
  { href: "/admin/newsletter", label: "Newsletter", icon: "mail", permission: "marketing.write" },
  { href: "/admin/homepage", label: "Homepage", icon: "home", permission: "content.write" },
  { href: "/admin/pages", label: "Pages & policies", icon: "edit", permission: "content.write" },
  { href: "/admin/faq", label: "FAQs", icon: "info", permission: "content.write" },
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
      <AdminNav items={items.map(({ href, label, icon }) => ({ href, label, icon }))} user={{ name: user.name, email: user.email }} />
      <main className="min-w-0 px-3 py-5 sm:px-6 sm:py-8 lg:px-8">{children}</main>
    </div>
  );
}
