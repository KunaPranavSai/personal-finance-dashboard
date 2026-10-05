"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Send, Eye, X, CheckCircle, AlertTriangle, Info, Pencil, RotateCcw, Power, Upload, Check, Copy } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { api } from "@/lib/api";

interface EmailTemplate {
  id: string;
  name: string;
  defaultHtml: string;
  html: string;
  subject: string | null;
  hasOverride: boolean;
  enabled: boolean;
  /** Default content with {{tags}} in place of sample values: the starting point for a custom version. */
  taggedHtml: string;
  tags: Tag[];
  globalTags: Tag[];
}

interface Tag {
  tag: string;
  description: string;
  required: boolean;
  sample: string;
}

const TAG_RE = /\{\{\s*(\w+)\s*\}\}/g;
const tagsIn = (html: string) => new Set([...html.matchAll(TAG_RE)].map((m) => m[1]));
// Preview with sample values, the same substitution the server performs when sending.
const withSamples = (html: string, tags: Tag[]) => html.replace(TAG_RE, (m, k: string) => tags.find((t) => t.tag === k)?.sample ?? m);

/**
 * Communication → Email Templates. Reuses the existing GET /api/admin/email-templates,
 * PATCH/DELETE /api/admin/email-templates/:id, and POST .../test endpoints — no duplicate
 * delivery path. IMPORTANT, disclosed limitation: emailTemplates.ts's templates are plain JS
 * template-literal functions, not a generic `{{placeholder}}` engine. An enabled override's
 * html/subject is sent VERBATIM to every recipient — it is not re-personalized with each
 * recipient's name/uid/etc. This is shown below and on the edit form, not hidden.
 */
