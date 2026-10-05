"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, ErrorState, PageHeader, Panel, Skeleton, Switch, TextField } from "@/components/admin/ui";
import { useToast } from "@/components/ui/Toast";
import { api, API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

interface Settings {
  siteName: string; supportEmail: string | null; defaultSessionTimeoutMinutes: number; minPasswordLength: number; require2FAForAdmins: boolean;
  appUrl: string | null; emailFromName: string | null; emailFromAddress: string | null; superAdminEmail: string | null; apiRateLimit: number;
}

export default function AdminSystemSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isSuper = user?.role === "SUPER_ADMIN";
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["admin", "platform-settings"], queryFn: () => api.get<Settings>("/api/admin/platform-settings") });
  const [form, setForm] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  useEffect(() => { if (data) setForm(data); }, [data]);
  const dirty = Boolean(form && data && JSON.stringify(form) !== JSON.stringify(data));

  if (isError) return <><PageHeader title="System Settings" /><ErrorState onRetry={() => void refetch()} /></>;
  if (isLoading || !form) return <><PageHeader title="System Settings" /><Skeleton h={300} /></>;
  const set = (patch: Partial<Settings>) => setForm({ ...form, ...patch });
  const text = (k: keyof Settings) => (form[k] as string | null) ?? "";

  const save = async () => {
    setSaving(true);
    try { await api.patch("/api/admin/platform-settings", form); toast("Settings saved", "success"); await queryClient.invalidateQueries({ queryKey: ["admin", "platform-settings"] }); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't save the settings", "error"); } finally { setSaving(false); }
  };
  const backup = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/backup`, { credentials: "include" });
      if (!res.ok) throw new Error("The backup could not be created");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = /filename="?(.+?)"?$/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? `pennypilot-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(a.href);
      toast("Backup downloaded", "success");
    } catch (e) { toast(e instanceof Error ? e.message : "Backup failed", "error"); } finally { setDownloading(false); }
  };

  return (
    <>
      <PageHeader title="System Settings" description="Values used across the whole product: emails, links, sign-in rules and limits. Changes apply within a minute."
        actions={isSuper ? <Button variant="primary" loading={saving} disabled={!dirty} onClick={() => void save()}>Save changes</Button> : undefined} />
      {!isSuper && <div className="mb-4"><Alert tone="warn">You can view these settings. Only a Super Admin can change them.</Alert></div>}
      <fieldset disabled={!isSuper} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        <div className="grid gap-4" style={{ maxWidth: 760 }}>
          <Panel title="Site identity and links"><div className="grid gap-4">
            <TextField label="Site name" value={form.siteName} onChange={(e) => set({ siteName: e.target.value })} hint="Shown in the header, subject lines and text of every email." />
            <TextField label="App URL" type="url" value={text("appUrl")} onChange={(e) => set({ appUrl: e.target.value })} placeholder="https://app.yourdomain.com" hint="Where buttons and links in emails point, and where the logo is loaded from. Sign-in, passkey and Google Drive security origins still come from the server's APP_URL setting." />
            <TextField label="Support email" type="email" value={text("supportEmail")} onChange={(e) => set({ supportEmail: e.target.value })} placeholder="support@yourdomain.com" hint="Shown in the footer of every email as the place to get help." />
          </div></Panel>

          <Panel title="Email sending"><div className="grid gap-4">
            <TextField label="Sender name" value={text("emailFromName")} onChange={(e) => set({ emailFromName: e.target.value })} hint="The name people see as the sender. Empty uses the site name." />
            <TextField label="Sender email" type="email" value={text("emailFromAddress")} onChange={(e) => set({ emailFromAddress: e.target.value })} placeholder="noreply@yourdomain.com" hint="Must be on a domain verified in Resend, or emails will not arrive. Empty uses the server default." />
            <TextField label="Super-admin alert email" type="email" value={text("superAdminEmail")} onChange={(e) => set({ superAdminEmail: e.target.value })} hint="Receives security alerts about admin accounts." />
            <Alert>The Resend API key is a secret, so it stays in the server environment and is not entered here.</Alert>
          </div></Panel>

          <Panel title="Security and limits"><div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label="Default session timeout (minutes)" type="number" min={1} max={10080} value={form.defaultSessionTimeoutMinutes} onChange={(e) => set({ defaultSessionTimeoutMinutes: Number(e.target.value) })} hint="For people who haven't chosen their own." />
              <TextField label="Minimum password length" type="number" min={6} max={64} value={form.minPasswordLength} onChange={(e) => set({ minPasswordLength: Number(e.target.value) })} hint="Applies to every new password." />
              <TextField label="API requests per 15 min per IP" type="number" min={30} max={100000} value={form.apiRateLimit} onChange={(e) => set({ apiRateLimit: Number(e.target.value) })} hint="Raise it if busy networks see “Too many requests”." />
            </div>
            <div className="ad-row" style={{ border: 0, padding: 0 }}>
              <div className="flex-1"><strong>Require two-factor for admins</strong><div className="ad-hint">Saved, but not enforced at sign-in yet.</div></div>
              <Switch label="Require two-factor for admins" checked={form.require2FAForAdmins} onChange={(v) => set({ require2FAForAdmins: v })} />
            </div>
          </div></Panel>
        </div>
      </fieldset>

      {isSuper && (
        <div className="mt-4" style={{ maxWidth: 760 }}>
          <Panel title="Account backup"><p className="ad-muted mt-0">Downloads a JSON file with the platform&apos;s account records. It contains personal details, so store it securely. It never includes anyone&apos;s Google Drive data.</p>
            <Button loading={downloading} onClick={() => void backup()}>Download backup</Button></Panel>
        </div>
      )}
    </>
  );
}
