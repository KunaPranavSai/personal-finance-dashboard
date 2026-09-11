"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Mail, Send, Eye, X, CheckCircle, AlertTriangle, Database, HardDrive, Clock } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatCard, StatCardSkeleton } from "@/components/admin/StatCard";
import { api } from "@/lib/api";

interface EmailTemplate {
  id: string;
  name: string;
  html: string;
}

interface AdminStats {
  systemHealth: { database: string; uptimeSeconds: number };
}

interface DriveStatus {
  configured: boolean;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export default function AdminSystemHealthPage() {
  const { toast } = useToast();
  const [preview, setPreview] = useState<EmailTemplate | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; emailSent: boolean } | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.get<AdminStats>("/api/admin/stats"),
  });
  const { data: driveStatus, isLoading: driveLoading } = useQuery({
    queryKey: ["drive-status-admin-view"],
    queryFn: () => api.get<DriveStatus>("/api/drive/status"),
  });
  const { data, isLoading } = useQuery({
    queryKey: ["admin-email-templates"],
    queryFn: () => api.get<{ items: EmailTemplate[] }>("/api/admin/email-templates"),
  });

  const sendTest = async (t: EmailTemplate) => {
    setSending(t.id);
    setResult(null);
    try {
      const res = await api.post<{ emailSent: boolean }>(`/api/admin/email-templates/${t.id}/test`);
      setResult({ id: t.id, emailSent: res.emailSent });
      toast(res.emailSent ? "Test email sent to your inbox" : "Email send failed or was skipped", res.emailSent ? "success" : "error");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to send test email", "error");
    } finally {
      setSending(null);
    }
  };

  const items = data?.items ?? [];

  return (
    <>
      <Topbar title="System Health" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <AdminPageHeader icon={Activity} title="System Health" description="Live platform status and transactional email delivery checks." />

        {statsLoading || driveLoading || !stats || !driveStatus ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="Database"
              value={stats.systemHealth.database === "ok" ? "Healthy" : "Issue"}
              icon={Database}
              tone={stats.systemHealth.database === "ok" ? "emerald" : "red"}
            />
            <StatCard
              label="Google Drive OAuth"
              value={driveStatus.configured ? "Configured" : "Not Configured"}
              icon={HardDrive}
              tone={driveStatus.configured ? "emerald" : "red"}
            />
            <StatCard label="Backend Uptime" value={formatUptime(stats.systemHealth.uptimeSeconds)} icon={Clock} />
          </div>
        )}

        <Card className="mt-6">
          <CardHeader><CardTitle>Email Delivery</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-navy/60 dark:text-white/60">
              Preview transactional templates and send yourself a test copy to confirm delivery is working.
            </p>
            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-xl2 bg-black/5 dark:bg-white/5" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((t, i) => (
                  <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: i * 0.05 }}>
                    <Card className="flex h-full flex-col transition-shadow hover:shadow-lg">
                      <CardContent className="flex flex-1 flex-col gap-3 pt-5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal/10 text-teal">
                          <Mail className="h-5 w-5" />
                        </div>
                        <p className="text-sm font-semibold text-navy dark:text-white">{t.name}</p>
                        <div className="mt-auto flex gap-2">
                          <Button type="button" size="sm" variant="secondary" onClick={() => setPreview(t)} className="flex-1">
                            <Eye className="h-3.5 w-3.5" /> Preview
                          </Button>
                          <Button type="button" size="sm" onClick={() => sendTest(t)} disabled={sending === t.id} className="flex-1">
                            <Send className="h-3.5 w-3.5" /> {sending === t.id ? "Sending…" : "Test"}
                          </Button>
                        </div>
                        {result?.id === t.id && (
                          <motion.p
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className={`flex items-center gap-1.5 text-xs ${result.emailSent ? "text-teal" : "text-amber-600 dark:text-amber-400"}`}
                          >
                            {result.emailSent ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                            {result.emailSent ? "Sent to your inbox" : "Not delivered — check RESEND_FROM_EMAIL"}
                          </motion.p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <AnimatePresence>
        {preview && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setPreview(null)}
          >
            <motion.div
              className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-navy-dark"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-black/5 p-4 dark:border-white/10">
                <p className="text-sm font-semibold text-navy dark:text-white">{preview.name}</p>
                <button onClick={() => setPreview(null)} className="rounded-lg p-1 text-navy/40 hover:bg-black/5 dark:text-white/40 dark:hover:bg-white/10">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <iframe title={preview.name} srcDoc={preview.html} sandbox="" className="min-h-[400px] flex-1 bg-white" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
