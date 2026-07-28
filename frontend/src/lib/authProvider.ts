/**
 * Feature flag deciding which auth system is active for this deployment.
 * Defaults to "legacy" — the existing password/2FA/passkey system built in
 * AuthContext.tsx — so nothing changes until this is explicitly set to
 * "clerk" (and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY /
 * backend AUTH_PROVIDER=clerk are configured). Must match the backend flag.
 */
export const AUTH_PROVIDER: "legacy" | "clerk" =
  process.env.NEXT_PUBLIC_AUTH_PROVIDER === "clerk" ? "clerk" : "legacy";

export const isClerkAuth = AUTH_PROVIDER === "clerk";
