"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Plus } from "lucide-react";
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, Panel, SelectField, Skeleton, TextAreaField, TextField } from "@/components/admin/ui";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/adminFormat";

type Status = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "EXPIRED";
interface Announcement { id: string; title: string; body: string; type: string; priority: string; status: Status; audience: string; publishAt: string | null; expireAt: string | null; createdAt: string }
const FILTERS: (Status | "ALL")[] = ["ALL", "DRAFT", "SCHEDULED", "PUBLISHED", "EXPIRED"];
const TONE: Record<Status, "" | "amber" | "green" | "red"> = { DRAFT: "", SCHEDULED: "amber", PUBLISHED: "green", EXPIRED: "red" };
const TYPES = ["INFO", "UPDATE", "MAINTENANCE", "SECURITY", "FEATURE", "IMPORTANT"];
const PRIORITIES = ["NORMAL", "IMPORTANT", "URGENT"];
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const empty = { title: "", body: "", type: "INFO", priority: "NORMAL", publishNow: false, publishAt: "", expireAt: "" };
/** The date-time inputs are entered as IST (the admin time zone), whatever the device clock says. */
const istToIso = (v: string) => (v ? new Date(`${v}:00+05:30`).toISOString() : null);

export default function AdminAnnouncementsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Status | "ALL">("ALL");
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [publish, setPublish] = useState<Announcement | null>(null);
  const [remove, setRemove] = useState<Announcement | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["admin", "announcements"], queryFn: () => api.get<{ items: Announcement[] }>("/api/admin/announcements") });
  const stale = () => void queryClient.invalidateQueries({ queryKey: ["admin", "announcements"] });
  const items = (data?.items ?? []).filter((a) => filter === "ALL" || a.status === filter);

  const create = async () => {
    setSaving(true);
    try {
      await api.post("/api/admin/announcements", { ...form, audience: "ALL", publishAt: istToIso(form.publishAt), expireAt: istToIso(form.expireAt) });
      toast(form.publishNow ? "Announcement published" : "Announcement saved", "success");
      setComposing(false); setForm(empty); stale();
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save the announcement", "error"); } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title="Announcements" description="Messages shown to every user in the app. Times are IST." actions={<Button variant="primary" onClick={() => setComposing(true)}><Plus size={16} aria-hidden="true" />New announcement</Button>} />

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {FILTERS.map((f) => <Button key={f} size="sm" variant={filter === f ? "primary" : "default"} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === "ALL" ? "All" : label(f)}</Button>)}
      </div>

      {isError ? <ErrorState onRetry={() => void refetch()} /> : isLoading ? <Skeleton h={90} className="mb-2" /> : items.length === 0 ? (
        <Panel><EmptyState icon={Megaphone} title={filter === "ALL" ? "No announcements yet" : `No ${label(filter)} announcements`} description="Create one to tell users about an update or maintenance." /></Panel>
      ) : (
        <div className="grid gap-3">
          {items.map((a) => (
            <Panel key={a.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2"><Badge tone={TONE[a.status]}>{label(a.status)}</Badge><span className="ad-faint text-xs">{label(a.type)} · {label(a.priority)} priority</span></div>
                  <h3 className="m-0 text-[15px]">{a.title}</h3>
                  <p className="ad-muted mb-0 mt-1 whitespace-pre-wrap">{a.body}</p>
                  <p className="ad-faint mb-0 mt-2 text-xs">Created {fmtDateTime(a.createdAt)}{a.publishAt ? ` · Publishes ${fmtDateTime(a.publishAt)}` : ""}{a.expireAt ? ` · Expires ${fmtDateTime(a.expireAt)}` : ""}</p>
                </div>
                <div className="flex gap-2">
                  {(a.status === "DRAFT" || a.status === "SCHEDULED") && <Button size="sm" onClick={() => setPublish(a)}>Publish now</Button>}
                  <Button size="sm" variant="danger" onClick={() => setRemove(a)}>Delete</Button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Modal open={composing} onClose={() => setComposing(false)} title="New announcement" wide
        footer={<><Button onClick={() => setComposing(false)}>Cancel</Button><Button variant="primary" loading={saving} disabled={!form.title.trim() || !form.body.trim()} onClick={() => void create()}>{form.publishNow ? "Publish to all users" : form.publishAt ? "Schedule" : "Save draft"}</Button></>}>
        <div className="grid gap-3">
          <TextField label="Title" value={form.title} maxLength={140} onChange={(e) => setForm({ ...form, title: e.target.value })} data-autofocus />
          <TextAreaField label="Message" rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</SelectField>
            <SelectField label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{PRIORITIES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</SelectField>
          </div>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3"><input type="checkbox" className="h-5 w-5" checked={form.publishNow} onChange={(e) => setForm({ ...form, publishNow: e.target.checked })} /><span>Publish immediately</span></label>
          <div className="grid gap-3 sm:grid-cols-2">
            {!form.publishNow && <TextField label="Publish at (IST)" type="datetime-local" value={form.publishAt} onChange={(e) => setForm({ ...form, publishAt: e.target.value })} hint="Leave empty to save as a draft." />}
            <TextField label="Expires at (IST, optional)" type="datetime-local" value={form.expireAt} onChange={(e) => setForm({ ...form, expireAt: e.target.value })} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={publish !== null} onClose={() => setPublish(null)} title="Publish announcement" target={publish?.title} confirmLabel="Publish to all users"
        description="Every user will see this announcement right away."
        onConfirm={async () => { await api.post(`/api/admin/announcements/${publish!.id}/publish`); toast("Announcement published", "success"); stale(); }} />
      <ConfirmDialog open={remove !== null} onClose={() => setRemove(null)} danger title="Delete announcement" target={remove?.title} confirmLabel="Delete announcement"
        description="This removes the announcement for everyone. It cannot be undone."
        onConfirm={async () => { await api.delete(`/api/admin/announcements/${remove!.id}`); toast("Announcement deleted", "success"); stale(); }} />
    </>
  );
}
