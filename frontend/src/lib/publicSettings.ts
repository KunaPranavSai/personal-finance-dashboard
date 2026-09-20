const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Reads the ONE safe field (`supportEmail`) off the public settings endpoint
 * (backend/src/routes/public.routes.ts), which itself reads the Super
 * Admin-configured value from `PlatformSettings` — the same row the Admin
 * Console's Settings page edits via PATCH /api/admin/platform-settings.
 * Never falls back to a hardcoded address: a fetch failure or an
 * unconfigured value both resolve to `null`. Cached briefly since this is
 * public, admin-controlled, rarely-changing configuration, not per-user data.
 * Server-side only (uses `fetch`'s Next.js `revalidate` option).
 */
export async function getSupportEmail(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/public/settings`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { supportEmail: string | null };
    return data.supportEmail || null;
  } catch {
    return null;
  }
}
