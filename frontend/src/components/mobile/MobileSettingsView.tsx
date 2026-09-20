"use client";

import { useState } from "react";
import Link from "next/link";
import { MobileShell } from "@/components/mobile/MobileShell";
import { MobileSheet } from "@/components/mobile/MobileSheet";
import { useSettingsContext } from "@/lib/SettingsContext";
import { useDriveStatus, isDriveReady } from "@/lib/driveStatus";
import { getStorageMode } from "@/lib/storage";
import { CURRENCIES, DATE_FORMATS, LANGUAGES, TIMEZONES } from "@/lib/reference";
import { downloadExport } from "@/lib/export";
import { useToast } from "@/components/ui/Toast";
import { isVoiceGreetingsEnabled } from "@/lib/voiceGreeting";

const FIRST_DAY_OPTIONS = [
  { value: "sunday", label: "Sunday" },
  { value: "monday", label: "Monday" },
];
const NOTIFICATION_TOGGLES = [
  { key: "email", label: "Email Notifications" },
  { key: "push", label: "Push / Browser Notifications" },
  { key: "budgetAlerts", label: "Budget Alerts" },
  { key: "goalUpdates", label: "Goal Progress Alerts" },
  { key: "billReminders", label: "Bill Reminders" },
  { key: "insights", label: "Insights & Tips" },
] as const;
const REMINDER_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "never", label: "Never" },
];
const PRIVACY_TOGGLES = [
  { key: "shareAnonymousData", label: "Share anonymous usage data" },
  { key: "analytics", label: "Analytics" },
  { key: "crashReporting", label: "Crash Reporting" },
  { key: "tracking", label: "Tracking" },
] as const;
const EXPORT_TYPES = [
  { key: "transactions", label: "Transactions" },
  { key: "budgets", label: "Budgets" },
  { key: "investments", label: "Investments" },
  { key: "bills", label: "Bills" },
  { key: "goals", label: "Goals" },
  { key: "accounts", label: "Accounts" },
  { key: "categories", label: "Categories" },
];

/**
 * Mobile "Settings" hub — a real entry point for every existing settings
 * area, presented through the approved mobile card/list pattern. Dark mode,
 * Preferences (currency/date/language), Notifications and Privacy are all
 * edited natively here via the same `updateSettings` call the desktop tabs
 * use — no desktop redirect. 2FA/passkeys/password have their own native
 * screen at /settings/security. Drive connect uses /connect-drive.
 * "Manage Storage" (disconnect / restore / switch mode / encrypted backup)
 * is the one remaining desktop link: it's a multi-step Google Drive state
 * machine with real account-altering consequences (can disconnect Drive or
 * overwrite local data) that needs each live state read directly off the
 * app, not guessed at — porting it without that care risks exactly the kind
 * of fake "Connected/Synced" state this app deliberately avoids showing.
 */
const DRIVE_STATE_LABEL: { test: (s: ReturnType<typeof useDriveStatus>["data"]) => boolean; label: string; tone: "under" | "near" | "over" }[] = [
  { test: (s) => !s?.configured, label: "Not available", tone: "over" },
  { test: (s) => Boolean(s?.connected && s?.initialized), label: "Connected", tone: "under" },
  { test: (s) => Boolean(s?.connected && !s?.initialized), label: "Connected, not set up", tone: "near" },
  { test: () => true, label: "Not connected", tone: "near" },
];

