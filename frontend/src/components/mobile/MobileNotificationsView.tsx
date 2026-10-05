"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MobileShell } from "@/components/mobile/MobileShell";
import { LoadingCard, EmptyCard } from "@/components/mobile/MobileStates";
import { ConfirmSheet } from "@/components/mobile/ConfirmSheet";
import { api } from "@/lib/api";
import { useNotifications } from "@/lib/reference";
import { formatDateIN } from "@/lib/format";
import { AlertTriangle, Receipt, Target, Lightbulb, Bell, Trash2, Megaphone } from "lucide-react";

const TYPE_ICON: Record<string, React.ReactNode> = {
  budget_alert: <AlertTriangle size={18} />,
  bill_due: <Receipt size={18} />,
  goal_progress: <Target size={18} />,
  insight: <Lightbulb size={18} />,
};
const TYPE_LABEL: Record<string, string> = {
  budget_alert: "Budget Alert",
  bill_due: "Bill Due",
  goal_progress: "Goal Progress",
  insight: "Insight",
};

interface AnnouncementItem { id: string; title: string; body: string; type: string; priority: string; publishAt: string | null; createdAt: string }

/** Platform announcements published by admins (GET /api/notifications/announcements). */
function MobileAnnouncements() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => api.get<{ items: AnnouncementItem[] }>("/api/notifications/announcements"),
  });
  const items = data?.items ?? [];
  if (isLoading) return <LoadingCard lines={3} />;
  if (isError) return <EmptyCard icon={<Megaphone size={22} />} title="Couldn't load announcements" subtitle="Check your connection and try again." />;
  if (items.length === 0) return <EmptyCard icon={<Megaphone size={22} />} title="No announcements" subtitle="Platform updates will show up here." />;
  return (
    <div className="ppm-card">
      {items.map((a) => (
        <div className="ppm-list-item" key={a.id} style={{ alignItems: "flex-start", cursor: "default" }}>
          <div className="ppm-ic" aria-hidden="true"><Megaphone size={18} /></div>
          <div className="ppm-info">
            <div className="ppm-meta" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {a.type.charAt(0) + a.type.slice(1).toLowerCase()}
              {a.priority !== "NORMAL" && <span className="ppm-badge">{a.priority.charAt(0) + a.priority.slice(1).toLowerCase()}</span>}
            </div>
            <div className="ppm-name" style={{ whiteSpace: "normal", overflow: "visible", textOverflow: "clip" }}>{a.title}</div>
            <div className="ppm-meta ppm-meta-wrap">{a.body}</div>
            <div className="ppm-meta" style={{ opacity: 0.7 }}>{formatDateIN(a.publishAt ?? a.createdAt)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Mobile "Notifications" screen — same /api/notifications actions as the
 * desktop page (mark one/all read, delete one/clear all), reached from the
 * bell icon in every MobileShell app bar. */
export function MobileNotificationsView() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useNotifications();
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [tab, setTab] = useState<"personal" | "announcements">("personal");

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markAllReadMutation = useMutation({
    mutationFn: () => api.post("/api/notifications/mark-all-read"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/notifications/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const clearAllMutation = useMutation({
    mutationFn: () => api.delete("/api/notifications"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["notifications"] }); setClearAllOpen(false); },
  });

  const items = data?.items ?? [];
  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <MobileShell title="Notifications">
      <div className="ppm-page-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div>
          <h2>Notifications</h2>
          <p>{unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          {tab === "personal" && unreadCount > 0 && <button type="button" className="ppm-link-btn" onClick={() => markAllReadMutation.mutate()}>Mark all read</button>}
          {tab === "personal" && items.length > 0 && <button type="button" className="ppm-link-btn" style={{ color: "var(--ppm-critical)" }} onClick={() => setClearAllOpen(true)}>Clear all</button>}
        </div>
      </div>

      <div role="tablist" aria-label="Notification sections" style={{ display: "flex", gap: 8, margin: "4px 0 12px" }}>
        <button type="button" role="tab" aria-selected={tab === "personal"} className="ppm-link-btn" style={{ fontWeight: tab === "personal" ? 700 : 500, opacity: tab === "personal" ? 1 : 0.7 }} onClick={() => setTab("personal")}>Personal</button>
        <button type="button" role="tab" aria-selected={tab === "announcements"} className="ppm-link-btn" style={{ fontWeight: tab === "announcements" ? 700 : 500, opacity: tab === "announcements" ? 1 : 0.7 }} onClick={() => setTab("announcements")}>Announcements</button>
      </div>
      {tab === "announcements" && <MobileAnnouncements />}
      {tab === "personal" && <>
      {isLoading && <LoadingCard lines={4} />}
      {!isLoading && items.length === 0 && (
        <EmptyCard icon={<Bell size={22} />} title="No notifications yet" subtitle="You'll see budget alerts, bill reminders and insights here." />
      )}

      {!isLoading && items.length > 0 && (
        <div className="ppm-card">
          {items.map((n) => (
            <div className="ppm-list-item" key={n.id} style={{ alignItems: "flex-start", background: n.read ? "transparent" : "var(--ppm-chip-bg)", borderRadius: n.read ? 0 : 12, cursor: "default" }}>
              <div className="ppm-ic" aria-hidden="true">{TYPE_ICON[n.type] ?? <Bell size={18} />}</div>
              <div className="ppm-info">
                <div className="ppm-meta" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {TYPE_LABEL[n.type] ?? n.type}
                  {!n.read && <span className="ppm-badge">New</span>}
                </div>
                <div className="ppm-name">{n.title}</div>
                <div className="ppm-meta ppm-meta-wrap">{n.message}</div>
                <div className="ppm-meta" style={{ opacity: 0.7 }}>{formatDateIN(n.createdAt)}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {!n.read && (
                  <button type="button" className="ppm-row-action" aria-label="Mark as read" onClick={() => markReadMutation.mutate(n.id)}>✓</button>
                )}
                <button type="button" className="ppm-row-action" aria-label="Delete" onClick={() => deleteMutation.mutate(n.id)}><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      </>}

      <ConfirmSheet
        open={clearAllOpen}
        onClose={() => setClearAllOpen(false)}
        onConfirm={() => clearAllMutation.mutate()}
        title="Clear all notifications"
        message="This removes every notification and can't be undone."
        confirmLabel="Clear all"
        isPending={clearAllMutation.isPending}
      />
    </MobileShell>
  );
}
