"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useSettingsContext } from "@/lib/SettingsContext";
import { useToast } from "@/components/ui/Toast";
import { Settings as SettingsIcon, Palette, Globe, Bell, Shield, Download, Database, Eye, Sliders, Save } from "lucide-react";
import { cn } from "@/lib/format";
import { CURRENCIES, DATE_FORMATS, WEEK_START_OPTIONS, LANGUAGES, TIMEZONES } from "@/lib/reference";

const TABS = [
  { id: "general", label: "General", icon: SettingsIcon },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "currency", label: "Currency & Format", icon: Globe },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "export", label: "Data Export", icon: Download },
  { id: "backup", label: "Backup", icon: Database },
  { id: "privacy", label: "Privacy", icon: Eye },
  { id: "preferences", label: "Preferences", icon: Sliders },
];

const DEFAULT_DASHBOARDS = [
  { value: "dashboard", label: "Main Dashboard" },
  { value: "transactions", label: "Transactions" },
  { value: "analytics", label: "Analytics" },
];

const STARTUP_OPTIONS = [
  { value: "last-viewed", label: "Last Viewed Page" },
  { value: "dashboard", label: "Dashboard" },
  { value: "transactions", label: "Transactions" },
];

const NUMBER_FORMATS = [
  { value: "1,234.56", label: "1,234.56" },
  { value: "1.234,56", label: "1.234,56" },
  { value: "1 234,56", label: "1 234,56" },
];

const REMINDER_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const FIRST_DAY_OPTIONS = [
  { value: "monday", label: "Monday" },
  { value: "sunday", label: "Sunday" },
  { value: "saturday", label: "Saturday" },
];

const AUTO_LOCK_OPTIONS = [
  { value: "5", label: "5 minutes" },
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "never", label: "Never" },
];