export function MobileSettingsView() {
  const { settings, resolvedTheme, updateSettings } = useSettingsContext();
  const { toast } = useToast();
  const toggleDarkMode = () => updateSettings({ theme: resolvedTheme === "dark" ? "light" : "dark" });
  const isLocalOnly = getStorageMode() === "local";
  const { data: driveStatus, isLoading: driveStatusLoading } = useDriveStatus();
  const driveState = DRIVE_STATE_LABEL.find((s) => s.test(driveStatus));

  const [prefsOpen, setPrefsOpen] = useState(false);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportTypes, setExportTypes] = useState<string[]>(EXPORT_TYPES.map((t) => t.key));
  const [exporting, setExporting] = useState(false);

  const notifs = (settings.notifications ?? {}) as Record<string, unknown>;
  const priv = (settings.privacy ?? {}) as Record<string, unknown>;
  const pref = (settings.preferences ?? {}) as Record<string, unknown>;
  const toggleNotif = (key: string) => updateSettings({ notifications: { ...notifs, [key]: !notifs[key] } });
  const togglePriv = (key: string) => updateSettings({ privacy: { ...priv, [key]: !priv[key] } });
  const voiceGreetingsEnabled = isVoiceGreetingsEnabled(pref);
  const toggleVoiceGreetings = () => updateSettings({ preferences: { ...pref, voiceGreetings: !voiceGreetingsEnabled } });
  const toggleExportType = (key: string) => setExportTypes((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const runExport = async (format: "csv" | "json" | "xlsx" | "pdf") => {
    setExporting(true);
    try {
      await downloadExport(format, toast, undefined, exportTypes);
      setExportOpen(false);
    } catch {
      // downloadExport already surfaced the error via toast
    } finally {
      setExporting(false);
    }
  };

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
        <button type="button" className="ppm-list-item" onClick={() => setPrefsOpen(true)}>
          <div className="ppm-ic" aria-hidden="true">🎨</div>
          <div className="ppm-info"><div className="ppm-name">Currency, Date &amp; Language</div></div>
          <span className="ppm-chev">›</span>
        </button>
      </div>

      <div className="ppm-card" style={{ marginTop: 14 }}>
        <div className="ppm-section-label">Preferences</div>
        <div className="ppm-list-item" style={{ cursor: "default" }}>
          <div className="ppm-ic" aria-hidden="true">🔊</div>
          <div className="ppm-info">
            <div className="ppm-name">Voice Greetings</div>
            <div className="ppm-meta">Hear a short spoken greeting when you sign in, sign up, or sign out.</div>
          </div>
          <button
            type="button"
            className={`ppm-toggle${voiceGreetingsEnabled ? " on" : ""}`}
            role="switch"
            aria-checked={voiceGreetingsEnabled}
            aria-label="Toggle voice greetings"
            onClick={toggleVoiceGreetings}
          />
        </div>
      </div>

      <div className="ppm-card" style={{ marginTop: 14 }}>
        <div className="ppm-section-label">Notifications</div>
        <button type="button" className="ppm-list-item" onClick={() => setNotifsOpen(true)}>
          <div className="ppm-ic" aria-hidden="true">🔔</div>
          <div className="ppm-info"><div className="ppm-name">Notification Preferences</div></div>
          <span className="ppm-chev">›</span>
        </button>
      </div>

      <div className="ppm-card" style={{ marginTop: 14 }}>
        <div className="ppm-section-label">Storage</div>
        {isLocalOnly ? (
          <div className="ppm-list-item" style={{ cursor: "default" }}>
            <div className="ppm-ic" aria-hidden="true">💾</div>
            <div className="ppm-info"><div className="ppm-name">This Device Only</div></div>
          </div>
        ) : (
          <Link href="/settings/storage" className="ppm-list-item">
            <div className="ppm-ic" aria-hidden="true">🗄️</div>
            <div className="ppm-info">
              <div className="ppm-name">Google Drive</div>
              {driveStatus?.accountEmail && <div className="ppm-meta">{driveStatus.accountEmail}</div>}
            </div>
            {!driveStatusLoading && driveState && <span className={`ppm-status ${driveState.tone}`}>{driveState.label}</span>}
            <span className="ppm-chev">›</span>
          </Link>
        )}
        <Link href="/settings/storage" className="ppm-list-item">
          <div className="ppm-ic" aria-hidden="true">⚙️</div>
          <div className="ppm-info">
            <div className="ppm-name">Manage Storage</div>
            <div className="ppm-meta">Disconnect, restore, switch mode, encrypted backup</div>
          </div>
          <span className="ppm-chev">›</span>
        </Link>
        {!isDriveReady(driveStatus) && !isLocalOnly && (
          <Link href="/connect-drive" className="ppm-list-item">
            <div className="ppm-ic" aria-hidden="true">🔗</div>
            <div className="ppm-info"><div className="ppm-name">Connect Google Drive</div></div>
            <span className="ppm-chev">›</span>
          </Link>
        )}
        <button type="button" className="ppm-list-item" onClick={() => setExportOpen(true)}>
          <div className="ppm-ic" aria-hidden="true">⬇️</div>
          <div className="ppm-info"><div className="ppm-name">Export Data</div></div>
          <span className="ppm-chev">›</span>
        </button>
      </div>

      <div className="ppm-card" style={{ marginTop: 14 }}>
        <div className="ppm-section-label">Security &amp; Account</div>
        <Link href="/settings/security" className="ppm-list-item">
          <div className="ppm-ic" aria-hidden="true">🔐</div>
          <div className="ppm-info"><div className="ppm-name">2FA, Passkeys &amp; Password</div></div>
          <span className="ppm-chev">›</span>
        </Link>
        <Link href="/forgot-password" className="ppm-list-item">
          <div className="ppm-ic" aria-hidden="true">🔑</div>
          <div className="ppm-info"><div className="ppm-name">Account Recovery</div></div>
          <span className="ppm-chev">›</span>
        </Link>
        <button type="button" className="ppm-list-item" onClick={() => setPrivacyOpen(true)}>
          <div className="ppm-ic" aria-hidden="true">🕶️</div>
          <div className="ppm-info"><div className="ppm-name">Privacy</div></div>
          <span className="ppm-chev">›</span>
        </button>
      </div>

      <div className="ppm-card" style={{ marginTop: 14 }}>
        <div className="ppm-section-label">Help &amp; Documentation</div>
        <Link href="/manual" className="ppm-list-item">
          <div className="ppm-ic" aria-hidden="true">📖</div>
          <div className="ppm-info">
            <div className="ppm-name">User Manual</div>
            <div className="ppm-meta">Learn how Penny Pilot works</div>
          </div>
          <span className="ppm-chev">›</span>
        </Link>
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

      <MobileSheet open={prefsOpen} onClose={() => setPrefsOpen(false)} title="Currency, Date & Language">
        <div className="ppm-field">
          <label htmlFor="ppm-pref-currency">Currency</label>
          <select id="ppm-pref-currency" value={String(settings.currency ?? "INR")} onChange={(e) => updateSettings({ currency: e.target.value, currencySymbol: e.target.value })}>
            {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="ppm-field">
          <label htmlFor="ppm-pref-date">Date Format</label>
          <select id="ppm-pref-date" value={String(settings.dateFormat ?? "DD-MM-YYYY")} onChange={(e) => updateSettings({ dateFormat: e.target.value })}>
            {DATE_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div className="ppm-field">
          <label htmlFor="ppm-pref-time">Time Format</label>
          <select id="ppm-pref-time" value={String(settings.timeFormat ?? "24h")} onChange={(e) => updateSettings({ timeFormat: e.target.value })}>
            <option value="24h">24-Hour</option>
            <option value="12h">12-Hour (AM/PM)</option>
          </select>
        </div>
        <div className="ppm-field">
          <label htmlFor="ppm-pref-tz">Timezone</label>
          <select id="ppm-pref-tz" value={String(settings.timezone ?? "Asia/Kolkata")} onChange={(e) => updateSettings({ timezone: e.target.value })}>
            {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="ppm-field">
          <label htmlFor="ppm-pref-lang">Language</label>
          <select id="ppm-pref-lang" value={String(settings.language ?? "en")} onChange={(e) => updateSettings({ language: e.target.value })}>
            {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
        <div className="ppm-field">
          <label htmlFor="ppm-pref-fday">First Day of Week</label>
          <select id="ppm-pref-fday" value={String(settings.firstDayOfWeek ?? "monday")} onChange={(e) => updateSettings({ firstDayOfWeek: e.target.value })}>
            {FIRST_DAY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <p style={{ fontSize: 11, color: "var(--ppm-text-dim)" }}>Changes apply instantly — no save needed.</p>
        <div className="ppm-sheet-actions">
          <button type="button" className="ppm-sheet-cancel" onClick={() => setPrefsOpen(false)}>Done</button>
        </div>
      </MobileSheet>

      <MobileSheet open={notifsOpen} onClose={() => setNotifsOpen(false)} title="Notification Preferences">
        {NOTIFICATION_TOGGLES.map((opt) => (
          <label key={opt.key} className="ppm-list-item" style={{ cursor: "pointer" }}>
            <div className="ppm-info"><div className="ppm-name" style={{ fontWeight: 500, fontSize: ".85rem" }}>{opt.label}</div></div>
            <button type="button" className={`ppm-toggle${notifs[opt.key] ? " on" : ""}`} role="switch" aria-checked={Boolean(notifs[opt.key])} onClick={() => toggleNotif(opt.key)} />
          </label>
        ))}
        <div className="ppm-field" style={{ marginTop: 10 }}>
          <label htmlFor="ppm-notif-freq">Reminder Frequency</label>
          <select id="ppm-notif-freq" value={String(notifs.reminderFrequency ?? "daily")} onChange={(e) => updateSettings({ notifications: { ...notifs, reminderFrequency: e.target.value } })}>
            {REMINDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="ppm-sheet-actions">
          <button type="button" className="ppm-sheet-cancel" onClick={() => setNotifsOpen(false)}>Done</button>
        </div>
      </MobileSheet>

      <MobileSheet open={privacyOpen} onClose={() => setPrivacyOpen(false)} title="Privacy">
        {PRIVACY_TOGGLES.map((opt) => (
          <label key={opt.key} className="ppm-list-item" style={{ cursor: "pointer" }}>
            <div className="ppm-info"><div className="ppm-name" style={{ fontWeight: 500, fontSize: ".85rem" }}>{opt.label}</div></div>
            <button type="button" className={`ppm-toggle${priv[opt.key] ? " on" : ""}`} role="switch" aria-checked={Boolean(priv[opt.key])} onClick={() => togglePriv(opt.key)} />
          </label>
        ))}
        <div className="ppm-sheet-actions">
          <button type="button" className="ppm-sheet-cancel" onClick={() => setPrivacyOpen(false)}>Done</button>
        </div>
      </MobileSheet>

      <MobileSheet open={exportOpen} onClose={() => setExportOpen(false)} title="Export Data">
        <p style={{ fontSize: 12, color: "var(--ppm-text-dim)", marginBottom: 10 }}>Choose what to include, then download.</p>
        {EXPORT_TYPES.map((t) => (
          <label key={t.key} className="ppm-list-item" style={{ cursor: "pointer" }}>
            <div className="ppm-info"><div className="ppm-name" style={{ fontWeight: 500, fontSize: ".85rem" }}>{t.label}</div></div>
            <input type="checkbox" checked={exportTypes.includes(t.key)} onChange={() => toggleExportType(t.key)} style={{ width: 20, height: 20 }} />
          </label>
        ))}
        <div className="ppm-sheet-actions" style={{ flexWrap: "wrap" }}>
          <button type="button" className="ppm-sheet-submit" disabled={exporting || exportTypes.length === 0} onClick={() => runExport("csv")}>{exporting ? "Exporting…" : "⬇ CSV"}</button>
          <button type="button" className="ppm-sheet-submit" disabled={exporting || exportTypes.length === 0} onClick={() => runExport("json")}>{exporting ? "Exporting…" : "⬇ JSON"}</button>
          <button type="button" className="ppm-sheet-cancel" onClick={() => setExportOpen(false)} disabled={exporting}>Cancel</button>
        </div>
      </MobileSheet>
    </MobileShell>
  );
}
