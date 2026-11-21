import { getNavigation, productRail } from "@/server/catalog/queries";
import { getStoreSettings } from "@/server/settings";
import { HeaderClient } from "@/components/store/header-client";
import { AnnouncementBar } from "@/components/store/announcement-bar";

export async function Header() {
  const [nav, settings, trending] = await Promise.all([getNavigation(), getStoreSettings(), productRail("trending", 3)]);
  return (
    <>
      <AnnouncementBar items={settings.announcements} />
      <HeaderClient
        storeName={settings.name}
        logoUrl={settings.logoUrl}
        themePicker={settings.appearance.shopperChoice}
        wallpapers={settings.appearance.wallpapers}
        categories={nav.categories}
        franchises={nav.franchises}
        featured={trending.map((p) => ({ slug: p.slug, name: p.name, image: p.images[0]?.url ?? null, price: p.minPrice, currency: p.currency }))}
      />
    </>
  );
}
