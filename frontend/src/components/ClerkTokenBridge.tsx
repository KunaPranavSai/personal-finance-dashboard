"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { setClerkTokenGetter } from "@/lib/clerkTokenBridge";
import { isClerkAuth } from "@/lib/authProvider";

/** No-op unless NEXT_PUBLIC_AUTH_PROVIDER=clerk. Mounted inside <ClerkProvider> in layout.tsx. */
export function ClerkTokenBridge() {
  const { getToken } = useAuth();

  useEffect(() => {
    if (!isClerkAuth) return;
    setClerkTokenGetter(getToken);
    return () => setClerkTokenGetter(null);
  }, [getToken]);

  return null;
}
