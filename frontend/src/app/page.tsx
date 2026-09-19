import { MotionConfig } from "framer-motion";
import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { TrackUnderstandPlan } from "@/components/landing/TrackUnderstandPlan";
import { Features } from "@/components/landing/Features";
import { ProductShowcase } from "@/components/landing/ProductShowcase";
import { PrivacySecurity } from "@/components/landing/PrivacySecurity";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FAQ } from "@/components/landing/FAQ";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { LandingFooter } from "@/components/landing/Footer";

/**
 * Public homepage. Server-rendered with client components for interactive sections.
 * Root layout's metadata (index,follow, canonical "/", OG/Twitter using og-image.png) applies as-is.
 * Exactly one H1 in Hero component for SEO. MotionConfig respects prefers-reduced-motion
 * for every Framer Motion animation on the page.
 */
export default function HomePage() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen flex-col bg-surface dark:bg-navy-dark">
        <Header />
        <main className="flex-1">
          <Hero />
          <TrackUnderstandPlan />
          <Features />
          <ProductShowcase />
          <PrivacySecurity />
          <HowItWorks />
          <FAQ />
          <FinalCTA />
        </main>
        <LandingFooter />
      </div>
    </MotionConfig>
  );
}
