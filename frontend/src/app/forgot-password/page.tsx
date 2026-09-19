import type { Metadata } from "next";
import { ForgotPasswordPageClient } from "./ForgotPasswordPageClient";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Reset your Penny Pilot account password.",
  alternates: { canonical: "/forgot-password" },
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordPageClient />;
}
