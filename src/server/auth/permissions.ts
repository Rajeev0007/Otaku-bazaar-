// Role-based access control. Permissions are seeded into the database; roles can be edited by a Super Admin.
// Code always checks permission keys, never role names, so custom roles work without code changes.

export const PERMISSIONS = {
  "dashboard.view": "View the admin dashboard and reports",
  "products.read": "View products",
  "products.write": "Create and edit products, variants and images",
  "products.delete": "Delete or archive products",
  "catalog.write": "Manage categories, anime franchises, brands and collections",
  "inventory.read": "View stock levels and history",
  "inventory.write": "Adjust stock, receive purchase orders, manage suppliers",
  "orders.read": "View orders",
  "orders.write": "Update order status, shipments and invoices",
  "orders.refund": "Issue refunds and approve returns",
  "customers.read": "View customer profiles",
  "customers.write": "Edit, tag, suspend or ban customers",
  "support.read": "View support tickets",
  "support.write": "Reply to and manage support tickets",
  "reviews.moderate": "Moderate reviews and product questions",
  "marketing.write": "Manage coupons, promotions, banners and campaigns",
  "content.write": "Edit homepage, pages, blog, FAQ and navigation",
  "settings.write": "Change store, payment, shipping and tax settings",
  "staff.manage": "Manage staff accounts and roles",
  "audit.read": "View audit logs",
} as const;

export type Permission = keyof typeof PERMISSIONS;

const ALL = Object.keys(PERMISSIONS) as Permission[];

export const DEFAULT_ROLES: Record<string, { name: string; description: string; permissions: Permission[] }> = {
  super_admin: { name: "Super Admin", description: "Full access to everything", permissions: ALL },
  store_manager: {
    name: "Store Manager",
    description: "Runs day-to-day operations",
    permissions: ALL.filter((p) => !["staff.manage", "settings.write"].includes(p)),
  },
  product_manager: {
    name: "Product Manager",
    description: "Catalog and inventory",
    permissions: ["dashboard.view", "products.read", "products.write", "products.delete", "catalog.write", "inventory.read", "inventory.write", "reviews.moderate"],
  },
  order_manager: {
    name: "Order Manager",
    description: "Fulfilment, shipping, returns and refunds",
    permissions: ["dashboard.view", "products.read", "inventory.read", "orders.read", "orders.write", "orders.refund", "customers.read"],
  },
  support_agent: {
    name: "Support Agent",
    description: "Customer support",
    permissions: ["orders.read", "customers.read", "support.read", "support.write", "reviews.moderate", "products.read"],
  },
  marketing_manager: {
    name: "Marketing Manager",
    description: "Promotions, content and campaigns",
    permissions: ["dashboard.view", "products.read", "marketing.write", "content.write", "customers.read"],
  },
};

export function hasPermission(granted: ReadonlySet<string> | readonly string[], needed: Permission): boolean {
  const set = granted instanceof Set ? granted : new Set(granted as readonly string[]);
  return set.has(needed);
}
