import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "@/styles/mobile.css";
import { Providers } from "./providers";
import { Preloader } from "@/components/Preloader";
import { AntiTamperGuard } from "@/components/AntiTamperGuard";
import { ServiceWorkerUpdatePrompt } from "@/components/pwa/ServiceWorkerUpdatePrompt";
import { PwaInstallCapture } from "@/components/pwa/PwaInstallCapture";
import { isMobileUserAgent } from "@/lib/device";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.pennypilot.pro";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Penny Pilot", template: "%s · Penny Pilot" },
  description: "A modern personal finance management SaaS dashboard",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Penny Pilot",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
  },
  openGraph: {
    title: "Penny Pilot",
    description: "A modern personal finance management SaaS dashboard",
    url: SITE_URL,
    siteName: "Penny Pilot",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512 }],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Penny Pilot",
    description: "A modern personal finance management SaaS dashboard",
    images: ["/icons/icon-512.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0EA5A5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const isMobile = isMobileUserAgent(headersList.get("user-agent") ?? "");
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Anti-flash: applies the last-resolved theme (written by SettingsContext
            under THEME_STORAGE_KEY = "pfd-theme") before first paint, so there's
            no flash of the wrong theme while /api/settings is still loading. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem("pfd-theme");
                if (t === "dark") document.documentElement.classList.add("dark");
                else if (t !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
                  document.documentElement.classList.add("dark");
                }
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body>
        <Preloader />
        <AntiTamperGuard />
        <PwaInstallCapture />
        <ServiceWorkerUpdatePrompt />
        <Providers isMobile={isMobile}>{children}</Providers>
      </body>
    </html>
  );
}
