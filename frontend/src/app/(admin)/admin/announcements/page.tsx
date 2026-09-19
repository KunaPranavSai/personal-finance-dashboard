"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Plus, Send, Trash2, X } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { formatDateIN } from "@/lib/format";

type AnnouncementType = "INFO" | "UPDATE" | "MAINTENANCE" | "SECURITY" | "FEATURE" | "IMPORTANT";
type AnnouncementPriority = "NORMAL" | "IMPORTANT" | "URGENT";
type AnnouncementStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "EXPIRED";

interface Announcement {
  id: string;
  title: string;
  body: string;
  type: AnnouncementType;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  audience: string;
  publishAt: string | null;
  expireAt: string | null;
  createdAt: string;
}

const FILTERS: (AnnouncementStatus | "ALL")[] = ["ALL", "DRAFT", "SCHEDULED", "PUBLISHED", "EXPIRED"];

const STATUS_COLOR: Record<AnnouncementStatus, string> = {
  DRAFT: "var(--cc-text-faint)",
  SCHEDULED: "var(--cc-amber)",
  PUBLISHED: "var(--cc-green)",
  EXPIRED: "var(--cc-red)",
};

const emptyForm = {
  title: "",
  body: "",
  type: "INFO" as AnnouncementType,
  priority: "NORMAL" as AnnouncementPriority,
  audience: "ALL",
  publishNow: false,
  publishAt: "",
  expireAt: "",
};

export default function AdminAnnouncementsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<AnnouncementStatus | "ALL">("ALL");
  const [composing, setComposing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: () => api.get<{ items: Announcement[] }>("/api/admin/announcements"),
  });

  const items = useMemo(() => {
    const all = data?.items ?? [];
    return filter === "ALL" ? all : all.filter((a) => a.status === filter);
  }, [data, filter]);

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<Announcement>("/api/admin/announcements", {
        ...form,
        publishAt: form.publishAt || null,
        expireAt: form.expireAt || null,
      }),
    onSuccess: () => {
      toast("Announcement created", "success");
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      setComposing(false);
      setForm(emptyForm);
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Failed to create announcement", "error"),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/admin/announcements/${id}/publish`),
    onSuccess: () => {
      toast("Announcement published", "success");
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/announcements/${id}`),
    onSuccess: () => {
      toast("Announcement deleted", "success");
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
    },
  });

  return (
    <main className="flex-1 overflow-y-auto p-4 lg:p-6">
      <AdminPageHeader
        icon={Megaphone}
        title="Announcements"
        description="Platform-wide content shown to every user — never mixed with financial data."
        action={
          <Button size="sm" onClick={() => { setComposing((v) => !v); setEditingId(null); setForm(emptyForm); }}>
            {composing ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {composing ? "Cancel" : "New Announcement"}
          </Button>
        }
      />

      {composing && (
        <div className="cc-panel cc-glow mb-5 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="cc-mono col-span-2 rounded border bg-transparent px-3 py-2 text-sm"
              style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }}
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <textarea
              className="cc-mono col-span-2 min-h-[90px] rounded border bg-transparent px-3 py-2 text-sm"
              style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }}
              placeholder="Body"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />
            <select
              className="cc-mono rounded border bg-transparent px-3 py-2 text-sm"
              style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }}
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AnnouncementType }))}
            >
              {["INFO", "UPDATE", "MAINTENANCE", "SECURITY", "FEATURE", "IMPORTANT"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              className="cc-mono rounded border bg-transparent px-3 py-2 text-sm"
              style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }}
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as AnnouncementPriority }))}
            >
              {["NORMAL", "IMPORTANT", "URGENT"].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <label className="cc-mono flex items-center gap-2 text-xs" style={{ color: "var(--cc-text-dim)" }}>
              <input type="checkbox" checked={form.publishNow} onChange={(e) => setForm((f) => ({ ...f, publishNow: e.target.checked }))} />
              Publish immediately
            </label>
            {!form.publishNow && (
              <input
                type="datetime-local"
                className="cc-mono rounded border bg-transparent px-3 py-2 text-sm"
                style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }}
                value={form.publishAt}
                onChange={(e) => setForm((f) => ({ ...f, publishAt: e.target.value }))}
              />
            )}
            <label className="cc-mono flex items-center gap-2 text-xs" style={{ color: "var(--cc-text-dim)" }}>
              Expires
            </label>
            <input
              type="datetime-local"
              className="cc-mono rounded border bg-transparent px-3 py-2 text-sm"
              style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }}
              value={form.expireAt}
              onChange={(e) => setForm((f) => ({ ...f, expireAt: e.target.value }))}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              disabled={!form.title.trim() || !form.body.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              <Send className="h-4 w-4" /> {form.publishNow ? "Publish" : form.publishAt ? "Schedule" : "Save Draft"}
            </Button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="cc-mono min-h-[44px] rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors sm:min-h-0"
            style={{
              background: filter === f ? "var(--cc-accent-dim)" : "transparent",
              color: filter === f ? "var(--cc-accent)" : "var(--cc-text-faint)",
              border: "1px solid var(--cc-border)",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="cc-panel h-20 animate-pulse" />)}</div>
        ) : items.length === 0 ? (
          <div className="cc-panel p-8 text-center text-sm cc-mono" style={{ color: "var(--cc-text-faint)" }}>
            No announcements{filter !== "ALL" ? ` with status ${filter}` : ""}.
          </div>
        ) : (
          items.map((a) => (
            <div key={a.id} className="cc-panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="cc-status-dot" style={{ background: STATUS_COLOR[a.status] }} />
                    <span className="cc-mono text-[10px] font-semibold uppercase tracking-widest" style={{ color: STATUS_COLOR[a.status] }}>
                      {a.status}
                    </span>
                    <span className="cc-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--cc-text-faint)" }}>
                      {a.type} · {a.priority} · {a.audience}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold" style={{ color: "var(--cc-text)" }}>{a.title}</p>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--cc-text-dim)" }}>{a.body}</p>
                  <p className="cc-mono mt-1 text-[10px]" style={{ color: "var(--cc-text-faint)" }}>
                    Created {formatDateIN(a.createdAt)}{a.publishAt ? ` · Publish ${formatDateIN(a.publishAt)}` : ""}{a.expireAt ? ` · Expires ${formatDateIN(a.expireAt)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {a.status !== "PUBLISHED" && a.status !== "EXPIRED" && (
                    <button
                      onClick={() => publishMutation.mutate(a.id)}
                      className="rounded p-1.5 hover:bg-white/5"
                      style={{ color: "var(--cc-green)" }}
                      aria-label="Publish now"
                      title="Publish now"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(`Delete announcement "${a.title}"? This cannot be undone.`)) deleteMutation.mutate(a.id);
                    }}
                    className="rounded p-1.5 hover:bg-white/5"
                    style={{ color: "var(--cc-red)" }}
                    aria-label="Delete"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
