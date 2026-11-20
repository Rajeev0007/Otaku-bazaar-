import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/utils";

export default function robots(): MetadataRoute.Robots {
  // Set NOINDEX=true on staging/preview deployments to keep them out of search engines.
  // Vercel preview deployments and anything with NOINDEX=true stay out of search engines.
  if (process.env.NOINDEX === "true" || process.env.VERCEL_ENV === "preview") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/account", "/cart", "/checkout", "/search", "/wishlist"] }],
    sitemap: appUrl("/sitemap.xml"),
  };
}
