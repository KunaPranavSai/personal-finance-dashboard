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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem("pfd-ui-store");
                if (t) {
                  var p = JSON.parse(t);
                  if (p.state && p.state.theme === "dark") document.documentElement.classList.add("dark");
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
