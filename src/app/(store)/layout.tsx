import { Header } from "@/components/store/header";
import { Footer } from "@/components/store/footer";
import { MobileTabBar } from "@/components/store/mobile-tab-bar";
import { ShopperProvider } from "@/components/store/shopper-context";
import { getShopperSummary } from "@/server/shopper";
import { getStoreSettings } from "@/server/settings";
import { getCurrentUser } from "@/server/auth/session";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
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
      <Header />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <Footer />
      <MobileTabBar />
    </ShopperProvider>
  );
}
