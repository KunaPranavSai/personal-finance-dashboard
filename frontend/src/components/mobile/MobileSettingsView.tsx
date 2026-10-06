"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DeleteAccountPanel } from "@/components/settings/DeleteAccountPanel";
import { MobileShell } from "@/components/mobile/MobileShell";
import { MobileSheet } from "@/components/mobile/MobileSheet";
import { useSettingsContext } from "@/lib/SettingsContext";
import { useDriveStatus, isDriveReady } from "@/lib/driveStatus";
import { getStorageMode } from "@/lib/storage";
import { CURRENCIES, DATE_FORMATS, LANGUAGES, TIMEZONES } from "@/lib/reference";
import { downloadExport } from "@/lib/export";
import { useToast } from "@/components/ui/Toast";
import { isVoiceGreetingsEnabled } from "@/lib/voiceGreeting";
import { Compass, Bell, Settings as SettingsIcon, BookOpen, HardDrive, Database, Link2, Download, Lock, Key, EyeOff, Moon, Palette, Volume2, FileText, ScrollText, MonitorSmartphone, UserCircle } from "lucide-react";

const TABS = [
  { id: "preferences", label: "Preferences", sub: "Appearance, region & notifications" },
  { id: "security", label: "Security", sub: "Sign-in and protection" },
  { id: "privacy", label: "Privacy", sub: "Control your data" },
  { id: "data", label: "Data", sub: "Storage, backup & export" },
  { id: "account", label: "Account", sub: "Profile, help & account deletion" },
];
const TAB_IDS = TABS.map((t) => t.id);
const LEGACY: Record<string, string> = { appearance: "preferences", regional: "preferences", notifications: "preferences", backup: "data", export: "data", storage: "data" };
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
  { key: "showInSuggestions", label: "Show my profile in community suggestions" },
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

import { useStoragePolicy, DRIVE_DISABLED_TEXT, DEVICE_DISABLED_TEXT } from "@/lib/storagePolicy";

