"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send, Search, X, Plus, Eye, Info, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminActionConfirm } from "@/components/admin/AdminActionConfirm";
import { ManagedUser } from "@/components/admin/UserManagementShared";
import { api } from "@/lib/api";

interface EmailTemplateItem {
  id: string;
  name: string;
  html: string;
  enabled: boolean;
}

interface SendResult {
  to: string;
  success: boolean;
  skipped: boolean;
  reason?: string;
}

const MAX_RECIPIENTS = 20;

type Recipient = { type: "user"; userId: string; label: string } | { type: "email"; address: string };

/**
 * Communication → Send Email — a separate, manual-trigger action. Never writes to Announcement
 * or EmailAutomationConfig; those remain their own distinct systems. Reuses the Users list's
 * search pattern for recipient selection, the Email Templates registry (already override/
 * renderer-aware server-side) for template content, and AdminActionConfirm for the same
 * confirm-before-send pattern used everywhere else in the Command Center.
 */
export default function AdminEmailComposerPage() {
  const { toast } = useToast();
  const [userQuery, setUserQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<{ id: string; label: string }[]>([]);
  const [manualEmails, setManualEmails] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState("");
  const [mode, setMode] = useState<"template" | "custom">("template");
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [customHtml, setCustomHtml] = useState("");
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [confirming, setConfirming] = useState(false);

  const { data: usersData } = useQuery({
    queryKey: ["users-all", "email-composer"],
    queryFn: () => api.get<{ items: ManagedUser[] }>("/api/auth/users"),
  });
  const { data: templatesData } = useQuery({
    queryKey: ["admin-email-templates", "composer"],
    queryFn: () => api.get<{ items: EmailTemplateItem[] }>("/api/admin/email-templates"),
  });

  const userMatches = useMemo(() => {
    if (!userQuery.trim()) return [];
    const q = userQuery.trim().toLowerCase();
    return (usersData?.items ?? [])
      .filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .filter((u) => !selectedUsers.some((s) => s.id === u.id))
      .slice(0, 8);
  }, [usersData, userQuery, selectedUsers]);

  const recipients: Recipient[] = [
    ...selectedUsers.map((u) => ({ type: "user" as const, userId: u.id, label: u.label })),
    ...manualEmails.map((e) => ({ type: "email" as const, address: e })),
  ];
  const totalRecipients = recipients.length;

  const selectedTemplate = templatesData?.items.find((t) => t.id === templateId);
  const previewHtml = mode === "template" ? (selectedTemplate?.html ?? "") : customHtml;
  const contentSnippet = previewHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);

  const addManualEmail = () => {
    const value = manualInput.trim();
    if (!value) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast("Not a valid email address", "error");
      return;
    }
    if (totalRecipients >= MAX_RECIPIENTS) {
      toast(`Capped at ${MAX_RECIPIENTS} recipients`, "error");
      return;
    }
    setManualEmails((list) => [...list, value]);
    setManualInput("");
  };

  const canSend = totalRecipients > 0 && subject.trim() && (mode === "template" ? Boolean(templateId) : customHtml.trim().length > 0);

  const buildPayload = (isTest: boolean) => ({
    isTest,
    subject: subject.trim(),
    templateKey: mode === "template" ? templateId : undefined,
    customHtml: mode === "custom" ? customHtml : undefined,
    recipients: isTest
      ? []
      : recipients.map((r) => (r.type === "user" ? { type: "user", userId: r.userId } : { type: "email", address: r.address })),
  });

  const sendTest = async () => {
    setTesting(true);
    setResults(null);
    try {
      const res = await api.post<{ results: SendResult[] }>("/api/admin/email/send", buildPayload(true));
      setResults(res.results);
      toast(res.results[0]?.success ? "Test email sent to your inbox" : "Test send failed", res.results[0]?.success ? "success" : "error");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to send test", "error");
    } finally {
      setTesting(false);
    }
  };

  const sendProduction = async () => {
    setSending(true);
    try {
      const res = await api.post<{ results: SendResult[]; successCount: number; totalCount: number }>("/api/admin/email/send", buildPayload(false));
      setResults(res.results);
      return { message: `Sent to ${res.successCount} of ${res.totalCount} recipient(s)` };
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Topbar title="Send Email" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <AdminPageHeader icon={Send} title="Send Email" description="Hand-authored, manual sends only — this never writes to Announcements or Automated Email rules." />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="cc-panel p-4">
              <p className="cc-mono mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cc-text-faint)" }}>Recipients ({totalRecipients}/{MAX_RECIPIENTS})</p>

              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "var(--cc-text-faint)" }} />
                <input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Search users by name or email"
                  className="cc-mono w-full rounded border bg-transparent py-2 pl-8 pr-2 text-sm"
                  style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }}
                />
              </div>
              {userMatches.length > 0 && (
                <div className="mt-1 cc-panel-alt max-h-40 overflow-y-auto p-1">
                  {userMatches.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        if (totalRecipients >= MAX_RECIPIENTS) { toast(`Capped at ${MAX_RECIPIENTS} recipients`, "error"); return; }
                        setSelectedUsers((list) => [...list, { id: u.id, label: `${u.name} (${u.email})` }]);
                        setUserQuery("");
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-white/5"
                      style={{ color: "var(--cc-text-dim)" }}
                    >
                      {u.name} <span style={{ color: "var(--cc-text-faint)" }}>({u.email})</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-2 flex gap-2">
                <input
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addManualEmail(); } }}
                  placeholder="or type a raw email address"
                  className="cc-mono flex-1 rounded border bg-transparent px-3 py-2 text-sm"
                  style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }}
                />
                <button onClick={addManualEmail} className="flex items-center gap-1 rounded border px-3 py-2 text-xs" style={{ borderColor: "var(--cc-border)", color: "var(--cc-text-dim)" }}>
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>

              {totalRecipients > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedUsers.map((u) => (
                    <span key={u.id} className="cc-mono flex items-center gap-1 rounded-full px-2 py-1 text-[11px]" style={{ background: "var(--cc-accent-dim)", color: "var(--cc-accent)" }}>
                      {u.label}
                      <button onClick={() => setSelectedUsers((list) => list.filter((x) => x.id !== u.id))} aria-label="Remove"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                  {manualEmails.map((e) => (
                    <span key={e} className="cc-mono flex items-center gap-1 rounded-full px-2 py-1 text-[11px]" style={{ background: "var(--cc-panel-alt)", color: "var(--cc-text-dim)" }}>
                      {e}
                      <button onClick={() => setManualEmails((list) => list.filter((x) => x !== e))} aria-label="Remove"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="cc-panel p-4">
              <p className="cc-mono mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cc-text-faint)" }}>Content</p>
              <div className="mb-3 flex gap-2">
                <button onClick={() => setMode("template")} className="cc-mono rounded px-3 py-1.5 text-xs" style={{ background: mode === "template" ? "var(--cc-accent-dim)" : "transparent", color: mode === "template" ? "var(--cc-accent)" : "var(--cc-text-faint)", border: "1px solid var(--cc-border)" }}>Template</button>
                <button onClick={() => setMode("custom")} className="cc-mono rounded px-3 py-1.5 text-xs" style={{ background: mode === "custom" ? "var(--cc-accent-dim)" : "transparent", color: mode === "custom" ? "var(--cc-accent)" : "var(--cc-text-faint)", border: "1px solid var(--cc-border)" }}>Custom</button>
              </div>

              {mode === "template" && (
                <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="cc-mono mb-3 w-full rounded border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }}>
                  <option value="">Select a template…</option>
                  {(templatesData?.items ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}{!t.enabled ? " (override disabled — default used)" : ""}</option>)}
                </select>
              )}

              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="cc-mono mb-3 w-full rounded border bg-transparent px-3 py-2 text-sm"
                style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }}
              />

              {mode === "custom" && (
                <textarea
                  value={customHtml}
                  onChange={(e) => setCustomHtml(e.target.value)}
                  rows={10}
                  placeholder="HTML body"
                  className="cc-mono w-full rounded border bg-transparent px-3 py-2 text-xs"
                  style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }}
                />
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={sendTest} disabled={testing || !(mode === "template" ? templateId : customHtml.trim()) || !subject.trim()} className="min-h-[44px]">
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {testing ? "Sending test…" : "Send Test to Myself"}
              </Button>
              <Button size="sm" onClick={() => setConfirming(true)} disabled={!canSend || sending} className="min-h-[44px]">
                <Send className="h-4 w-4" /> Send
              </Button>
            </div>

            {results && (
              <div className="cc-panel p-4">
                <p className="cc-mono mb-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--cc-text-faint)" }}>Result</p>
                <div className="space-y-1">
                  {results.map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span style={{ color: "var(--cc-text)" }}>{r.to}</span>
                      {r.success ? (
                        <span className="flex items-center gap-1" style={{ color: "var(--cc-green)" }}><CheckCircle className="h-3.5 w-3.5" /> Sent</span>
                      ) : (
                        <span className="flex items-center gap-1" style={{ color: r.skipped ? "var(--cc-amber)" : "var(--cc-red)" }}><AlertTriangle className="h-3.5 w-3.5" /> {r.skipped ? "Skipped (email-ineligible)" : "Failed"}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="cc-panel p-4">
            <p className="cc-mono mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider" style={{ color: "var(--cc-text-faint)" }}>
              <Eye className="h-3.5 w-3.5" /> Live Preview
            </p>
            {previewHtml ? (
              <iframe title="preview" srcDoc={previewHtml} sandbox="" className="h-[420px] w-full rounded bg-white" />
            ) : (
              <div className="flex h-[420px] items-center justify-center text-xs" style={{ color: "var(--cc-text-faint)" }}>
                Select a template or write custom content to preview.
              </div>
            )}
            <div className="mt-3 flex items-start gap-2 rounded p-2 text-[11px]" style={{ background: "var(--cc-panel-alt)", color: "var(--cc-text-faint)" }}>
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              Ineligible recipients (Access &amp; Entitlements → Email Eligible = off) are skipped and shown as such after sending — unless the selected template is security-critical, in which case it always sends.
            </div>
          </div>
        </div>
      </main>

      {confirming && (
        <AdminActionConfirm
          title={totalRecipients > 3 ? `Send to ${totalRecipients} recipients` : "Send email"}
          targetLabel={
            recipients.length <= 3
              ? recipients.map((r) => (r.type === "user" ? r.label : r.address)).join(", ")
              : `${totalRecipients} recipients`
          }
          explanation={`Template: ${mode === "template" ? (selectedTemplate?.name ?? "—") : "Custom"} · Subject: "${subject}" · ${contentSnippet}${contentSnippet.length === 180 ? "…" : ""}`}
          danger={totalRecipients > 3}
          confirmLabel={sending ? "Sending…" : "Send Now"}
          onClose={() => setConfirming(false)}
          toast={toast}
          onConfirm={sendProduction}
        />
      )}
    </>
  );
}
