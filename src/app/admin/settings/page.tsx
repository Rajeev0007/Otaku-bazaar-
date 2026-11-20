import { requireStaff } from "@/server/auth/session";
import { getStoreSettings } from "@/server/settings";
import { PageHeader } from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/settings-form";

export default async function SettingsPage() {
  await requireStaff("settings.write", "/admin/settings");
  const s = await getStoreSettings();
  return (
    <>
      <PageHeader title="Store settings" description="Branding, announcement bar, shipping thresholds, tax display and maintenance mode." />
      <SettingsForm initial={s} />
    </>
  );
}
