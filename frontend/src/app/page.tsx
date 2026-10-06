import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "@/styles/landing.css";
import { MotionConfig } from "framer-motion";
import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { WhyPennyPilot } from "@/components/landing/WhyPennyPilot";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Modules } from "@/components/landing/Modules";
import { StorageChoice } from "@/components/landing/StorageChoice";
import { LiveBackground } from "@/components/landing/LiveBackground";
import { FAQ } from "@/components/landing/FAQ";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { LandingFooter } from "@/components/landing/Footer";
import { LoginModalProvider } from "@/components/landing/LoginModalContext";
import { LoginModal } from "@/components/landing/LoginModal";
import { SoftwareApplicationJsonLd } from "@/components/seo/SoftwareApplicationJsonLd";
import { FAQJsonLd } from "@/components/landing/FAQJsonLd";
import { SITE_URL } from "@/lib/siteUrl";

const geist = Geist({ subsets: ["latin"], variable: "--font-landing", display: "swap" });

const TITLE = "Penny Pilot - Smart Money Management";
const DESCRIPTION =
  "Penny Pilot is a personal finance app for expense tracking, income tracking, budgeting, and savings goals. Store your data in Google Drive or keep it Local-Only, and get clear financial insights in one place.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
};

/**
 * Public homepage. Root layout supplies metadataBase/OG url/OG image/robots
 * defaults; this only overrides the title/description for the home route
 * specifically. Exactly one H1, in Hero. Uses the same pp-* tokens/
 * typography/cards as the authenticated app so landing -> login ->
 * dashboard reads as one product, not three.
 */
export default function HomePage() {
  return (
    <MotionConfig reducedMotion="user">
      <SoftwareApplicationJsonLd />
      <FAQJsonLd />
      <LoginModalProvider>
        <div className={`${geist.variable} relative isolate flex min-h-screen flex-col bg-pp-bg font-[family-name:var(--font-landing)] text-pp-text`}>
          <LiveBackground />
          <Header />
          <main className="flex-1">
            <Hero />
            <Modules />
            <Features />
            <WhyPennyPilot />
            <HowItWorks />
            <StorageChoice />
            <FAQ />
            <FinalCTA />
          </main>
          <LandingFooter />
        </div>
        <LoginModal />
      </LoginModalProvider>
    </MotionConfig>
  );
}
