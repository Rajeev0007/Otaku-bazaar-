import { Header } from "@/components/store/header";
import { Footer } from "@/components/store/footer";
import { MobileTabBar } from "@/components/store/mobile-tab-bar";
import { HelpWidget } from "@/components/store/help-widget";
import { ConsentAndAnalytics } from "@/components/store/analytics";
import { ThemeRuntime } from "@/components/store/theme-runtime";
import { themeBootScript } from "@/lib/themes";
import { ShopperProvider } from "@/components/store/shopper-context";
import { getShopperSummary } from "@/server/shopper";
import { getStoreSettings } from "@/server/settings";
import { getCurrentUser } from "@/server/auth/session";
import { redirect } from "next/navigation";
import { getSetupState } from "@/server/setup";

// Every storefront page depends on the visitor (cart, session) and on setup state, so never prerender.
export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  // Fresh deployment: send everyone to /setup until the tables and the owner account exist.
  const setup = await getSetupState();
  if (setup.database !== "ok" || !setup.roles || !setup.owner) redirect("/setup");

  const [shopper, settings, user] = await Promise.all([getShopperSummary(), getStoreSettings(), getCurrentUser()]);

  // Maintenance mode: staff can still browse to check the store.
  if (settings.maintenanceMode && !user?.isStaff) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="eyebrow mb-3">{settings.name}</p>
          <h1 className="text-3xl font-semibold">We'll be right back</h1>
          <p className="mt-3 text-muted">{settings.maintenanceMessage}</p>
        </div>
      </main>
    );
  }

  return (
    <ShopperProvider initial={shopper}>
      {/* Applies the store/shopper theme before the page paints. */}
      <script dangerouslySetInnerHTML={{ __html: themeBootScript(settings.appearance.theme, settings.appearance.shopperChoice) }} />
      <ThemeRuntime defaultTheme={settings.appearance.theme} allowChoice={settings.appearance.shopperChoice} wallpapers={settings.appearance.wallpapers} />
      <Header />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <Footer />
      <MobileTabBar />
      <HelpWidget whatsapp={settings.support.whatsapp || settings.social.whatsapp || ""} />
      <ConsentAndAnalytics ga4Id={settings.analytics.ga4Id} metaPixelId={settings.analytics.metaPixelId} />
    </ShopperProvider>
  );
}
