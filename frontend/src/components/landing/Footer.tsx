import Link from "next/link";
import Image from "next/image";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Reads the ONE safe field (`supportEmail`) off the public settings endpoint
 * (backend/src/routes/public.routes.ts), which itself reads the Super
 * Admin-configured value from `PlatformSettings` — the same row the Admin
 * Console's Settings page edits via PATCH /api/admin/platform-settings.
 * Never falls back to a hardcoded address: a fetch failure or an
 * unconfigured value both resolve to `null`, and the footer renders a
 * non-actionable label instead of a real link. Cached briefly since this is
 * public, admin-controlled, rarely-changing configuration, not per-user data.
 */
async function getSupportEmail(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/public/settings`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { supportEmail: string | null };
    return data.supportEmail || null;
  } catch {
    return null;
  }
}

export async function LandingFooter() {
  const supportEmail = await getSupportEmail();
  return (
    <footer id="support" className="border-t border-pp-border px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <Link href="/" className="flex items-center gap-2" aria-label="Penny Pilot Home">
          <Image src="/logo.png" alt="Penny Pilot" width={24} height={24} className="h-6 w-6 shrink-0 rounded-md object-cover" />
          <span className="text-sm font-semibold text-pp-text">Penny Pilot</span>
        </Link>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-pp-text-dim">
          <Link href="/manual" className="hover:text-pp-accent hover:underline">User Manual</Link>
          <Link href="/privacy-policy" className="hover:text-pp-accent hover:underline">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-pp-accent hover:underline">Terms of Service</Link>
          {supportEmail ? (
            <a href={`mailto:${supportEmail}`} className="hover:text-pp-accent hover:underline">Contact Support</a>
          ) : (
            <span className="cursor-not-allowed text-pp-text-dim/60" aria-disabled="true">Contact Support</span>
          )}
        </div>

        <p className="text-xs text-pp-text-dim">© {new Date().getFullYear()} Penny Pilot</p>
      </div>
    </footer>
  );
}
