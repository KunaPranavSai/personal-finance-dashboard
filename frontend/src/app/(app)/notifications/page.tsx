"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/AppTopbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/PpCard";
import { Button } from "@/components/ui/PpButton";
import { Badge } from "@/components/ui/PpBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { usePpConfirm } from "@/components/ui/PpConfirm";
import { api } from "@/lib/api";
import { formatDateIN } from "@/lib/format";
import { useNotifications } from "@/lib/reference";
import { Bell, CheckCheck, AlertTriangle, Receipt, TrendingUp, Lightbulb, Trash2, Megaphone, Wrench, ShieldAlert, Sparkles, Info } from "lucide-react";
import { useIsMobile } from "@/lib/DeviceContext";
import { MobileNotificationsView } from "@/components/mobile/MobileNotificationsView";

interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  type: "INFO" | "UPDATE" | "MAINTENANCE" | "SECURITY" | "FEATURE" | "IMPORTANT";
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  publishAt: string | null;
  expireAt: string | null;
  createdAt: string;
}

const announcementIcons: Record<AnnouncementItem["type"], React.ReactNode> = {
  INFO: <Info className="h-4 w-4 text-pp-accent" />,
  UPDATE: <Sparkles className="h-4 w-4 text-pp-accent" />,
  MAINTENANCE: <Wrench className="h-4 w-4 text-turmeric" />,
  SECURITY: <ShieldAlert className="h-4 w-4 text-vulcanico" />,
  FEATURE: <Sparkles className="h-4 w-4 text-pp-accent" />,
  IMPORTANT: <AlertTriangle className="h-4 w-4 text-turmeric" />,
};

function AnnouncementsList() {
  const { data, isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => api.get<{ items: AnnouncementItem[] }>("/api/notifications/announcements"),
  });
  const items = data?.items ?? [];

  if (isLoading) {
    return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-pp-surface-2" />)}</div>;
  }
  if (items.length === 0) {
    return <EmptyState icon={Megaphone} title="No announcements" description="Platform updates and announcements will show up here." />;
  }
  return (
    <div className="space-y-2">
      {items.map((a) => (
        <div key={a.id} className="flex items-start gap-3 rounded-lg p-3">
          <div className="mt-0.5">{announcementIcons[a.type]}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-pp-text-dim">{a.type}</span>
              {a.priority !== "NORMAL" && <Badge tone={a.priority === "URGENT" ? "red" : "yellow"}>{a.priority}</Badge>}
            </div>
            <p className="text-sm font-medium text-pp-text">{a.title}</p>
            <p className="text-xs text-pp-text-dim">{a.body}</p>
            <p className="mt-1 text-xs text-pp-text-dim">{formatDateIN(a.publishAt ?? a.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

const typeIcons: Record<string, React.ReactNode> = {
  budget_alert: <AlertTriangle className="h-4 w-4 text-turmeric" />,
  bill_due: <Receipt className="h-4 w-4 text-vulcanico" />,
  goal_progress: <TrendingUp className="h-4 w-4 text-pp-accent" />,
  insight: <Lightbulb className="h-4 w-4 text-turmeric" />,
};

const typeLabels: Record<string, string> = {
  budget_alert: "Budget Alert",
  bill_due: "Bill Due",
  goal_progress: "Goal Progress",
  insight: "Insight",
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const confirmDialog = usePpConfirm();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<"personal" | "announcements">("personal");

  const { data, isLoading } = useNotifications();

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const items = data?.items ?? [];
  const unreadCount = items.filter((n) => !n.read).length;

  if (isMobile) return <MobileNotificationsView />;

  return (
    <>
      <Topbar title="Notifications" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 2xl:px-10">
        <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex gap-2" role="tablist" aria-label="Notification sections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "personal"}
            onClick={() => setTab("personal")}
            className={`min-h-[40px] rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${tab === "personal" ? "bg-pp-accent/10 text-pp-accent" : "text-pp-text-dim hover:bg-pp-surface-2"}`}
          >
            Personal
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "announcements"}
            onClick={() => setTab("announcements")}
            className={`flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${tab === "announcements" ? "bg-pp-accent/10 text-pp-accent" : "text-pp-text-dim hover:bg-pp-surface-2"}`}
          >
            <Megaphone className="h-3.5 w-3.5" /> Announcements
          </button>
        </div>

        {tab === "announcements" ? (
          <Card>
            <CardHeader><CardTitle>Announcements</CardTitle></CardHeader>
            <CardContent><AnnouncementsList /></CardContent>
          </Card>
        ) : (
        <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-pp-text-dim">
            {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}.` : "No unread notifications."}
          </p>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button size="sm" variant="ghost" onClick={() => markAllReadMutation.mutate()}>
                <CheckCheck className="h-4 w-4" /> Mark all read
              </Button>
            )}
            {items.length > 0 && (
              <Button size="sm" variant="ghost" onClick={async () => { if (await confirmDialog({ message: "Clear all notifications?", danger: false, confirmLabel: "Clear all" })) clearAllMutation.mutate(); }}>
                <Trash2 className="h-4 w-4" /> Clear all
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>All Notifications</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-pp-surface-2" />)}</div>
            ) : items.length === 0 ? (
              <EmptyState icon={Bell} title="No notifications yet" description="You'll see notifications here for budget alerts, bill reminders, and insights." />
            ) : (
              <div className="space-y-2">
                {items.map((n) => (
                  <div key={n.id} className={`flex items-start gap-3 rounded-lg p-3 transition-colors ${n.read ? "" : "bg-pp-accent/5"}`}>
                    <div className="mt-0.5">{typeIcons[n.type]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-pp-text-dim">{typeLabels[n.type]}</span>
                        {!n.read && <Badge tone="teal">New</Badge>}
                      </div>
                      <p className="text-sm font-medium text-pp-text">{n.title}</p>
                      <p className="text-xs text-pp-text-dim">{n.message}</p>
                      <p className="text-xs text-pp-text-dim mt-1">{formatDateIN(n.createdAt)}</p>
                    </div>
                    <div className="flex gap-1">
                      {!n.read && (
                        <button onClick={() => markReadMutation.mutate(n.id)} className="rounded-lg p-1.5 hover:bg-pp-surface-2" aria-label="Mark as read">
                          <CheckCheck className="h-4 w-4 text-pp-text-dim" />
                        </button>
                      )}
                      <button onClick={() => deleteMutation.mutate(n.id)} className="rounded-lg p-1.5 hover:bg-vulcanico/10 dark:hover:bg-vulcanico/20" aria-label="Delete notification">
                        <Trash2 className="h-4 w-4 text-vulcanico" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </>
        )}
        </div>
      </main>
    </>
  );
}
