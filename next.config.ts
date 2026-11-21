import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const mediaHost = process.env.MEDIA_PUBLIC_HOST; // e.g. cdn.theotakubazaar.com

// Razorpay checkout, plus Google Analytics and Meta Pixel (only loaded after cookie consent).
const csp = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; 'unsafe-eval' only in dev for React Refresh.
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"} https://checkout.razorpay.com https://www.googletagmanager.com https://connect.facebook.net`,
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${mediaHost ? ` https://${mediaHost}` : ""} https://*.public.blob.vercel-storage.com https://lh3.googleusercontent.com https://*.razorpay.com https://www.google-analytics.com https://www.googletagmanager.com https://www.facebook.com`,
  `media-src 'self'${mediaHost ? ` https://${mediaHost}` : ""} https://*.public.blob.vercel-storage.com`,
  "font-src 'self' data:",
  "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.facebook.com https://connect.facebook.net",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com https://api.razorpay.com",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      ...(mediaHost ? [{ protocol: "https" as const, hostname: mediaHost }] : []),
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
