import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Preloader } from "@/components/Preloader";
import { AntiTamperGuard } from "@/components/AntiTamperGuard";
import { ServiceWorkerUpdatePrompt } from "@/components/pwa/ServiceWorkerUpdatePrompt";
import { PwaInstallCapture } from "@/components/pwa/PwaInstallCapture";

export const metadata: Metadata = {
  title: "Penny Pilot",
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
};

export const viewport: Viewport = {
  themeColor: "#0EA5A5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
