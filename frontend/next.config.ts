import type { NextConfig } from "next";
import withPWAInit, { runtimeCaching as defaultCache } from "@ducanh2912/next-pwa";

const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").origin;
  } catch {
    return "http://localhost:4000";
  }
})();

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  reloadOnOnline: false, // we handle reconnect (queue flush) ourselves; avoid surprise full-page reloads
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  fallbacks: {
    document: "/~offline",
  },
  workboxOptions: {
    skipWaiting: false, // let the user confirm via the update-available prompt instead of hijacking an open tab
    cleanupOutdatedCaches: true, // versioned cache: old precaches are removed automatically on activate
    runtimeCaching: [
      // Dashboard summary/trend endpoints: serve last-known data instantly, refresh in the background.
      {
        urlPattern: new RegExp(`^${apiOrigin}/api/dashboard/.*`),
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "api-dashboard",
          expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 }, // 1 day
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      // Reference/lookup data (categories, wallets, money sources) — changes rarely, safe to serve from cache first.
      {
        urlPattern: new RegExp(`^${apiOrigin}/api/(categories|accounts|payment-methods)(\\?.*)?$`),
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "api-lookup",
          expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 1 week
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      // Everything else under /api — network only. This app is financial data; write endpoints and
      // anything not explicitly listed above must never be served stale or cached.
      {
        urlPattern: new RegExp(`^${apiOrigin}/api/.*`),
        handler: "NetworkOnly",
      },
      ...defaultCache,
    ],
  },
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Master Plan §51 — baseline security headers with essentially zero
  // compatibility risk (unlike a CSP, none of these can break rendering).
  // A full Content-Security-Policy is intentionally NOT added here: this app
  // relies on inline styles from Tailwind/Framer Motion, and a CSP strict
  // enough to matter would need to be verified live against every page
  // before shipping, which is out of scope for this pass.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
