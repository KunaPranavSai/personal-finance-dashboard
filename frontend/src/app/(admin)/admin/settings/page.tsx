"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Settings as SettingsIcon, Save, Info } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { api } from "@/lib/api";

interface PlatformSettings {
  siteName: string;
  supportEmail: string | null;
  defaultSessionTimeoutMinutes: number;
  minPasswordLength: number;
  require2FAForAdmins: boolean;
}

const inputCls = "w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10";

export default function AdminSystemSettingsPage() {
  const { toast } = useToast();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: () => api.get<PlatformSettings>("/api/admin/platform-settings"),
  });

  const [form, setForm] = useState<PlatformSettings | null>(null);
  const [saving, setSaving] = useState(false);

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
            <div className="h-40 animate-pulse rounded-xl2 bg-black/5 dark:bg-white/5" />
            <div className="h-52 animate-pulse rounded-xl2 bg-black/5 dark:bg-white/5" />
          </div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Site Identity</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-navy/50 dark:text-white/50">Site Name</label>
                  <input value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-navy/50 dark:text-white/50">Support Email</label>
                  <input type="email" value={form.supportEmail ?? ""} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} placeholder="support@yourdomain.com" className={inputCls} />
                </div>
                <div className="flex items-start gap-2 rounded-lg bg-black/5 p-3 text-xs text-navy/50 dark:bg-white/5 dark:text-white/50">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Stored for future use — not yet wired into outgoing email templates or branding.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Security Policy</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-navy/50 dark:text-white/50">Default Session Timeout (minutes)</label>
                    <input type="number" min={1} value={form.defaultSessionTimeoutMinutes} onChange={(e) => setForm({ ...form, defaultSessionTimeoutMinutes: Number(e.target.value) })} className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-navy/50 dark:text-white/50">Minimum Password Length</label>
                    <input type="number" min={6} max={64} value={form.minPasswordLength} onChange={(e) => setForm({ ...form, minPasswordLength: Number(e.target.value) })} className={inputCls} />
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.require2FAForAdmins} onChange={(e) => setForm({ ...form, require2FAForAdmins: e.target.checked })} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
                  <span className="text-sm text-navy dark:text-white">Require Two-Factor Authentication for Admins</span>
                </label>
                <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Saved here, but not yet enforced by login or password-change flows — enforcement wiring is a follow-up.
                </div>
              </CardContent>
            </Card>

            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Settings"}
            </Button>
          </div>
        )}
      </main>
    </>
  );
}
