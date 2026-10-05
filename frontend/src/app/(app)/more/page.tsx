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
import { motion, useReducedMotion } from "framer-motion";
import { HUB_FAMILIES } from "@/lib/moreHub";

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
  const { settings } = useSettingsContext();
  const reduce = useReducedMotion();
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

  return (
    <MobileShell title="More">
      <div className="ppm-page-title">
        <h2>More</h2>
        <p>Account &amp; everything else</p>
      </div>

      {/* Whole card is the link; the arrow is decorative. */}
      <Link href="/profile" className="ppm-card ppm-profile-card" aria-label="Open profile">
        <div className="ppm-avatar">{initials}</div>
        <div className="ppm-info">
          <div className="ppm-name">{displayName || "Your account"}</div>
          <div className="ppm-meta">{user?.email}</div>
        </div>
        <span className="ppm-chev" aria-hidden="true">›</span>
      </Link>

      <motion.div
        className="ppm-hub"
        initial={reduce ? false : "hidden"}
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
      >
        {HUB_FAMILIES.map(({ slug, label, desc, icon: Icon }) => (
          <motion.div key={slug} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
            <Link href={`/more/${slug}`} className="ppm-card ppm-hub-card">
              <div className="ppm-ic" aria-hidden="true"><Icon size={20} /></div>
              <div className="ppm-info">
                <div className="ppm-name">{label}</div>
                <div className="ppm-meta">{desc}</div>
              </div>
              <span className="ppm-chev" aria-hidden="true">›</span>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      <button type="button" className="ppm-danger-btn" style={{ width: "100%", marginTop: 16 }} onClick={handleLogout} disabled={loggingOut}>
        {loggingOut ? "Signing out…" : "Sign Out"}
      </button>
    </MobileShell>
  );
}
