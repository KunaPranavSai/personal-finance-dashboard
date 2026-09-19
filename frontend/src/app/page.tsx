import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { ProductShowcase } from "@/components/landing/ProductShowcase";
import { PrivacySecurity } from "@/components/landing/PrivacySecurity";
import { GoogleDrive } from "@/components/landing/GoogleDrive";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Benefits } from "@/components/landing/Benefits";
import { FAQ } from "@/components/landing/FAQ";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { LandingFooter } from "@/components/landing/Footer";

/**
 * Public homepage. Server-rendered with client components for interactive sections.
 * Root layout's metadata (index,follow, canonical "/", OG/Twitter using og-image.png) applies as-is.
 * Exactly one H1 in Hero component for SEO.
 */
export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface dark:bg-navy-dark">
      <Header />
      <main className="flex-1">
        <Hero />
        <Features />
        <ProductShowcase />
        <PrivacySecurity />
        <GoogleDrive />
        <HowItWorks />
        <Benefits />
        <FAQ />
        <FinalCTA />
      </main>
      <LandingFooter />
    </div>
  );
}