import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { THEME_SCRIPT } from "@/components/store/theme-toggle";
import { appUrl } from "@/lib/utils";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: { default: "The Otaku Bazaar — Premium Anime Merchandise", template: "%s · The Otaku Bazaar" },
  description: "Premium anime apparel, collectibles, posters and accessories for fans and collectors. Fast shipping across India.",
  applicationName: "The Otaku Bazaar",
  icons: { icon: [{ url: "/favicon-32.png", sizes: "32x32" }, { url: "/favicon-16.png", sizes: "16x16" }], apple: "/apple-touch-icon.png" },
  openGraph: { type: "website", siteName: "The Otaku Bazaar", locale: "en_IN", images: ["/img/banner.jpg"] },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#09090c" },
    { media: "(prefers-color-scheme: light)", color: "#f7f6f3" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before first paint to avoid a flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-full focus:bg-fg focus:px-4 focus:py-2 focus:text-bg">
          Skip to content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
