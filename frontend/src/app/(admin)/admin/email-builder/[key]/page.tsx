"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Copy, Monitor, Plus, Smartphone, Trash2 } from "lucide-react";
import {
  Alert, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, Panel, SelectField, Skeleton, TabPanel, Tabs,
  TextAreaField, TextField, useDebounced,
} from "@/components/admin/ui";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { fmtDateTime } from "@/lib/adminFormat";

type Block =
  | { id: string; type: "eyebrow" | "heading" | "text"; text: string }
  | { id: string; type: "bullets"; items: string[] }
  | { id: string; type: "code"; value: string; note?: string }
  | { id: string; type: "button"; label: string; url: string }
  | { id: string; type: "details"; rows: [string, string][] }
  | { id: string; type: "notice"; tone: "info" | "warn"; title?: string; text: string }
  | { id: string; type: "image"; url: string; alt: string }
  | { id: string; type: "divider" }
  | { id: string; type: "spacer"; size: number };
type BlockType = Block["type"];

interface Version { id: string; version: number; status: string; subject: string; preheader: string; mode: "blocks" | "html"; blocks: Block[] | null; customHtml: string | null }
interface Loaded {
  key: string;
  defaults: { name: string; subject: string; preheader: string; blocks: Block[] } | null;
  tags: { tag: string; description: string; required: boolean; sample: string }[];
  draft: Version | null; published: Version | null;
  history: { id: string; version: number; status: string; subject: string; createdAt: string; publishedAt: string | null; createdBy: string | null }[];
  legacyOverrideActive: boolean;
}
interface Preview { ok: boolean; errors: string[]; missingRequired: string[]; unknown: string[]; subject?: string; html?: string }

const BLOCK_LABEL: Record<BlockType, string> = {
  eyebrow: "Small label", heading: "Heading", text: "Paragraph", bullets: "Bullet list", code: "Code box (one-time code)", button: "Button",
  details: "Info card", notice: "Notice / security note", image: "Image", divider: "Divider", spacer: "Spacer",
};
const uid = () => Math.random().toString(36).slice(2, 10);
const fresh = (t: BlockType): Block => {
  const id = uid();
  switch (t) {
    case "eyebrow": case "heading": case "text": return { id, type: t, text: "" };
    case "bullets": return { id, type: t, items: [""] };
    case "code": return { id, type: t, value: "{{code}}", note: "" };
    case "button": return { id, type: t, label: "Open", url: "{{appUrl}}/login" };
    case "details": return { id, type: t, rows: [["When", "{{when}}"]] };
    case "notice": return { id, type: t, tone: "info", title: "", text: "" };
    case "image": return { id, type: t, url: "https://", alt: "" };
    case "divider": return { id, type: t };
    case "spacer": return { id, type: t, size: 16 };
  }
};
const summary = (b: Block): string => {
  switch (b.type) {
    case "eyebrow": case "heading": case "text": return b.text || "(empty)";
    case "bullets": return b.items.filter(Boolean).join(" · ") || "(empty)";
    case "code": return b.value;
    case "button": return `${b.label} → ${b.url}`;
    case "details": return b.rows.map((r) => r[0]).join(", ");
    case "notice": return b.title || b.text || "(empty)";
    case "image": return b.url;
    case "divider": return "Horizontal line";
    case "spacer": return `${b.size}px space`;
  }
};

