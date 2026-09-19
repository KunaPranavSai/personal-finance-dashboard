"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Settings as SettingsIcon, Save, Info, Download, CheckCircle, Database } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { api, API_BASE_URL } from "@/lib/api";

interface PlatformSettings {
  siteName: string;
  supportEmail: string | null;
  defaultSessionTimeoutMinutes: number;
  minPasswordLength: number;
  require2FAForAdmins: boolean;
}

const inputCls = "cc-mono w-full rounded border bg-transparent px-3 py-2 text-sm";
const inputStyle = { borderColor: "var(--cc-border)", color: "var(--cc-text)" };
const sectionLabelCls = "cc-mono mb-3 text-[10px] font-semibold uppercase tracking-widest";
const fieldLabelCls = "mb-1 block text-[10px] font-medium uppercase tracking-wider";

export default function AdminSystemSettingsPage() {
  const { toast } = useToast();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: () => api.get<PlatformSettings>("/api/admin/platform-settings"),
  });

  const [form, setForm] = useState<PlatformSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [justDownloaded, setJustDownloaded] = useState(false);

  const handleDownloadBackup = useCallback(async () => {
    setDownloading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/backup`, { credentials: "include" });
      if (!res.ok) throw new Error("Backup failed");
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?(.+?)"?$/);
      const filename = match ? match[1] : `pennypilot-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setJustDownloaded(true);
      toast("Account backup downloaded", "success");
      setTimeout(() => setJustDownloaded(false), 3000);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Backup failed", "error");
    } finally {
      setDownloading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const handleSave = useCallback(async () => {
    if (!form) return;
    setSaving(true);
    try {
      await api.patch("/api/admin/platform-settings", form);
      toast("Platform settings saved", "success");
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  }, [form, toast, refetch]);

  return (
    <>
      <Topbar title="System Settings" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <AdminPageHeader icon={SettingsIcon} title="System Settings" description="Platform-wide configuration (Super Admin only)." />

        {isLoading || !form ? (
          <div className="space-y-4">
            <div className="cc-panel h-40 animate-pulse" />
            <div className="cc-panel h-52 animate-pulse" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="cc-panel p-4">
              <p className={sectionLabelCls} style={{ color: "var(--cc-text-faint)" }}>Site Identity</p>
              <div className="space-y-4">
                <div>
                  <label className={fieldLabelCls} style={{ color: "var(--cc-text-faint)" }}>Site Name</label>
                  <input value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={fieldLabelCls} style={{ color: "var(--cc-text-faint)" }}>Support Email</label>
                  <input type="email" value={form.supportEmail ?? ""} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} placeholder="support@yourdomain.com" className={inputCls} style={inputStyle} />
                </div>
                <div className="flex items-start gap-2 rounded p-3 text-xs" style={{ background: "var(--cc-panel-alt)", color: "var(--cc-text-faint)" }}>
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Stored for future use — not yet wired into outgoing email templates or branding.
                </div>
              </div>
            </div>

            <div className="cc-panel p-4">
              <p className={sectionLabelCls} style={{ color: "var(--cc-text-faint)" }}>Security Policy</p>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={fieldLabelCls} style={{ color: "var(--cc-text-faint)" }}>Default Session Timeout (minutes)</label>
                    <input type="number" min={1} value={form.defaultSessionTimeoutMinutes} onChange={(e) => setForm({ ...form, defaultSessionTimeoutMinutes: Number(e.target.value) })} className={inputCls} style={inputStyle} />
                  </div>
                  <div>
                    <label className={fieldLabelCls} style={{ color: "var(--cc-text-faint)" }}>Minimum Password Length</label>
                    <input type="number" min={6} max={64} value={form.minPasswordLength} onChange={(e) => setForm({ ...form, minPasswordLength: Number(e.target.value) })} className={inputCls} style={inputStyle} />
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.require2FAForAdmins} onChange={(e) => setForm({ ...form, require2FAForAdmins: e.target.checked })} className="h-4 w-4 rounded" />
                  <span className="text-sm" style={{ color: "var(--cc-text)" }}>Require Two-Factor Authentication for Admins</span>
                </label>
                <div className="flex items-start gap-2 rounded p-3 text-xs" style={{ background: "rgba(251,191,36,0.08)", color: "var(--cc-amber)" }}>
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Saved here, but not yet enforced by login or password-change flows — enforcement wiring is a follow-up.
                </div>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Settings"}
            </Button>

            <div className="cc-panel p-4">
              <p className={sectionLabelCls} style={{ color: "var(--cc-text-faint)" }}>Account Backup</p>
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--cc-text)" }}>Download Account Backup</p>
                  <p className="mt-1 text-sm" style={{ color: "var(--cc-text-dim)" }}>
                    Every account&apos;s role, status, and timestamps — as JSON.
                  </p>
                </div>
                <Button onClick={handleDownloadBackup} disabled={downloading} className="min-h-[44px]">
                  {justDownloaded ? <CheckCircle className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                  {downloading ? "Preparing…" : justDownloaded ? "Downloaded" : "Download Backup"}
                </Button>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded p-3 text-xs" style={{ background: "var(--cc-panel-alt)", color: "var(--cc-text-faint)" }}>
                <Database className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Never includes financial data (transactions, budgets, investments, bills, goals, categories,
                accounts) — that lives solely in each user&apos;s own Google Drive, which the platform has no
                access to. Only account metadata (role, status, timestamps) is included. Restore-from-file is
                intentionally not available.
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
