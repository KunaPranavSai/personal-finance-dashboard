"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Alert, Badge, Button, ConfirmDialog, PageHeader, Panel, Skeleton, TextAreaField, TextField, useDebounced } from "@/components/admin/ui";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

interface UserHit { id: string; name: string; email: string }
interface SendResult { to: string; success: boolean; skipped: boolean; reason?: string }
const MAX_RECIPIENTS = 20;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Recipient = { type: "user"; userId: string; label: string } | { type: "email"; address: string };

/** Manual, one-off messages. System emails (codes, security notices) are never sent from here: they carry real data only the system has. */
export default function AdminEmailComposerPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const dq = useDebounced(search);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [manual, setManual] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("<p>Hi {{name}},</p>\n<p></p>");
  const [preview, setPreview] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [testing, setTesting] = useState(false);
  const dbody = useDebounced(body, 600);
  const dsubject = useDebounced(subject, 600);

  const hits = useQuery({
    queryKey: ["admin", "users", "composer", dq],
    queryFn: () => api.get<{ items: UserHit[] }>(`/api/admin/users?pageSize=6&q=${encodeURIComponent(dq.trim())}`),
    enabled: dq.trim().length >= 2,
  });
  useEffect(() => {
    let live = true;
    api.post<{ html: string }>("/api/admin/email/preview", { subject: dsubject, customHtml: dbody }).then((r) => live && setPreview(r.html)).catch(() => live && setPreview(null));
    return () => { live = false; };
  }, [dsubject, dbody]);

  if (user && user.role !== "SUPER_ADMIN") return <><PageHeader title="Send Email" /><Alert tone="warn">Only a Super Admin can send emails by hand.</Alert></>;

  const add = (r: Recipient) => {
    if (recipients.length >= MAX_RECIPIENTS) { toast(`You can send to at most ${MAX_RECIPIENTS} people at once.`, "error"); return; }
    const dupe = recipients.some((x) => (x.type === "user" && r.type === "user" && x.userId === r.userId) || (x.type === "email" && r.type === "email" && x.address === r.address));
    if (!dupe) setRecipients([...recipients, r]);
  };
  const label = (r: Recipient) => (r.type === "user" ? r.label : r.address);
  const payload = (isTest: boolean) => ({
    isTest, subject: subject.trim(), customHtml: body,
    recipients: isTest ? [] : recipients.map((r) => (r.type === "user" ? { type: "user", userId: r.userId } : { type: "email", address: r.address })),
  });
  const ready = subject.trim() && body.replace(/<[^>]+>/g, "").trim().length > 0;

  return (
    <>
      <PageHeader title="Send Email" description="Write a one-off message to specific people. For automatic emails, use Email Automations." />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <div className="grid min-w-0 gap-4">
          <Panel title={`Recipients (${recipients.length}/${MAX_RECIPIENTS})`}>
            <TextField label="Find a user" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or email, at least 2 letters" />
            {dq.trim().length >= 2 && (
              <ul className="m-0 mt-2 list-none p-0" aria-label="Matching users">
                {hits.isLoading ? <li><Skeleton h={36} /></li> : (hits.data?.items ?? []).length === 0 ? <li className="ad-faint">No matching users</li> : hits.data!.items.map((u) => (
                  <li key={u.id}><button type="button" className="ad-btn ghost" style={{ width: "100%", justifyContent: "flex-start" }} onClick={() => { add({ type: "user", userId: u.id, label: `${u.name} (${u.email})` }); setSearch(""); }}>{u.name} <span className="ad-faint">{u.email}</span></button></li>
                ))}
              </ul>
            )}
            <form className="mt-3 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); const v = manual.trim().toLowerCase(); if (!EMAIL_RE.test(v)) { toast("That is not a valid email address", "error"); return; } add({ type: "email", address: v }); setManual(""); }}>
              <div className="flex-1"><TextField label="Or add an email address" type="email" value={manual} onChange={(e) => setManual(e.target.value)} /></div>
              <Button type="submit">Add</Button>
            </form>
            {recipients.length > 0 && (
              <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0" aria-label="Selected recipients">
                {recipients.map((r, i) => (
                  <li key={label(r)}><span className="ad-badge accent" style={{ paddingRight: 4 }}>{label(r)}
                    <button type="button" className="ad-btn ghost icon sm" style={{ width: 28, minHeight: 28 }} aria-label={`Remove ${label(r)}`} onClick={() => setRecipients(recipients.filter((_, j) => j !== i))}><X size={14} aria-hidden="true" /></button></span></li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Message">
            <div className="grid gap-3">
              <TextField label="Subject" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} />
              <TextAreaField label="Body (HTML)" rows={10} value={body} onChange={(e) => setBody(e.target.value)} style={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 13 }}
                hint="Use {{name}} for the person's name. Scripts, forms and non-https links are removed. The message goes inside the standard branded header and footer." />
            </div>
          </Panel>
          <div className="flex flex-wrap gap-2">
            <Button loading={testing} disabled={!ready} onClick={async () => {
              setTesting(true); setResults(null);
              try { const r = await api.post<{ results: SendResult[] }>("/api/admin/email/send", payload(true)); setResults(r.results); toast(r.results[0]?.success ? "Test sent to your own inbox" : "The test email failed", r.results[0]?.success ? "success" : "error"); }
              catch (e) { toast(e instanceof Error ? e.message : "Couldn't send the test", "error"); } finally { setTesting(false); }
            }}>Send a test to myself</Button>
            <Button variant="primary" disabled={!ready || recipients.length === 0} onClick={() => setConfirm(true)}>Send to {recipients.length || "…"} {recipients.length === 1 ? "person" : "people"}</Button>
          </div>
          {results && (
            <Panel title="Result">
              <ul className="m-0 list-none p-0">{results.map((r, i) => <li key={i} className="ad-row"><span className="flex-1 break-all">{r.to}</span>{r.success ? <Badge tone="green">Sent</Badge> : r.skipped ? <Badge tone="amber">Skipped: email turned off for this user</Badge> : <Badge tone="red">Failed</Badge>}</li>)}</ul>
            </Panel>
          )}
        </div>
        <Panel title="Preview" padded={false} className="lg:sticky lg:top-[72px]">
          <div className="p-4">
            {preview ? <iframe title="Email preview" sandbox="" srcDoc={preview} style={{ width: "100%", height: 560, border: "1px solid var(--ad-border)", borderRadius: 10, background: "#fff" }} /> : <Skeleton h={300} />}
          </div>
        </Panel>
      </div>

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={`Send to ${recipients.length} ${recipients.length === 1 ? "person" : "people"}`} confirmLabel="Send email now" danger={recipients.length > 3}
        target={recipients.length <= 3 ? recipients.map(label).join(", ") : `${recipients.length} recipients`}
        description={`Subject: “${subject.trim()}”. Each person receives their own copy. This cannot be undone and counts toward your Resend limit.`}
        onConfirm={async () => { const r = await api.post<{ results: SendResult[]; successCount: number; totalCount: number }>("/api/admin/email/send", payload(false)); setResults(r.results); toast(`Sent to ${r.successCount} of ${r.totalCount}`, r.successCount === r.totalCount ? "success" : "error"); }} />
    </>
  );
}
