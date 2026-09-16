"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MobileShell } from "@/components/mobile/MobileShell";
import { LoadingCard, EmptyCard } from "@/components/mobile/MobileStates";
import { ConfirmSheet } from "@/components/mobile/ConfirmSheet";
import { api } from "@/lib/api";
import { useNotifications } from "@/lib/reference";
import { formatDateIN } from "@/lib/format";

const TYPE_ICON: Record<string, string> = {
  budget_alert: "⚠️",
  bill_due: "🧾",
  goal_progress: "🎯",
  insight: "💡",
};
const TYPE_LABEL: Record<string, string> = {
  budget_alert: "Budget Alert",
  bill_due: "Bill Due",
  goal_progress: "Goal Progress",
  insight: "Insight",
};

/** Mobile "Notifications" screen — same /api/notifications actions as the
 * desktop page (mark one/all read, delete one/clear all), reached from the
 * bell icon in every /m/* app bar. */
export default function MobileNotificationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useNotifications();
  const [clearAllOpen, setClearAllOpen] = useState(false);

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
          {unreadCount > 0 && <button type="button" className="ppm-link-btn" onClick={() => markAllReadMutation.mutate()}>Mark all read</button>}
          {items.length > 0 && <button type="button" className="ppm-link-btn" style={{ color: "var(--ppm-critical)" }} onClick={() => setClearAllOpen(true)}>Clear all</button>}
        </div>
      </div>

      {isLoading && <LoadingCard lines={4} />}
      {!isLoading && items.length === 0 && (
        <EmptyCard icon="🔔" title="No notifications yet" subtitle="You'll see budget alerts, bill reminders and insights here." />
      )}

      {!isLoading && items.length > 0 && (
        <div className="ppm-card">
          {items.map((n) => (
            <div className="ppm-list-item" key={n.id} style={{ alignItems: "flex-start", background: n.read ? "transparent" : "var(--ppm-chip-bg)", borderRadius: n.read ? 0 : 12, cursor: "default" }}>
              <div className="ppm-ic" aria-hidden="true">{TYPE_ICON[n.type] ?? "🔔"}</div>
              <div className="ppm-info">
                <div className="ppm-meta" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {TYPE_LABEL[n.type] ?? n.type}
                  {!n.read && <span className="ppm-badge">New</span>}
                </div>
                <div className="ppm-name">{n.title}</div>
                <div className="ppm-meta">{n.message}</div>
                <div className="ppm-meta" style={{ opacity: 0.7 }}>{formatDateIN(n.createdAt)}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {!n.read && (
                  <button type="button" className="ppm-chev" aria-label="Mark as read" onClick={() => markReadMutation.mutate(n.id)}>✓</button>
                )}
                <button type="button" className="ppm-chev" aria-label="Delete" onClick={() => deleteMutation.mutate(n.id)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

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
