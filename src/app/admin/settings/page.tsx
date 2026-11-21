import { requireStaff } from "@/server/auth/session";
import { getStoreSettings } from "@/server/settings";
import { PageHeader } from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/settings-form";
import { Card } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/simple-form";
import { db } from "@/server/db";
import { loadDemoCatalogAction, removeDemoCatalogAction } from "@/app/admin/actions";

// Loading the demo catalog runs many queries; allow it time on Vercel.
export const maxDuration = 300;

export default async function SettingsPage() {
  await requireStaff("settings.write", "/admin/settings");
  const [s, demo] = await Promise.all([getStoreSettings(), db.product.count({ where: { tags: { has: "demo" }, status: { not: "ARCHIVED" } } })]);
  return (
    <>
      <PageHeader title="Store settings" description="Branding, announcement bar, shipping thresholds, tax display and maintenance mode." />
      <SettingsForm initial={s} />
      <Card title="Demo catalog" description="84 sample products with placeholder art, useful while you build the store. Remove them before launch." className="mt-6 max-w-5xl">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted">{demo ? `${demo} demo products are live.` : "No demo products in the store."}</span>
          {demo === 0 ? (
            <ConfirmButton action={loadDemoCatalogAction} label="Load demo products" confirmText="Add 84 demo products to the store? This can take up to a minute." className="rounded-full border border-line px-4 py-2 font-medium hover:bg-surface-2" />
          ) : (
            <ConfirmButton action={removeDemoCatalogAction} label="Remove demo products" confirmText="Remove all demo products and their demo reviews?" className="rounded-full bg-danger/15 px-4 py-2 font-medium text-danger" />
          )}
        </div>
      </Card>
    </>
  );
}