export default function EmailBuilderPage() {
  const { key } = useParams<{ key: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "email-builder", key], queryFn: () => api.get<Loaded>(`/api/admin/email-builder/${key}`), refetchOnWindowFocus: false });

  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [mode, setMode] = useState<"blocks" | "html">("blocks");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [html, setHtml] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"content" | "settings" | "versions">("content");
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<null | "publish" | "test" | "reset" | "html" | { restore: string }>(null);
  const [addType, setAddType] = useState<BlockType>("text");
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [pv, setPv] = useState<Preview | null>(null);
  const [pvLoading, setPvLoading] = useState(false);
  const lastField = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const load = useCallback((d: Loaded) => {
    const src = d.draft ?? d.published;
    if (src) {
      setSubject(src.subject); setPreheader(src.preheader); setMode(src.mode);
      setBlocks(src.blocks ?? d.defaults?.blocks ?? []); setHtml(src.customHtml ?? "");
    } else if (d.defaults) {
      setSubject(d.defaults.subject); setPreheader(d.defaults.preheader); setMode("blocks"); setBlocks(d.defaults.blocks); setHtml("");
    }
    setDirty(false); setReady(true);
  }, []);
  useEffect(() => { if (q.data && !ready) load(q.data); }, [q.data, ready, load]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const payload = useMemo(() => ({ subject, preheader, mode, blocks: mode === "blocks" ? blocks : undefined, html: mode === "html" ? html : undefined }), [subject, preheader, mode, blocks, html]);
  const debounced = useDebounced(payload, 600);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setPvLoading(true);
    api.post<Preview>(`/api/admin/email-builder/${key}/preview`, debounced)
      .then((r) => { if (!cancelled) setPv(r); })
      .catch(() => { if (!cancelled) setPv({ ok: false, errors: ["Couldn't build the preview."], missingRequired: [], unknown: [] }); })
      .finally(() => { if (!cancelled) setPvLoading(false); });
    return () => { cancelled = true; };
  }, [debounced, key, ready]);

  const edit = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setDirty(true); };
  const patchBlock = (id: string, patch: Partial<Block>) => { setBlocks((bs) => bs.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b))); setDirty(true); };
  const move = (i: number, d: -1 | 1) => { setBlocks((bs) => { const n = [...bs]; const j = i + d; if (j < 0 || j >= n.length) return bs; [n[i], n[j]] = [n[j], n[i]]; return n; }); setDirty(true); };

  /** Inserts {{tag}} where the cursor was last in any editable field. */
  const insertTag = (tag: string) => {
    const el = lastField.current;
    if (!el || !document.contains(el)) { toast("Click into a text field first, then choose a variable.", "info"); return; }
    const text = `{{${tag}}}`;
    const start = el.selectionStart ?? el.value.length, end = el.selectionEnd ?? start;
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, el.value.slice(0, start) + text + el.value.slice(end));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.focus(); el.setSelectionRange(start + text.length, start + text.length);
  };

  const save = async (): Promise<boolean> => {
    setSaving(true);
    try { await api.patch(`/api/admin/email-builder/${key}/draft`, payload); setDirty(false); await queryClient.invalidateQueries({ queryKey: ["admin", "email-builder", key] }); return true; }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't save the draft", "error"); return false; } finally { setSaving(false); }
  };
  const refetchAndLoad = async () => { const r = await q.refetch(); if (r.data) load(r.data); };

  if (user && user.role !== "SUPER_ADMIN") return <><PageHeader title="Email Builder" /><Alert tone="warn">Only a Super Admin can edit emails.</Alert></>;
  if (q.isError) return <><PageHeader title="Email Builder" crumbs={[{ label: "Email Automations", href: "/admin/automated-emails" }]} /><ErrorState message={q.error instanceof Error ? q.error.message : undefined} onRetry={() => void q.refetch()} /></>;
  if (q.isLoading || !q.data || !ready) return <><PageHeader title="Email Builder" /><Skeleton h={420} /></>;

  const d = q.data;
  const name = d.defaults?.name ?? key;
  const state = d.draft ? `Draft v${d.draft.version}${d.published ? ` · live is v${d.published.version}` : " · built-in design is live"}` : d.published ? `Live v${d.published.version}` : "Built-in design is live";
  const blocking = pv?.missingRequired ?? [];
  const canPublish = !pvLoading && pv?.ok && blocking.length === 0;
  const selectedBlock = blocks.find((b) => b.id === selected);

  const editor = (
    <div onFocusCapture={(e) => { const t = e.target as HTMLElement; if ((t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) && t.dataset.insertable) lastField.current = t; }}>
      <Tabs tabs={[{ id: "content", label: "Content" }, { id: "settings", label: "Subject & variables" }, { id: "versions", label: `Versions (${d.history.length})` }]} value={tab} onChange={setTab} label="Builder sections" />

      <TabPanel id="content" active={tab === "content"}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant={mode === "blocks" ? "primary" : "default"} aria-pressed={mode === "blocks"} onClick={() => { if (mode !== "blocks") { setMode("blocks"); setDirty(true); } }}>Blocks</Button>
          <Button size="sm" variant={mode === "html" ? "primary" : "default"} aria-pressed={mode === "html"} onClick={() => { if (mode !== "html") setDialog("html"); }}>HTML (advanced)</Button>
        </div>
        {mode === "blocks" ? (
          <>
            <ol className="m-0 grid list-none gap-2 p-0">
              <li className="ad-panel ad-faint px-3 py-2 text-[13px]">Header with logo and product name (fixed)</li>
              {blocks.map((b, i) => (
                <li key={b.id} className="ad-panel" style={{ borderColor: selected === b.id ? "var(--ad-accent)" : undefined }}>
                  <div className="flex items-center gap-1 p-2">
                    <button type="button" className="min-w-0 flex-1 rounded-lg px-2 py-1 text-left" style={{ background: "none", border: 0, color: "inherit", minHeight: 44, cursor: "pointer" }} aria-expanded={selected === b.id} onClick={() => setSelected(selected === b.id ? null : b.id)}>
                      <span className="block text-xs font-semibold" style={{ color: "var(--ad-accent)" }}>{BLOCK_LABEL[b.type]}</span>
                      <span className="ad-muted block truncate text-[13px]">{summary(b)}</span>
                    </button>
                    <Button size="sm" icon variant="ghost" aria-label={`Move ${BLOCK_LABEL[b.type]} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={16} aria-hidden="true" /></Button>
                    <Button size="sm" icon variant="ghost" aria-label={`Move ${BLOCK_LABEL[b.type]} down`} disabled={i === blocks.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16} aria-hidden="true" /></Button>
                    <Button size="sm" icon variant="ghost" aria-label={`Duplicate ${BLOCK_LABEL[b.type]}`} onClick={() => { setBlocks((bs) => { const n = [...bs]; n.splice(i + 1, 0, { ...structuredClone(b), id: uid() }); return n; }); setDirty(true); }}><Copy size={16} aria-hidden="true" /></Button>
                    <Button size="sm" icon variant="ghost" aria-label={`Delete ${BLOCK_LABEL[b.type]}`} onClick={() => { setBlocks((bs) => bs.filter((x) => x.id !== b.id)); setDirty(true); }}><Trash2 size={16} aria-hidden="true" style={{ color: "var(--ad-red)" }} /></Button>
                  </div>
                  {selectedBlock?.id === b.id && <div className="grid gap-3 border-t p-3" style={{ borderColor: "var(--ad-border)" }}><BlockForm block={b} onChange={(p) => patchBlock(b.id, p)} /></div>}
                </li>
              ))}
              <li className="ad-panel ad-faint px-3 py-2 text-[13px]">Footer with help line, privacy and terms (fixed)</li>
            </ol>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div style={{ minWidth: 220, flex: "1 1 220px" }}>
                <SelectField label="Add a block" value={addType} onChange={(e) => setAddType(e.target.value as BlockType)}>
                  {(Object.keys(BLOCK_LABEL) as BlockType[]).map((t) => <option key={t} value={t}>{BLOCK_LABEL[t]}</option>)}
                </SelectField>
              </div>
              <Button onClick={() => { const b = fresh(addType); setBlocks((bs) => [...bs, b]); setSelected(b.id); setDirty(true); }}><Plus size={16} aria-hidden="true" />Add block</Button>
            </div>
          </>
        ) : (
          <>
            <Alert tone="warn">Your HTML is cleaned before it is saved: scripts, forms, iframes, event handlers and non-https links are removed. It sits inside the standard header and footer.</Alert>
            <div className="mt-3"><TextAreaField label="Email body (HTML)" data-insertable="1" rows={16} value={html} onChange={(e) => { setHtml(e.target.value); setDirty(true); }} style={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 13 }} hint="Use {{variables}} from the Subject & variables tab." /></div>
          </>
        )}
      </TabPanel>

      <TabPanel id="settings" active={tab === "settings"}>
        <div className="grid gap-3">
          <TextField label="Subject line" data-insertable="1" value={subject} maxLength={200} onChange={(e) => edit(setSubject)(e.target.value)} />
          <TextField label="Preheader (the preview text beside the subject in the inbox)" data-insertable="1" value={preheader} maxLength={200} onChange={(e) => edit(setPreheader)(e.target.value)} />
        </div>
        <h3 className="mb-1 mt-5 text-sm font-semibold">Variables</h3>
        <p className="ad-hint mt-0">Click into a field, then choose Insert. Required variables must appear in the body before you can publish.</p>
        <ul className="m-0 list-none p-0">
          {d.tags.map((t) => (
            <li key={t.tag} className="ad-row" style={{ padding: "8px 0" }}>
              <div className="min-w-0 flex-1">
                <code>{`{{${t.tag}}}`}</code> {t.required && (blocking.includes(t.tag) ? <Badge tone="red">Required · missing</Badge> : <Badge tone="green">Required · used</Badge>)}
                <div className="ad-faint text-xs">{t.description} · e.g. {t.sample}</div>
              </div>
              <Button size="sm" onClick={() => insertTag(t.tag)}>Insert</Button>
            </li>
          ))}
        </ul>
      </TabPanel>

      <TabPanel id="versions" active={tab === "versions"}>
        {d.legacyOverrideActive && <div className="mb-3"><Alert tone="warn">A legacy pasted-HTML override is live for this email. Publishing from the builder replaces it.</Alert></div>}
        {d.history.length === 0 ? <EmptyState title="No versions yet" description="Save a draft to start a history. Until you publish, the built-in design is sent." /> : (
          <ul className="m-0 list-none p-0">
            {d.history.map((h) => (
              <li key={h.id} className="ad-row">
                <div className="min-w-0 flex-1"><div className="font-medium">Version {h.version} <Badge tone={h.status === "PUBLISHED" ? "green" : h.status === "DRAFT" ? "amber" : ""}>{h.status === "PUBLISHED" ? "Live" : h.status === "DRAFT" ? "Draft" : "Earlier"}</Badge></div>
                  <div className="ad-faint text-xs">{h.subject} · {fmtDateTime(h.publishedAt ?? h.createdAt)}{h.createdBy ? ` · ${h.createdBy}` : ""}</div></div>
                {h.status !== "DRAFT" && <Button size="sm" onClick={() => setDialog({ restore: h.id })}>Restore to draft</Button>}
              </li>
            ))}
          </ul>
        )}
      </TabPanel>
    </div>
  );

  const preview = (
    <Panel title="Preview" padded={false} actions={
      <span className="inline-flex gap-1">
        <Button size="sm" icon variant={device === "desktop" ? "primary" : "default"} aria-pressed={device === "desktop"} aria-label="Desktop preview" onClick={() => setDevice("desktop")}><Monitor size={16} aria-hidden="true" /></Button>
        <Button size="sm" icon variant={device === "mobile" ? "primary" : "default"} aria-pressed={device === "mobile"} aria-label="Mobile preview" onClick={() => setDevice("mobile")}><Smartphone size={16} aria-hidden="true" /></Button>
      </span>}>
      <div className="px-4 pt-3">
        <p className="ad-faint m-0 text-xs">Filled with sample data. Subject: <strong className="ad-muted">{pv?.subject ?? subject}</strong></p>
        {pv && pv.errors.length > 0 && <div className="mt-2"><Alert tone="error"><ul className="m-0 pl-4">{pv.errors.map((e) => <li key={e}>{e}</li>)}</ul></Alert></div>}
        {pv && blocking.length > 0 && <div className="mt-2"><Alert tone="warn">Missing required variable{blocking.length > 1 ? "s" : ""}: {blocking.map((t) => `{{${t}}}`).join(", ")}</Alert></div>}
        {pv && pv.unknown.length > 0 && <div className="mt-2"><Alert tone="warn">This email cannot fill: {pv.unknown.map((t) => `{{${t}}}`).join(", ")}. They would be sent as written.</Alert></div>}
      </div>
      <div className="p-4" style={{ opacity: pvLoading ? 0.6 : 1 }} aria-busy={pvLoading}>
        {pv?.html ? (
          <iframe title={`Preview of ${name}`} sandbox="" srcDoc={pv.html} style={{ width: device === "mobile" ? 375 : "100%", maxWidth: "100%", height: 640, margin: "0 auto", display: "block", border: "1px solid var(--ad-border)", borderRadius: 10, background: "#fff" }} />
        ) : <Skeleton h={300} />}
      </div>
    </Panel>
  );

  return (
    <>
      <PageHeader crumbs={[{ label: "Email Automations", href: "/admin/automated-emails" }, { label: name }]} title={name}
        description={<span className="inline-flex flex-wrap items-center gap-2">{state}{dirty && <Badge tone="amber">Unsaved changes</Badge>}</span>}
        actions={<>
          <Button onClick={() => { setTestTo(user?.email ?? ""); setDialog("test"); }}>Send test</Button>
          <Button onClick={() => void save().then((ok) => ok && toast("Draft saved", "success"))} loading={saving} disabled={!dirty}>Save draft</Button>
          <Button variant="primary" disabled={!canPublish} title={!canPublish ? "Fix the problems shown in the preview first" : undefined} onClick={() => setDialog("publish")}>Publish</Button>
        </>} />

      <div className="mb-3 flex gap-2 lg:hidden" role="group" aria-label="Show">
        <Button size="sm" variant={view === "edit" ? "primary" : "default"} aria-pressed={view === "edit"} onClick={() => setView("edit")}>Edit</Button>
        <Button size="sm" variant={view === "preview" ? "primary" : "default"} aria-pressed={view === "preview"} onClick={() => setView("preview")}>Preview</Button>
      </div>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <div className={`min-w-0 ${view === "preview" ? "hidden lg:block" : ""}`}>{editor}</div>
        <div className={`min-w-0 ${view === "edit" ? "hidden lg:block" : ""}`} style={{ position: "sticky", top: 72 }}>{preview}</div>
      </div>
      <div className="mt-4"><Button variant="ghost" onClick={() => setDialog("reset")}>Go back to the built-in design…</Button></div>

      <ConfirmDialog open={dialog === "publish"} onClose={() => setDialog(null)} title="Publish this version" target={name} confirmLabel="Publish and make live"
        description="This replaces the email people receive right now. The previous live version is kept in Versions so you can restore it."
        onConfirm={async () => {
          if (dirty && !(await save())) throw new Error("Save the draft first.");
          await api.post(`/api/admin/email-builder/${key}/publish`);
          toast("Published. New emails use this design.", "success");
          await refetchAndLoad(); queryClient.invalidateQueries({ queryKey: ["admin", "automated-emails"] });
        }} />
      <ConfirmDialog open={dialog === "reset"} onClose={() => setDialog(null)} title="Use the built-in design" target={name} confirmLabel="Switch to built-in design" danger
        description="Stops using any published or pasted design and goes back to the built-in email. Your versions stay in the history."
        onConfirm={async () => { await api.post(`/api/admin/email-builder/${key}/reset-default`); toast("Back to the built-in design", "success"); await refetchAndLoad(); queryClient.invalidateQueries({ queryKey: ["admin", "automated-emails"] }); }} />
      <ConfirmDialog open={typeof dialog === "object" && dialog !== null} onClose={() => setDialog(null)} title="Restore this version into the draft" confirmLabel="Replace draft with this version"
        description="Your current draft (and any unsaved edits) will be replaced. Nothing goes live until you publish."
        onConfirm={async () => { await api.post(`/api/admin/email-builder/${key}/restore`, { versionId: (dialog as { restore: string }).restore }); toast("Version restored to the draft", "success"); await refetchAndLoad(); setTab("content"); }} />
      <ConfirmDialog open={dialog === "html"} onClose={() => setDialog(null)} title="Switch to HTML mode" confirmLabel="Switch to HTML"
        description="HTML mode lets you write the email body yourself. It starts empty; your blocks are kept if you switch back. Scripts, forms and other unsafe markup are removed when you save."
        onConfirm={async () => { setMode("html"); if (!html.trim()) setHtml("<p>Hi {{name}},</p>\n"); setDirty(true); }} />
      <Modal open={dialog === "test"} onClose={() => setDialog(null)} title="Send a test email" description="Sends what you see in the preview, with sample data. The subject starts with [Test]. Counts toward your Resend limit."
        footer={<><Button onClick={() => setDialog(null)}>Cancel</Button><Button variant="primary" loading={testing} disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testTo)} onClick={async () => {
          setTesting(true);
          try { const r = await api.post<{ emailSent: boolean }>(`/api/admin/email-builder/${key}/test`, { ...payload, to: testTo }); if (r.emailSent) { toast(`Test sent to ${testTo}`, "success"); setDialog(null); } else toast("The email could not be sent. Check the sender settings and Resend key.", "error"); }
          catch (e) { toast(e instanceof Error ? e.message : "Couldn't send the test", "error"); } finally { setTesting(false); }
        }}>Send test email</Button></>}>
        <TextField label="Send to" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} data-autofocus />
      </Modal>
    </>
  );
}

function BlockForm({ block: b, onChange }: { block: Block; onChange: (p: Partial<Block>) => void }) {
  const ins = { "data-insertable": "1" } as const;
  switch (b.type) {
    case "eyebrow": case "heading":
      return <TextField label={b.type === "heading" ? "Heading" : "Label"} {...ins} value={b.text} onChange={(e) => onChange({ text: e.target.value })} />;
    case "text":
      return <TextAreaField label="Paragraph" {...ins} rows={4} value={b.text} onChange={(e) => onChange({ text: e.target.value })} />;
    case "bullets":
      return (
        <>
          {b.items.map((it, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1"><TextField label={`Item ${i + 1}`} {...ins} value={it} onChange={(e) => onChange({ items: b.items.map((x, j) => (j === i ? e.target.value : x)) })} /></div>
              <Button size="sm" icon variant="ghost" aria-label={`Remove item ${i + 1}`} disabled={b.items.length === 1} onClick={() => onChange({ items: b.items.filter((_, j) => j !== i) })}><Trash2 size={16} aria-hidden="true" /></Button>
            </div>
          ))}
          <div><Button size="sm" onClick={() => onChange({ items: [...b.items, ""] })}><Plus size={14} aria-hidden="true" />Add item</Button></div>
        </>
      );
    case "code":
      return <>
        <TextField label="Code" {...ins} value={b.value} onChange={(e) => onChange({ value: e.target.value })} hint="Usually {{code}}." />
        <TextField label="Note under the code" {...ins} value={b.note ?? ""} onChange={(e) => onChange({ note: e.target.value })} hint="For example “Expires in {{expiry}}. Works once.”" />
      </>;
    case "button":
      return <>
        <TextField label="Button text" {...ins} value={b.label} onChange={(e) => onChange({ label: e.target.value })} />
        <TextField label="Link" {...ins} value={b.url} onChange={(e) => onChange({ url: e.target.value })} hint="https://…, mailto:… or start with {{appUrl}}" />
      </>;
    case "details":
      return (
        <>
          {b.rows.map((r, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1"><TextField label={`Row ${i + 1} label`} {...ins} value={r[0]} onChange={(e) => onChange({ rows: b.rows.map((x, j) => (j === i ? [e.target.value, x[1]] : x)) as [string, string][] })} /></div>
              <div className="flex-1"><TextField label={`Row ${i + 1} value`} {...ins} value={r[1]} onChange={(e) => onChange({ rows: b.rows.map((x, j) => (j === i ? [x[0], e.target.value] : x)) as [string, string][] })} /></div>
              <Button size="sm" icon variant="ghost" aria-label={`Remove row ${i + 1}`} disabled={b.rows.length === 1} onClick={() => onChange({ rows: b.rows.filter((_, j) => j !== i) })}><Trash2 size={16} aria-hidden="true" /></Button>
            </div>
          ))}
          <div><Button size="sm" onClick={() => onChange({ rows: [...b.rows, ["", ""]] })}><Plus size={14} aria-hidden="true" />Add row</Button></div>
        </>
      );
    case "notice":
      return <>
        <SelectField label="Style" value={b.tone} onChange={(e) => onChange({ tone: e.target.value as "info" | "warn" })}><option value="info">Information (green)</option><option value="warn">Warning (amber)</option></SelectField>
        <TextField label="Title (optional)" {...ins} value={b.title ?? ""} onChange={(e) => onChange({ title: e.target.value })} />
        <TextAreaField label="Message" {...ins} rows={3} value={b.text} onChange={(e) => onChange({ text: e.target.value })} />
      </>;
    case "image":
      return <>
        <TextField label="Image address" {...ins} value={b.url} onChange={(e) => onChange({ url: e.target.value })} hint="Must start with https://" />
        <TextField label="Description for screen readers" {...ins} value={b.alt} onChange={(e) => onChange({ alt: e.target.value })} />
      </>;
    case "spacer":
      return <TextField label="Height (4–80 px)" type="number" min={4} max={80} value={b.size} onChange={(e) => onChange({ size: Number(e.target.value) })} />;
    case "divider":
      return <p className="ad-muted m-0">A thin horizontal line. Nothing to edit.</p>;
  }
}
