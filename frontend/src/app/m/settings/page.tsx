"use client";

import Link from "next/link";
import { MobileShell } from "@/components/mobile/MobileShell";
import { useSettingsContext } from "@/lib/SettingsContext";

/**
 * Mobile "Settings" hub — a real entry point for every existing settings
 * area, presented through the approved mobile card/list pattern. Dark mode
 * is the one setting toggled directly here (same SettingsContext.updateSettings
 * every other theme toggle in this app uses). Everything else — Drive
 * connect/disconnect/restore states, 2FA/passkey/recovery setup, Local-Only
 * export/import/encrypted backup — deep-links to its real, existing desktop
 * screen rather than reproducing that logic here a second time: those
 * screens have many genuine states (see PENNY_PILOT_NEW_UI_IMPLEMENTATION_REPORT.md,
 * "Google Drive storage management") that need to be read off a live app
 * one at a time, not guessed at, to avoid ever showing a fake "Connected"/
 * "Synced" state. This hub makes them reachable from a normal mobile URL;
 * it does not reimplement them.
 */
export default function MobileSettingsPage() {
  const { resolvedTheme, updateSettings } = useSettingsContext();
  const toggleDarkMode = () => updateSettings({ theme: resolvedTheme === "dark" ? "light" : "dark" });

  return (
    <MobileShell title="Settings">
      <div className="ppm-page-title">
        <h2>Settings</h2>
        <p>Account, storage &amp; preferences</p>
      </div>

      <div className="ppm-card">
        <div className="ppm-section-label">Appearance</div>
        <div className="ppm-list-item" style={{ cursor: "default" }}>
          <div className="ppm-ic" aria-hidden="true">🌙</div>
          <div className="ppm-info"><div className="ppm-name">Dark Mode</div></div>
          <button type="button" className={`ppm-toggle${resolvedTheme === "dark" ? " on" : ""}`} role="switch" aria-checked={resolvedTheme === "dark"} aria-label="Toggle dark mode" onClick={toggleDarkMode} />
        </div>
        <a href="/settings?tab=appearance&desktop=1" className="ppm-list-item">
          <div className="ppm-ic" aria-hidden="true">🎨</div>
          <div className="ppm-info"><div className="ppm-name">Currency, Date &amp; Language</div></div>
          <span className="ppm-chev">›</span>
        </a>
      </div>

      <div className="ppm-card" style={{ marginTop: 14 }}>
        <div className="ppm-section-label">Notifications</div>
        <a href="/settings?tab=notifications&desktop=1" className="ppm-list-item">
          <div className="ppm-ic" aria-hidden="true">🔔</div>
          <div className="ppm-info"><div className="ppm-name">Notification Preferences</div></div>
          <span className="ppm-chev">›</span>
        </a>
      </div>

      <div className="ppm-card" style={{ marginTop: 14 }}>
        <div className="ppm-section-label">Storage</div>
        <a href="/settings?tab=backup&desktop=1" className="ppm-list-item">
          <div className="ppm-ic" aria-hidden="true">🗄️</div>
          <div className="ppm-info">
            <div className="ppm-name">Google Drive &amp; Local-Only</div>
            <div className="ppm-meta">Connect, disconnect, restore, encrypted backup</div>
          </div>
          <span className="ppm-chev">›</span>
        </a>
        <Link href="/connect-drive" className="ppm-list-item">
          <div className="ppm-ic" aria-hidden="true">🔗</div>
          <div className="ppm-info"><div className="ppm-name">Connect Google Drive</div></div>
          <span className="ppm-chev">›</span>
        </Link>
        <a href="/settings?tab=export&desktop=1" className="ppm-list-item">
          <div className="ppm-ic" aria-hidden="true">⬇️</div>
          <div className="ppm-info"><div className="ppm-name">Export / Import Data</div></div>
          <span className="ppm-chev">›</span>
        </a>
      </div>

      <div className="ppm-card" style={{ marginTop: 14 }}>
        <div className="ppm-section-label">Security &amp; Account</div>
        <a href="/settings?tab=security&desktop=1" className="ppm-list-item">
          <div className="ppm-ic" aria-hidden="true">🔐</div>
          <div className="ppm-info"><div className="ppm-name">Password &amp; Session</div></div>
          <span className="ppm-chev">›</span>
        </a>
        <Link href="/setup-2fa" className="ppm-list-item">
          <div className="ppm-ic" aria-hidden="true">🛡️</div>
          <div className="ppm-info"><div className="ppm-name">Two-Factor Authentication</div></div>
          <span className="ppm-chev">›</span>
        </Link>
        <Link href="/forgot-password" className="ppm-list-item">
          <div className="ppm-ic" aria-hidden="true">🔑</div>
          <div className="ppm-info"><div className="ppm-name">Account Recovery</div></div>
          <span className="ppm-chev">›</span>
        </Link>
        <a href="/settings?tab=privacy&desktop=1" className="ppm-list-item">
          <div className="ppm-ic" aria-hidden="true">🕶️</div>
          <div className="ppm-info"><div className="ppm-name">Privacy</div></div>
          <span className="ppm-chev">›</span>
        </a>
      </div>

      <div className="ppm-card" style={{ marginTop: 14 }}>
        <div className="ppm-section-label">Legal</div>
        <Link href="/privacy-policy" className="ppm-list-item">
          <div className="ppm-ic" aria-hidden="true">📜</div>
          <div className="ppm-info"><div className="ppm-name">Privacy Policy</div></div>
          <span className="ppm-chev">›</span>
        </Link>
        <Link href="/terms" className="ppm-list-item">
          <div className="ppm-ic" aria-hidden="true">📄</div>
          <div className="ppm-info"><div className="ppm-name">Terms of Service</div></div>
          <span className="ppm-chev">›</span>
        </Link>
      </div>
    </MobileShell>
  );
}
