import type { Metadata } from "next";
import { GetStartedPageClient } from "./GetStartedPageClient";

export const metadata: Metadata = {
  title: "Get Started",
  description: "Start exploring Penny Pilot right away. Verify your email only when you are ready to save your own data.",
  alternates: { canonical: "/signup" },
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  return <GetStartedPageClient />;
}