export default function AdminEmailTemplatesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<EmailTemplate | null>(null);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editHtml, setEditHtml] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; emailSent: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const [showPreview, setShowPreview] = useState(false);

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

  const openEdit = (t: EmailTemplate) => {
    setEditing(t);
    setEditSubject(t.subject ?? "");
    // No custom version yet: start from the default written with {{tags}}, so the tags are already in place.
    setEditHtml(t.hasOverride ? t.html : t.taggedHtml);
  };

  const insertTag = (tag: string) => {
    const el = htmlRef.current;
    const text = `{{${tag}}}`;
    if (!el) return setEditHtml((h) => h + text);
    const start = el.selectionStart ?? editHtml.length;
    const end = el.selectionEnd ?? start;
    setEditHtml(editHtml.slice(0, start) + text + editHtml.slice(end));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + text.length, start + text.length); });
  };

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 500_000) return toast("That file is larger than 500 KB", "error");
    setEditHtml(await file.text());
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusyId(editing.id);
    try {
      await api.patch(`/api/admin/email-templates/${editing.id}`, { subject: editSubject || null, html: editHtml, enabled: true });
      toast("Template override saved", "success");
      queryClient.invalidateQueries({ queryKey: ["admin-email-templates"] });
      setEditing(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save override", "error");
    } finally {
      setBusyId(null);
    }
  };

  const toggleEnabled = async (t: EmailTemplate) => {
    setBusyId(t.id);
    try {
      await api.patch(`/api/admin/email-templates/${t.id}`, { enabled: !t.enabled });
      toast(t.enabled ? "Override disabled — using default content" : "Override enabled", "success");
      queryClient.invalidateQueries({ queryKey: ["admin-email-templates"] });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update template", "error");
    } finally {
      setBusyId(null);
    }
  };

  const restoreDefault = async (t: EmailTemplate) => {
    if (!confirm(`Restore "${t.name}" to its built-in default content?`)) return;
    setBusyId(t.id);
    try {
      await api.delete(`/api/admin/email-templates/${t.id}`);
      toast("Restored to default", "success");
      queryClient.invalidateQueries({ queryKey: ["admin-email-templates"] });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to restore default", "error");
    } finally {
      setBusyId(null);
    }
  };

  const items = data?.items ?? [];

  return (
    <>
      <Topbar title="Email Templates" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <AdminPageHeader icon={Mail} title="Email Templates" description="Transactional templates the platform sends automatically." />

        <div className="cc-panel mb-4 flex items-start gap-2 p-3">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--cc-text-faint)" }} />
          <p className="text-xs" style={{ color: "var(--cc-text-faint)" }}>
            Paste your own HTML for any email below. Put <code>{"{{tags}}"}</code> where each person&apos;s details belong (name, code,
            User ID...). The editor lists the tags each email supports, marks the required ones, and will not save a
            version that leaves a required tag out. Use Restore default to go back to the built-in email.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="cc-panel h-32 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((t, i) => (
              <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: i * 0.05 }}>
                <div className="cc-panel flex h-full flex-col gap-3 p-4 transition-shadow hover:shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "var(--cc-accent-dim)", color: "var(--cc-accent)" }}>
                      <Mail className="h-5 w-5" />
                    </div>
                    {t.hasOverride && (
                      <span
                        className="cc-mono rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                        style={{ background: t.enabled ? "var(--cc-accent-dim)" : "rgba(148,148,148,0.15)", color: t.enabled ? "var(--cc-accent)" : "var(--cc-text-faint)" }}
                      >
                        {t.enabled ? "Custom" : "Custom (disabled)"}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold" style={{ color: "var(--cc-text)" }}>{t.name}</p>
                  <p className="cc-mono text-[10px]" style={{ color: "var(--cc-text-faint)" }}>id: {t.id}</p>
                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={() => setPreview(t)} className="min-h-[44px] flex-1 sm:min-h-0">
                      <Eye className="h-3.5 w-3.5" /> Preview
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => openEdit(t)} className="min-h-[44px] flex-1 sm:min-h-0">
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button type="button" size="sm" onClick={() => sendTest(t)} disabled={sending === t.id} className="min-h-[44px] flex-1 sm:min-h-0">
                      <Send className="h-3.5 w-3.5" /> {sending === t.id ? "Sending…" : "Test"}
                    </Button>
                  </div>
                  {t.hasOverride && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleEnabled(t)}
                        disabled={busyId === t.id}
                        className="cc-mono flex flex-1 items-center justify-center gap-1 rounded border px-2 py-1.5 text-[11px] disabled:opacity-50"
                        style={{ borderColor: "var(--cc-border)", color: "var(--cc-text-dim)" }}
                      >
                        <Power className="h-3 w-3" /> {t.enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => restoreDefault(t)}
                        disabled={busyId === t.id}
                        className="cc-mono flex flex-1 items-center justify-center gap-1 rounded border px-2 py-1.5 text-[11px] disabled:opacity-50"
                        style={{ borderColor: "var(--cc-border)", color: "var(--cc-red)" }}
                      >
                        <RotateCcw className="h-3 w-3" /> Restore Default
                      </button>
                    </div>
                  )}
                  {result?.id === t.id && (
                    <motion.p
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="flex items-center gap-1.5 text-xs"
                      style={{ color: result.emailSent ? "var(--cc-green)" : "var(--cc-amber)" }}
                    >
                      {result.emailSent ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                      {result.emailSent ? "Sent to your inbox" : "Not delivered — check RESEND_FROM_EMAIL"}
                    </motion.p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
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

      <AnimatePresence>
        {editing && (() => {
          const used = tagsIn(editHtml);
          const missing = editing.tags.filter((t) => t.required && !used.has(t.tag));
          const known = new Set([...editing.tags, ...editing.globalTags].map((t) => t.tag));
          const unknown = [...used].filter((k) => !known.has(k));
          const row = (t: Tag) => (
            <li key={t.tag} className="flex items-start gap-2 rounded-lg border p-2" style={{ borderColor: "var(--cc-border)" }}>
              <span className="mt-0.5 shrink-0" aria-label={used.has(t.tag) ? "In use" : t.required ? "Missing" : "Not used"}>
                {used.has(t.tag) ? <Check className="h-4 w-4" style={{ color: "var(--cc-green)" }} /> : <span className="block h-4 w-4 rounded-full border" style={{ borderColor: t.required ? "var(--cc-red)" : "var(--cc-border)" }} />}
              </span>
              <span className="min-w-0 flex-1">
                <code className="cc-mono text-xs" style={{ color: "var(--cc-accent)" }}>{`{{${t.tag}}}`}</code>
                {t.required && <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase" style={{ background: "rgba(248,113,113,0.15)", color: "var(--cc-red)" }}>Required</span>}
                <span className="block text-[11px]" style={{ color: "var(--cc-text-dim)" }}>{t.description}</span>
                <span className="block text-[10px]" style={{ color: "var(--cc-text-faint)" }}>e.g. {t.sample}</span>
              </span>
              <span className="flex shrink-0 gap-1">
                <button type="button" onClick={() => insertTag(t.tag)} className="min-h-[36px] rounded border px-2 text-[11px] font-semibold" style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }}>Insert</button>
                <button type="button" aria-label={`Copy ${t.tag}`} onClick={() => navigator.clipboard?.writeText(`{{${t.tag}}}`).then(() => toast("Copied", "success"))} className="flex min-h-[36px] w-9 items-center justify-center rounded border" style={{ borderColor: "var(--cc-border)", color: "var(--cc-text-dim)" }}><Copy className="h-3.5 w-3.5" /></button>
              </span>
            </li>
          );
          return (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 backdrop-blur-sm sm:p-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setEditing(null)}
            >
              <motion.div
                className="cc-panel flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--cc-border)" }}>
                  <p className="text-sm font-semibold" style={{ color: "var(--cc-text)" }}>Edit - {editing.name}</p>
                  <button onClick={() => setEditing(null)} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded" style={{ color: "var(--cc-text-faint)" }}>
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-y-auto lg:grid-cols-[1fr_320px]">
                  <div className="space-y-3 p-4">
                    <div>
                      <label className="cc-mono mb-1 block text-[10px] uppercase tracking-wider" style={{ color: "var(--cc-text-faint)" }}>Subject (optional; tags allowed)</label>
                      <input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} placeholder="Leave empty to keep the default subject" className="cc-mono w-full rounded border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }} />
                    </div>
                    <div>
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <label className="cc-mono block text-[10px] uppercase tracking-wider" style={{ color: "var(--cc-text-faint)" }}>HTML body</label>
                        <span className="flex gap-2">
                          <label className="flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded border px-2.5 text-[11px] font-semibold" style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }}>
                            <Upload className="h-3.5 w-3.5" /> Load .html file
                            <input type="file" accept=".html,.htm,text/html" className="sr-only" onChange={(e) => { void loadFile(e.target.files?.[0]); e.target.value = ""; }} />
                          </label>
                          <button type="button" onClick={() => setShowPreview((v) => !v)} className="flex min-h-[36px] items-center gap-1.5 rounded border px-2.5 text-[11px] font-semibold" style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }}>
                            <Eye className="h-3.5 w-3.5" /> {showPreview ? "Edit" : "Preview"}
                          </button>
                        </span>
                      </div>
                      {showPreview ? (
                        <iframe title="Preview with sample values" srcDoc={withSamples(editHtml, [...editing.globalTags, ...editing.tags])} sandbox="" className="h-[360px] w-full rounded border bg-white" style={{ borderColor: "var(--cc-border)" }} />
                      ) : (
                        <textarea ref={htmlRef} value={editHtml} onChange={(e) => setEditHtml(e.target.value)} rows={16} spellCheck={false} placeholder="Paste your HTML here" className="cc-mono w-full rounded border bg-transparent px-3 py-2 text-xs" style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }} />
                      )}
                    </div>
                  </div>

                  <aside aria-label="Tags" className="space-y-3 border-t p-4 lg:border-l lg:border-t-0" style={{ borderColor: "var(--cc-border)" }}>
                    <div>
                      <p className="cc-mono mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cc-text-faint)" }}>Tags for this email</p>
                      <ul className="space-y-2">{editing.tags.map(row)}</ul>
                    </div>
                    <div>
                      <p className="cc-mono mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cc-text-faint)" }}>Available in every email</p>
                      <ul className="space-y-2">{editing.globalTags.map(row)}</ul>
                    </div>
                    {unknown.length > 0 && (
                      <p className="flex items-start gap-1.5 rounded p-2 text-[11px]" style={{ background: "var(--cc-panel-alt)", color: "var(--cc-amber)" }}>
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        Not recognised for this email, so it will appear as typed: {unknown.map((k) => `{{${k}}}`).join(", ")}
                      </p>
                    )}
                  </aside>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t p-4" style={{ borderColor: "var(--cc-border)" }}>
                  <p role="status" className="text-xs" style={{ color: missing.length ? "var(--cc-red)" : "var(--cc-green)" }}>
                    {missing.length ? `Missing required: ${missing.map((m) => `{{${m.tag}}}`).join(", ")}` : "All required tags are present"}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                    <Button size="sm" onClick={saveEdit} disabled={busyId === editing.id || !editHtml.trim() || missing.length > 0}>
                      {busyId === editing.id ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </>
  );
}
