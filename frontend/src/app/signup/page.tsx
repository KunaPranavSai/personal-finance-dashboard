import type { Metadata } from "next";
import { SignupPageClient } from "./SignupPageClient";

export const metadata: Metadata = {
  title: "Create Your Account",
  description: "Create a free Penny Pilot account to start tracking your income, expenses, budgets, bills, savings, and investments.",
  alternates: { canonical: "/signup" },
};

export default function SignupPage() {
  return <SignupPageClient />;
}
