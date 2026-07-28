"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { api } from "./api";

interface AppUserProfile {
  uid: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
}

/**
 * Once Clerk confirms sign-in, resolves this app's own role/profile via the
 * existing `/api/auth/me` endpoint — which already works transparently under
 * Clerk auth, since the backend's `authenticate` middleware dispatches to
 * Clerk verification and resolves the same User row (see
 * backend/src/middleware/clerkAuth.ts). Clerk itself has no concept of this
 * app's role/permission model, so this is how the Clerk-mode layouts know
 * whether to gate a route to admins vs. regular users.
 */
export function useClerkUserProfile() {
  const { isLoaded, isSignedIn } = useUser();
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [isResolving, setIsResolving] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setProfile(null);
      setIsResolving(false);
      return;
    }
    let cancelled = false;
    setIsResolving(true);
    api
      .get<{ user: AppUserProfile }>("/api/auth/me")
      .then((data) => { if (!cancelled) setProfile(data.user); })
      .catch(() => { if (!cancelled) setProfile(null); })
      .finally(() => { if (!cancelled) setIsResolving(false); });
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn]);

  return { isLoaded, isSignedIn, profile, isResolving };
}
