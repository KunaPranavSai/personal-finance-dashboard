import type { Metadata } from "next";
import { LoginPageClient } from "./LoginPageClient";
import { SoftwareApplicationJsonLd } from "@/components/seo/SoftwareApplicationJsonLd";

export const metadata: Metadata = {
  title: "Log In",
  description: "Log in to your Penny Pilot account to view your income, expenses, budgets, bills, savings, and investments.",
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  return (
    <>
      <SoftwareApplicationJsonLd />
      <LoginPageClient />
    </>
  );
}
