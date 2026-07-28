"use client";

import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

/**
 * Role-based routing (USER -> /dashboard, ADMIN/SUPER_ADMIN -> /admin) already
 * happens inside the (app)/(admin) layouts via useClerkUserProfile, so this
 * only needs a safe default destination plus any preserved deep link.
 */
function SignInContent() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const destination = redirect && redirect.startsWith("/") && !redirect.startsWith("//") && !redirect.startsWith("/sign-in")
    ? redirect
    : "/dashboard";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-[#0a1628] to-slate-900 p-4">
      <SignIn fallbackRedirectUrl={destination} signUpUrl="/sign-up" />
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#0a1628] to-slate-900" />}>
      <SignInContent />
    </Suspense>
  );
}
