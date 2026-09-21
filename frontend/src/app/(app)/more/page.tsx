"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MobileShell } from "@/components/mobile/MobileShell";
import { useAuth } from "@/lib/AuthContext";
import { useProfile } from "@/lib/reference";
import { useSettingsContext } from "@/lib/SettingsContext";
import { useIsMobile } from "@/lib/DeviceContext";
import { playVoiceGreeting, VOICE_GREETINGS, isVoiceGreetingsEnabled } from "@/lib/voiceGreeting";
import { useToast } from "@/components/ui/Toast";
import { Moon, Bell, Globe, Receipt, Target, PiggyBank, Landmark, LineChart, FileText, Settings as SettingsIcon, ScrollText } from "lucide-react";

/**
 * Mobile "More" tab — a mobile-only navigation hub with no desktop
 * equivalent page (desktop reaches these same destinations via the
 * sidebar), so desktop UAs are redirected to /settings instead of seeing
 * a broken/empty page. Every link here is a real, already-migrated route.
 */
export default function MorePage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { user, logout } = useAuth();
  const { data: profile } = useProfile();
  const { settings, updateSettings, resolvedTheme } = useSettingsContext();
  const { toast } = useToast();

  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!isMobile) router.replace("/settings");
  }, [isMobile, router]);

  if (!isMobile) return null;

  const displayName = user?.name || profile?.name || "";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "PP";

  const handleLogout = async () => {
    setLoggingOut(true);
    // Real user-initiated sign-out (a deliberate tap on this button) —
    // session expiry/forced logout never reach this handler.
    const voiceEnabled = isVoiceGreetingsEnabled(settings.preferences);
    if (voiceEnabled) {
      playVoiceGreeting("signOut", { enabled: voiceEnabled });
      toast(VOICE_GREETINGS.signOut, "info");
    }
    await logout();
    if (voiceEnabled) {
      // Bounded, brief head start for the goodbye clip before this
      // client-side route change unmounts the app tree — never blocks
      // logout itself. Client-side navigation (not a hard reload) also
      // means playback keeps going after this even if it's still fetching.
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    router.replace("/login");
  };

  const toggleDarkMode = () => {
    updateSettings({ theme: resolvedTheme === "dark" ? "light" : "dark" });
  };

  const notificationsEnabled = Boolean((settings.notifications as Record<string, unknown> | undefined)?.push ?? true);

  return (
    <MobileShell title="More">
      <div className="ppm-page-title">
        <h2>More</h2>
        <p>Account &amp; everything else</p>
      </div>

      <div className="ppm-card ppm-profile-card">
        <div className="ppm-avatar">{initials}</div>
        <div className="ppm-info">
          <div className="ppm-name">{displayName || "Your account"}</div>
          <div className="ppm-meta">{user?.email}</div>
        </div>
        <Link href="/profile" className="ppm-chev" aria-label="Edit profile">›</Link>
      </div>

      <div className="ppm-card" style={{ marginTop: 14 }}>
        <div className="ppm-section-label">Preferences</div>
        <div className="ppm-list-item">
          <div className="ppm-ic" aria-hidden="true"><Moon size={18} /></div>
          <div className="ppm-info"><div className="ppm-name">Dark Mode</div></div>
          <button type="button" className={`ppm-toggle${resolvedTheme === "dark" ? " on" : ""}`} role="switch" aria-checked={resolvedTheme === "dark"} aria-label="Toggle dark mode" onClick={toggleDarkMode} />
        </div>
        <Link href="/notifications" className="ppm-list-item">
          <div className="ppm-ic" aria-hidden="true"><Bell size={18} /></div>
          <div className="ppm-info"><div className="ppm-name">Notifications</div></div>
          <span className={`ppm-toggle${notificationsEnabled ? " on" : ""}`} aria-hidden="true" />
          <span className="ppm-chev">›</span>
        </Link>
        <Link href="/settings" className="ppm-list-item">
          <div className="ppm-ic" aria-hidden="true"><Globe size={18} /></div>
          <div className="ppm-info"><div className="ppm-name">Currency, Date &amp; Language</div></div>
          <span className="ppm-chev">›</span>
        </Link>
      </div>

      <div className="ppm-card" style={{ marginTop: 14 }}>
        <div className="ppm-section-label">Financial Modules</div>
        <Link href="/bills" className="ppm-list-item"><div className="ppm-ic" aria-hidden="true"><Receipt size={18} /></div><div className="ppm-info"><div className="ppm-name">Bills &amp; EMIs</div></div><span className="ppm-chev">›</span></Link>
        <Link href="/goals" className="ppm-list-item"><div className="ppm-ic" aria-hidden="true"><Target size={18} /></div><div className="ppm-info"><div className="ppm-name">Goals</div></div><span className="ppm-chev">›</span></Link>
        <Link href="/savings" className="ppm-list-item"><div className="ppm-ic" aria-hidden="true"><PiggyBank size={18} /></div><div className="ppm-info"><div className="ppm-name">Savings</div></div><span className="ppm-chev">›</span></Link>
        <Link href="/accounts" className="ppm-list-item"><div className="ppm-ic" aria-hidden="true"><Landmark size={18} /></div><div className="ppm-info"><div className="ppm-name">Wallets, Categories &amp; Money Sources</div></div><span className="ppm-chev">›</span></Link>
        <Link href="/analytics" className="ppm-list-item"><div className="ppm-ic" aria-hidden="true"><LineChart size={18} /></div><div className="ppm-info"><div className="ppm-name">Analytics</div></div><span className="ppm-chev">›</span></Link>
        <Link href="/reports" className="ppm-list-item"><div className="ppm-ic" aria-hidden="true"><FileText size={18} /></div><div className="ppm-info"><div className="ppm-name">Reports</div></div><span className="ppm-chev">›</span></Link>
      </div>

      <div className="ppm-card" style={{ marginTop: 14 }}>
        <div className="ppm-section-label">Storage &amp; Account</div>
        <Link href="/settings" className="ppm-list-item"><div className="ppm-ic" aria-hidden="true"><SettingsIcon size={18} /></div><div className="ppm-info"><div className="ppm-name">Settings</div><div className="ppm-meta">Appearance, storage, security, privacy</div></div><span className="ppm-chev">›</span></Link>
        <Link href="/terms" className="ppm-list-item"><div className="ppm-ic" aria-hidden="true"><ScrollText size={18} /></div><div className="ppm-info"><div className="ppm-name">Legal &amp; Consent</div></div><span className="ppm-chev">›</span></Link>
      </div>

      <button type="button" className="ppm-danger-btn" style={{ width: "100%", marginTop: 16 }} onClick={handleLogout} disabled={loggingOut}>
        {loggingOut ? "Signing out…" : "Sign Out"}
      </button>
    </MobileShell>
  );
}