export function MobileSettingsView() {
  const policy = useStoragePolicy();
  const { settings, resolvedTheme, updateSettings } = useSettingsContext();
  const { toast } = useToast();
  const toggleDarkMode = () => updateSettings({ theme: resolvedTheme === "dark" ? "light" : "dark" });
  const isLocalOnly = getStorageMode() === "local";
  const { data: driveStatus, isLoading: driveStatusLoading } = useDriveStatus();
  const driveState = DRIVE_STATE_LABEL.find((s) => s.test(driveStatus));

  const [prefsOpen, setPrefsOpen] = useState(false);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  // Five tabs; old deep links (?tab=appearance|regional|notifications|export|backup) land on the tab that now holds them.
  const router = useRouter();
  const raw = useSearchParams().get("tab") ?? "preferences";
  const tab = TAB_IDS.includes(raw) ? raw : LEGACY[raw] ?? "preferences";
  const row = (icon: ReactNode, name: string, meta?: string) => (<>
    <div className="ppm-ic" aria-hidden="true">{icon}</div>
    <div className="ppm-info"><div className="ppm-name">{name}</div>{meta && <div className="ppm-meta">{meta}</div>}</div>
    <span className="ppm-chev" aria-hidden="true">›</span>
  </>);
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
        <p>{TABS.find((t) => t.id === tab)?.sub}</p>
      </div>

      <div className="ppm-filters" role="tablist" aria-label="Settings sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`ppm-chip${tab === t.id ? " on" : ""}`} onClick={() => router.replace(`/settings?tab=${t.id}`)}>{t.label}</button>
        ))}
      </div>

      {tab === "preferences" && (<>
      <div className="ppm-card">
        <div className="ppm-section-label">Appearance &amp; region</div>
        <div className="ppm-list-item" style={{ cursor: "default" }}>
          <div className="ppm-ic" aria-hidden="true"><Moon size={18} /></div>
          <div className="ppm-info"><div className="ppm-name">Dark Mode</div></div>
          <button type="button" className={`ppm-toggle${resolvedTheme === "dark" ? " on" : ""}`} role="switch" aria-checked={resolvedTheme === "dark"} aria-label="Toggle dark mode" onClick={toggleDarkMode} />
        </div>
        <button type="button" className="ppm-list-item" onClick={() => setPrefsOpen(true)}>{row(<Palette size={18} />, "Currency, Date & Language")}</button>
        <div className="ppm-list-item" style={{ cursor: "default" }}>
          <div className="ppm-ic" aria-hidden="true"><Volume2 size={18} /></div>
          <div className="ppm-info">
            <div className="ppm-name">Voice Greetings</div>
            <div className="ppm-meta">A short spoken greeting on sign in, sign up and sign out.</div>
          </div>
          <button type="button" className={`ppm-toggle${voiceGreetingsEnabled ? " on" : ""}`} role="switch" aria-checked={voiceGreetingsEnabled} aria-label="Toggle voice greetings" onClick={toggleVoiceGreetings} />
        </div>
      </div>
      <div className="ppm-card" style={{ marginTop: 14 }}>
        <div className="ppm-section-label">Notifications</div>
        <button type="button" className="ppm-list-item" onClick={() => setNotifsOpen(true)}>{row(<Bell size={18} />, "Notification Preferences", "Reminders and alerts")}</button>
      </div>
      </>)}

      {tab === "security" && (
      <div className="ppm-card">
        <div className="ppm-section-label">Sign-in &amp; protection</div>
        <Link href="/settings/security" className="ppm-list-item">{row(<Lock size={18} />, "Password, PIN, 2FA & Passkeys", "Protect how you sign in")}</Link>
        <Link href="/settings/sessions" className="ppm-list-item">{row(<MonitorSmartphone size={18} />, "Active sessions", "Where you are signed in")}</Link>
        <Link href="/forgot-password" className="ppm-list-item">{row(<Key size={18} />, "Account recovery")}</Link>
      </div>
      )}

      {tab === "privacy" && (
      <div className="ppm-card">
        <div className="ppm-section-label">Your data</div>
        {PRIVACY_TOGGLES.map((opt) => (
          <div key={opt.key} className="ppm-list-item" style={{ cursor: "default" }}>
            <div className="ppm-ic" aria-hidden="true"><EyeOff size={18} /></div>
            <div className="ppm-info"><div className="ppm-name">{opt.label}</div></div>
            <button type="button" className={`ppm-toggle${priv[opt.key] ? " on" : ""}`} role="switch" aria-checked={Boolean(priv[opt.key])} aria-label={opt.label} onClick={() => togglePriv(opt.key)} />
          </div>
        ))}
      </div>
      )}

      {tab === "data" && (
      <div className="ppm-card">
        <div className="ppm-section-label">Storage &amp; export</div>
        {isLocalOnly ? (
          <div className="ppm-list-item" style={{ cursor: "default" }}>
            <div className="ppm-ic" aria-hidden="true"><HardDrive size={18} /></div>
            <div className="ppm-info"><div className="ppm-name">This Device Only</div></div>
          </div>
        ) : !policy.drive ? (
          <div className="ppm-list-item" aria-disabled="true" style={{ opacity: 0.5, cursor: "not-allowed" }}>
            <div className="ppm-ic" aria-hidden="true"><Database size={18} /></div>
            <div className="ppm-info">
              <div className="ppm-name">Google Drive</div>
              <div className="ppm-meta">{DRIVE_DISABLED_TEXT}</div>
            </div>
          </div>
        ) : (
          <Link href="/settings/storage" className="ppm-list-item">
            <div className="ppm-ic" aria-hidden="true"><Database size={18} /></div>
            <div className="ppm-info">
              <div className="ppm-name">Google Drive</div>
              {driveStatus?.accountEmail && <div className="ppm-meta">{driveStatus.accountEmail}</div>}
            </div>
            {!driveStatusLoading && driveState && <span className={`ppm-status ${driveState.tone}`}>{driveState.label}</span>}
            <span className="ppm-chev" aria-hidden="true">›</span>
          </Link>
        )}
        <Link href="/settings/storage" className="ppm-list-item">{row(<SettingsIcon size={18} />, "Manage storage", "Disconnect, restore, switch mode, backup")}</Link>
        {!isDriveReady(driveStatus) && !isLocalOnly && policy.drive && (
          <Link href="/connect-drive" className="ppm-list-item">{row(<Link2 size={18} />, "Connect Google Drive")}</Link>
        )}
        <button type="button" className="ppm-list-item" onClick={() => setExportOpen(true)}>{row(<Download size={18} />, "Export data")}</button>
      </div>
      )}

      {tab === "account" && (<>
      <div className="ppm-card">
        <div className="ppm-section-label">Account &amp; help</div>
        <Link href="/profile" className="ppm-list-item">{row(<UserCircle size={18} />, "Profile", "Your personal information")}</Link>
        <Link href="/dashboard?tour=onboarding" className="ppm-list-item">{row(<Compass size={18} />, "Product Tour", "Replay the guided walkthrough")}</Link>
        <Link href="/manual" className="ppm-list-item">{row(<BookOpen size={18} />, "User Manual")}</Link>
        <Link href="/privacy-policy" className="ppm-list-item">{row(<ScrollText size={18} />, "Privacy Policy")}</Link>
        <Link href="/terms" className="ppm-list-item">{row(<FileText size={18} />, "Terms of Service")}</Link>
      </div>
      <div style={{ marginTop: 14 }}><DeleteAccountPanel /></div>
      </>)}

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

      <MobileSheet open={exportOpen} onClose={() => setExportOpen(false)} title="Export Data">
        <p style={{ fontSize: 12, color: "var(--ppm-text-dim)", marginBottom: 10 }}>Choose what to include, then download.</p>
        {EXPORT_TYPES.map((t) => (
          <label key={t.key} className="ppm-list-item" style={{ cursor: "pointer" }}>
            <div className="ppm-info"><div className="ppm-name" style={{ fontWeight: 500, fontSize: ".85rem" }}>{t.label}</div></div>
            <input type="checkbox" checked={exportTypes.includes(t.key)} onChange={() => toggleExportType(t.key)} style={{ width: 20, height: 20 }} />
          </label>
        ))}
        <div className="ppm-sheet-actions" style={{ flexWrap: "wrap" }}>
          <button type="button" className="ppm-sheet-submit" disabled={exporting || exportTypes.length === 0} onClick={() => runExport("csv")}>{exporting ? "Exporting…" : "CSV"}</button>
          <button type="button" className="ppm-sheet-submit" disabled={exporting || exportTypes.length === 0} onClick={() => runExport("json")}>{exporting ? "Exporting…" : "JSON"}</button>
          <button type="button" className="ppm-sheet-cancel" onClick={() => setExportOpen(false)} disabled={exporting}>Cancel</button>
        </div>
      </MobileSheet>
    </MobileShell>
  );
}
