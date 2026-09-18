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
import { SITE_URL } from "@/lib/siteUrl";

const DESCRIPTION =
  "Penny Pilot is a personal finance dashboard for tracking income, expenses, budgets, bills, savings, and investments in one secure place.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Penny Pilot — Personal Finance Dashboard", template: "%s · Penny Pilot" },
  description: DESCRIPTION,
  keywords: [
    "personal finance dashboard",
    "expense tracker",
    "budget planner",
    "income tracker",
    "bill reminders",
    "savings goals",
    "investment tracking",
  ],
  authors: [{ name: "Penny Pilot" }],
  creator: "Penny Pilot",
  publisher: "Penny Pilot",
  applicationName: "Penny Pilot",
  category: "finance",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
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
    title: "Penny Pilot — Personal Finance Dashboard",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Penny Pilot",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Penny Pilot — Personal Finance Dashboard" }],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Penny Pilot — Personal Finance Dashboard",
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
      : undefined,
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
