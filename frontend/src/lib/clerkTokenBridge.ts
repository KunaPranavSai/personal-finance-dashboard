/**
 * Bridges Clerk's React-hook-only `getToken()` into `lib/api.ts`'s plain
 * async `request()` function (called from React Query queryFns, event
 * handlers, etc. — not just components). `ClerkTokenBridge` (mounted once
 * inside <ClerkProvider> in layout.tsx) registers the live getter; api.ts
 * calls `getClerkToken()` to attach it as an Authorization header, since the
 * Express backend is a separate origin and can't read Clerk's own session
 * cookie directly (see backend/src/middleware/clerkAuth.ts).
 */
type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter | null = null;

export function setClerkTokenGetter(getter: TokenGetter | null) {
  tokenGetter = getter;
}

export async function getClerkToken(): Promise<string | null> {
  if (!tokenGetter) return null;
  try {
    return await tokenGetter();
  } catch {
    return null;
  }
}
