"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
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
  INFO: <Info className="h-4 w-4 text-blue-500" />,
  UPDATE: <Sparkles className="h-4 w-4 text-teal" />,
  MAINTENANCE: <Wrench className="h-4 w-4 text-yellow-500" />,
  SECURITY: <ShieldAlert className="h-4 w-4 text-red-500" />,
  FEATURE: <Sparkles className="h-4 w-4 text-purple-500" />,
  IMPORTANT: <AlertTriangle className="h-4 w-4 text-orange-500" />,
};

function AnnouncementsList() {
  const { data, isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => api.get<{ items: AnnouncementItem[] }>("/api/notifications/announcements"),
  });
  const items = data?.items ?? [];

  if (isLoading) {
    return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />)}</div>;
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
              <span className="text-xs font-medium text-navy/50 dark:text-white/50">{a.type}</span>
              {a.priority !== "NORMAL" && <Badge tone={a.priority === "URGENT" ? "red" : "yellow"}>{a.priority}</Badge>}
            </div>
            <p className="text-sm font-medium text-navy dark:text-white">{a.title}</p>
            <p className="text-xs text-navy/50 dark:text-white/50">{a.body}</p>
            <p className="mt-1 text-xs text-navy/30 dark:text-white/30">{formatDateIN(a.publishAt ?? a.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

const typeIcons: Record<string, React.ReactNode> = {
  budget_alert: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  bill_due: <Receipt className="h-4 w-4 text-red-500" />,
  goal_progress: <TrendingUp className="h-4 w-4 text-teal" />,
  insight: <Lightbulb className="h-4 w-4 text-yellow-500" />,
};

const typeLabels: Record<string, string> = {
  budget_alert: "Budget Alert",
  bill_due: "Bill Due",
  goal_progress: "Goal Progress",
  insight: "Insight",
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
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
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setTab("personal")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${tab === "personal" ? "bg-teal/10 text-teal" : "text-navy/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/5"}`}
          >
            Personal
          </button>
          <button
            onClick={() => setTab("announcements")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${tab === "announcements" ? "bg-teal/10 text-teal" : "text-navy/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/5"}`}
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
          <p className="text-sm text-navy/50 dark:text-white/50">
            {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}.` : "No unread notifications."}
          </p>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button size="sm" variant="ghost" onClick={() => markAllReadMutation.mutate()}>
                <CheckCheck className="h-4 w-4" /> Mark all read
              </Button>
            )}
            {items.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => { if (confirm("Clear all notifications?")) clearAllMutation.mutate(); }}>
                <Trash2 className="h-4 w-4" /> Clear all
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>All Notifications</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />)}</div>
            ) : items.length === 0 ? (
              <EmptyState icon={Bell} title="No notifications yet" description="You'll see notifications here for budget alerts, bill reminders, and insights." />
            ) : (
              <div className="space-y-2">
                {items.map((n) => (
                  <div key={n.id} className={`flex items-start gap-3 rounded-lg p-3 transition-colors ${n.read ? "" : "bg-teal/5"}`}>
                    <div className="mt-0.5">{typeIcons[n.type]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-navy/50 dark:text-white/50">{typeLabels[n.type]}</span>
                        {!n.read && <Badge tone="teal">New</Badge>}
                      </div>
                      <p className="text-sm font-medium text-navy dark:text-white">{n.title}</p>
                      <p className="text-xs text-navy/50 dark:text-white/50">{n.message}</p>
                      <p className="text-xs text-navy/30 dark:text-white/30 mt-1">{formatDateIN(n.createdAt)}</p>
                    </div>
                    <div className="flex gap-1">
                      {!n.read && (
                        <button onClick={() => markReadMutation.mutate(n.id)} className="rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/10" aria-label="Mark as read">
                          <CheckCheck className="h-4 w-4 text-navy/40 dark:text-white/40" />
                        </button>
                      )}
                      <button onClick={() => deleteMutation.mutate(n.id)} className="rounded-lg p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20" aria-label="Delete notification">
                        <Trash2 className="h-4 w-4 text-red-400" />
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
      </main>
    </>
  );
}