async function downloadExport(format: string, toast: any) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/export?format=${format === "excel" ? "xlsx" : format}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Export failed" }));
      throw new Error(err.error || `Export failed (${res.status})`);
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?(.+?)"?$/);
    const ext = format === "excel" ? "xlsx" : format;
    const filename = match ? match[1] : `finance-export-${new Date().toISOString().split("T")[0]}.${ext}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(`${format.toUpperCase()} downloaded successfully`, "success");
  } catch (err) {
    toast(err instanceof Error ? err.message : "Download failed", "error");
  }
}

function ExportTab() {
  const { toast } = useToast();
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = useCallback(async (format: string) => {
    setExporting(format);
    await downloadExport(format, toast);
    setExporting(null);
  }, [toast]);

  const formats = [
    { id: "csv", label: "CSV" },
    { id: "excel", label: "Excel" },
    { id: "json", label: "JSON" },
    { id: "pdf", label: "PDF" },
  ];

  return (
    <Card>
      <CardHeader><CardTitle>Data Export</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-navy/60 dark:text-white/60">
          Export your financial data in various formats.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {formats.map((fmt) => (
            <button
              key={fmt.id}
              onClick={() => handleExport(fmt.id)}
              disabled={exporting !== null}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-5 text-sm font-medium transition-all",
                exporting === fmt.id
                  ? "border-teal bg-teal/10 text-teal animate-pulse"
                  : exporting !== null
                  ? "border-black/5 bg-black/2 text-navy/30 dark:border-white/5 dark:bg-white/2 dark:text-white/30 cursor-not-allowed"
                  : "border-black/10 text-navy hover:border-teal/50 hover:bg-teal/5 dark:border-white/10 dark:text-white dark:hover:border-teal/50"
              )}
            >
              {exporting === fmt.id ? (
                <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <Download className="h-6 w-6" />
              )}
              <span>{fmt.label}</span>
            </button>
          ))}
        </div>
        <div className="rounded-lg border border-black/5 bg-black/2 p-3 dark:border-white/5 dark:bg-white/2">
          <p className="text-xs text-navy/40 dark:text-white/40">
            Exports include transactions, budgets, investments, bills, goals, accounts, and categories.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const { settings, updateSettings, isLoading, isSaving } = useSettingsContext();
  const { toast } = useToast();
  const { changePassword } = useAuth();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") ?? "general");
  const [localSettings, setLocalSettings] = useState<Record<string, unknown>>({});
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwChanging, setPwChanging] = useState(false);

  const handlePasswordChange = useCallback(async () => {
    setPwError("");
    if (pwForm.next !== pwForm.confirm) { setPwError("New passwords do not match"); return; }
    if (pwForm.next.length < 8) { setPwError("Password must be at least 8 characters"); return; }
    setPwChanging(true);
    try {
      await changePassword(pwForm.current, pwForm.next);
      setPwForm({ current: "", next: "", confirm: "" });
      toast("Password changed successfully", "success");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Password change failed");
    } finally {
      setPwChanging(false);
    }
  }, [pwForm, changePassword, toast]);

  const handleBackup = useCallback(async () => {
    setIsBackingUp(true);
    await downloadExport("json", toast);
    setIsBackingUp(false);
  }, [toast]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  useEffect(() => {
    setLocalSettings(settings as unknown as Record<string, unknown>);
  }, [settings]);

  const handleChange = useCallback((key: string, value: unknown) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleNestedChange = useCallback((section: string, key: string, value: unknown) => {
    setLocalSettings((prev) => ({
      ...prev,
      [section]: { ...((prev[section] as Record<string, unknown>) ?? {}), [key]: value },
    }));
  }, []);

  const handleSave = useCallback(() => {
    updateSettings(localSettings);
    toast("Settings saved successfully", "success");
  }, [localSettings, updateSettings, toast]);

  const s = localSettings as Record<string, unknown>;
  const notifs = (s.notifications as Record<string, unknown>) ?? {};
  const sec = (s.security as Record<string, unknown>) ?? {};
  const exp = (s.export as Record<string, unknown>) ?? {};
  const backup = (s.backup as Record<string, unknown>) ?? {};
  const priv = (s.privacy as Record<string, unknown>) ?? {};
  const pref = (s.preferences as Record<string, unknown>) ?? {};

  const renderTab = () => {
    switch (activeTab) {
      case "general":
        return (
          <Card>
            <CardHeader><CardTitle>General Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Application Name</label>
                <input type="text" value={String(s.applicationName ?? "")} onChange={(e) => handleChange("applicationName", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Default Dashboard</label>
                  <select value={String(s.defaultDashboard ?? "dashboard")} onChange={(e) => handleChange("defaultDashboard", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10">
                    {DEFAULT_DASHBOARDS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Startup Preference</label>
                  <select value={String(s.startupPreferences ?? "last-viewed")} onChange={(e) => handleChange("startupPreferences", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10">
                    {STARTUP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Date Format</label>
                  <select value={String(s.dateFormat ?? "DD-MM-YYYY")} onChange={(e) => handleChange("dateFormat", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10">
                    {DATE_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Time Format</label>
                  <select value={String(s.timeFormat ?? "24h")} onChange={(e) => handleChange("timeFormat", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10">
                    <option value="24h">24-Hour</option>
                    <option value="12h">12-Hour (AM/PM)</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Timezone</label>
                  <select value={String(s.timezone ?? "Asia/Kolkata")} onChange={(e) => handleChange("timezone", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10">
                    {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">First Day of Week</label>
                  <select value={String(s.firstDayOfWeek ?? "monday")} onChange={(e) => handleChange("firstDayOfWeek", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10">
                    {FIRST_DAY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Language</label>
                  <select value={String(s.language ?? "en")} onChange={(e) => handleChange("language", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10">
                    {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="pt-2">
                <Button onClick={handleSave} disabled={isSaving}><Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Settings"}</Button>
              </div>
            </CardContent>
          </Card>
        );
      case "appearance":
        return (
          <Card>
            <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Theme</label>
                <div className="grid grid-cols-3 gap-3">
                  {["light", "dark", "system"].map((t) => (
                    <button key={t} onClick={() => handleChange("theme", t)}
                      className={cn("flex items-center justify-center rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
                        s.theme === t ? "border-teal bg-teal/10 text-teal" : "border-black/10 text-navy/60 hover:bg-black/5 dark:border-white/10 dark:text-white/60"
                      )}>
                      {t === "light" ? "☀️ Light" : t === "dark" ? "🌙 Dark" : "💻 System"}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-navy/40 dark:text-white/40">Changes apply instantly. No refresh needed.</p>
              </div>
              <div className="pt-2">
                <Button onClick={handleSave} disabled={isSaving}><Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Settings"}</Button>
              </div>
            </CardContent>
          </Card>
        );
      case "currency":
        return (
          <Card>
            <CardHeader><CardTitle>Currency & Region</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Currency</label>
                  <select value={String(s.currency ?? "INR")} onChange={(e) => { handleChange("currency", e.target.value); handleChange("currencySymbol", e.target.value); }} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10">
                    {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-navy/40 dark:text-white/40">All monetary values update instantly across the app.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Currency Symbol</label>
                  <input type="text" value={String(s.currencySymbol ?? s.currency ?? "INR")} onChange={(e) => handleChange("currencySymbol", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Number Format</label>
                  <select value={String(s.numberFormat ?? "1,234.56")} onChange={(e) => handleChange("numberFormat", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10">
                    {NUMBER_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">First Day of Week</label>
                  <select value={String(s.firstDayOfWeek ?? "monday")} onChange={(e) => handleChange("firstDayOfWeek", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10">
                    {FIRST_DAY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Timezone</label>
                  <select value={String(s.timezone ?? "Asia/Kolkata")} onChange={(e) => handleChange("timezone", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10">
                    {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Date Format</label>
                  <select value={String(s.dateFormat ?? "DD-MM-YYYY")} onChange={(e) => handleChange("dateFormat", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10">
                    {DATE_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Time Format</label>
                  <select value={String(s.timeFormat ?? "24h")} onChange={(e) => handleChange("timeFormat", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10">
                    <option value="24h">24-Hour</option>
                    <option value="12h">12-Hour (AM/PM)</option>
                  </select>
                </div>
              </div>
              <div className="pt-2">
                <Button onClick={handleSave} disabled={isSaving}><Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Settings"}</Button>
              </div>
            </CardContent>
          </Card>
        );
      case "notifications":
        return (
          <Card>
            <CardHeader><CardTitle>Notification Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {[
                  { key: "email", label: "Email Notifications" },
                  { key: "push", label: "Push / Browser Notifications" },
                ].map((opt) => (
                  <label key={opt.key} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={Boolean(notifs[opt.key] ?? false)} onChange={(e) => handleNestedChange("notifications", opt.key, e.target.checked)} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
                    <span className="text-sm text-navy dark:text-white">{opt.label}</span>
                  </label>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Reminder Frequency</label>
                <select value={String(notifs.reminderFrequency ?? "daily")} onChange={(e) => handleNestedChange("notifications", "reminderFrequency", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10">
                  {REMINDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-3 pt-2 border-t border-black/5 dark:border-white/10">
                <p className="text-xs font-medium text-navy/50 dark:text-white/50">Alert Preferences</p>
                {[
                  { key: "budgetAlerts", label: "Budget Alerts" },
                  { key: "goalUpdates", label: "Goal Progress Alerts" },
                  { key: "billReminders", label: "Bill Reminders" },
                  { key: "insights", label: "Insights & Tips" },
                ].map((opt) => (
                  <label key={opt.key} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={Boolean(notifs[opt.key] ?? false)} onChange={(e) => handleNestedChange("notifications", opt.key, e.target.checked)} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
                    <span className="text-sm text-navy dark:text-white">{opt.label}</span>
                  </label>
                ))}
              </div>
              <div className="pt-2">
                <Button onClick={handleSave} disabled={isSaving}><Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Settings"}</Button>
              </div>
            </CardContent>
          </Card>
        );
      case "security":
        return (
          <Card>
            <CardHeader><CardTitle>Security Settings</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {/* Change Password */}
              <div className="rounded-lg border border-black/5 p-4 space-y-3 dark:border-white/10">
                <p className="text-sm font-semibold text-navy dark:text-white">Change Password</p>
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Current Password</label>
                  <input type="password" value={pwForm.current} onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" placeholder="Current password" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">New Password</label>
                  <input type="password" value={pwForm.next} onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" placeholder="New password (min 8 chars)" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Confirm New Password</label>
                  <input type="password" value={pwForm.confirm} onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" placeholder="Confirm new password" />
                </div>
                {pwError && <p className="text-xs text-red-500">{pwError}</p>}
                <Button type="button" size="sm" onClick={handlePasswordChange} disabled={pwChanging || !pwForm.current || !pwForm.next || !pwForm.confirm}>{pwChanging ? "Changing…" : "Change Password"}</Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-navy dark:text-white">Two-Factor Authentication</p>
                  <p className="text-xs text-navy/50">Add an extra layer of security</p>
                </div>
                <input type="checkbox" checked={Boolean(sec.twoFactorEnabled ?? false)} onChange={(e) => handleNestedChange("security", "twoFactorEnabled", e.target.checked)} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Session Timeout (minutes)</label>
                <input type="number" value={Number(sec.sessionTimeout ?? 30)} onChange={(e) => handleNestedChange("security", "sessionTimeout", Number(e.target.value))} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" min={1} />
              </div>
              <div>
                <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Auto Lock</label>
                <select value={String(sec.autoLock ?? "15")} onChange={(e) => handleNestedChange("security", "autoLock", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10">
                  {AUTO_LOCK_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="pt-2">
                <Button onClick={handleSave} disabled={isSaving}><Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Settings"}</Button>
              </div>
            </CardContent>
          </Card>
        );

      case "export":
        return (
          <ExportTab />
        );
      case "backup":
        return (
          <Card>
            <CardHeader><CardTitle>Backup Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={Boolean(backup.autoBackup ?? false)} onChange={(e) => handleNestedChange("backup", "autoBackup", e.target.checked)} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
                <span className="text-sm text-navy dark:text-white">Automatic Backup</span>
              </label>
              <div>
                <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Backup Frequency</label>
                <select value={String(backup.backupFrequency ?? "weekly")} onChange={(e) => handleNestedChange("backup", "backupFrequency", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="pt-2 flex flex-wrap gap-2">
                <Button onClick={handleSave} disabled={isSaving}><Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Settings"}</Button>
                <Button type="button" variant="secondary" onClick={handleBackup} disabled={isBackingUp}>{isBackingUp ? "Backing up..." : "Backup Now"}</Button>
              </div>
            </CardContent>
          </Card>
        );
      case "privacy":
        return (
          <Card>
            <CardHeader><CardTitle>Privacy Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={Boolean(priv.shareAnonymousData ?? true)} onChange={(e) => handleNestedChange("privacy", "shareAnonymousData", e.target.checked)} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
                <span className="text-sm text-navy dark:text-white">Share anonymous usage data to improve the app</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={Boolean(priv.analytics ?? true)} onChange={(e) => handleNestedChange("privacy", "analytics", e.target.checked)} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
                <span className="text-sm text-navy dark:text-white">Analytics</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={Boolean(priv.crashReporting ?? true)} onChange={(e) => handleNestedChange("privacy", "crashReporting", e.target.checked)} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
                <span className="text-sm text-navy dark:text-white">Crash Reporting</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={Boolean(priv.tracking ?? true)} onChange={(e) => handleNestedChange("privacy", "tracking", e.target.checked)} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
                <span className="text-sm text-navy dark:text-white">Tracking</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={Boolean(priv.showInSuggestions ?? false)} onChange={(e) => handleNestedChange("privacy", "showInSuggestions", e.target.checked)} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
                <span className="text-sm text-navy dark:text-white">Show my profile in community suggestions</span>
              </label>
              <div className="pt-2">
                <Button onClick={handleSave} disabled={isSaving}><Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Settings"}</Button>
              </div>
            </CardContent>
          </Card>
        );
      case "preferences":
        return (
          <Card>
            <CardHeader><CardTitle>Application Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Default Dashboard</label>
                <select value={String(pref.defaultCharts ?? "income-expense")} onChange={(e) => handleNestedChange("preferences", "defaultCharts", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10">
                  <option value="income-expense">Income vs Expense</option>
                  <option value="category-breakdown">Category Breakdown</option>
                  <option value="net-worth">Net Worth</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Default Filters</label>
                <select value={String(pref.defaultFilters ?? "all")} onChange={(e) => handleNestedChange("preferences", "defaultFilters", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10">
                  <option value="all">All Transactions</option>
                  <option value="income">Income Only</option>
                  <option value="expense">Expense Only</option>
                  <option value="recurring">Recurring Only</option>
                </select>
              </div>
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={Boolean(pref.compactMode ?? false)} onChange={(e) => handleNestedChange("preferences", "compactMode", e.target.checked)} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
                  <span className="text-sm text-navy dark:text-white">Compact mode (smaller spacing)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={Boolean(pref.showTips ?? true)} onChange={(e) => handleNestedChange("preferences", "showTips", e.target.checked)} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
                  <span className="text-sm text-navy dark:text-white">Show tips and suggestions</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={Boolean(pref.confirmBeforeDelete ?? true)} onChange={(e) => handleNestedChange("preferences", "confirmBeforeDelete", e.target.checked)} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
                  <span className="text-sm text-navy dark:text-white">Confirm before deleting items</span>
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Default Transaction Type</label>
                <select value={String(pref.defaultTransactionType ?? "EXPENSE")} onChange={(e) => handleNestedChange("preferences", "defaultTransactionType", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10">
                  <option value="EXPENSE">Expense</option>
                  <option value="INCOME">Income</option>
                </select>
              </div>
              <div className="pt-2">
                <Button onClick={handleSave} disabled={isSaving}><Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Settings"}</Button>
              </div>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Topbar title="Settings" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto max-w-4xl">
          {isLoading ? (
            <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl2 bg-black/5 dark:bg-white/5" />)}</div>
          ) : (
            <div className="flex flex-col gap-6 lg:flex-row">
              <nav className="shrink-0 overflow-x-auto lg:w-48" aria-label="Settings tabs">
                <div className="flex gap-1 lg:flex-col">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                        activeTab === tab.id
                          ? "bg-teal/10 text-teal"
                          : "text-navy/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/5"
                      )}
                    >
                      <tab.icon className="h-4 w-4" /> {tab.label}
                    </button>
                  ))}
                </div>
              </nav>
              <div className="flex-1">{renderTab()}</div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <><Topbar title="Settings" /><main className="flex-1 overflow-y-auto p-4 lg:p-6"><div className="mx-auto max-w-4xl"><div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl2 bg-black/5 dark:bg-white/5" />)}</div></div></main></>
    }>
      <SettingsContent />
    </Suspense>
  );
}
