"use client";

import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Timeline, TimelineEvent } from "@/components/admin/Timeline";
import { api } from "@/lib/api";

const AUDIT_EVENTS = [
  "user_approved", "user_rejected", "user_deleted", "user_updated",
  "password_reset_by_admin", "uid_reset_by_admin", "force_logout_by_admin",
  "platform_settings_updated", "platform_backup_downloaded",
];

interface AdminActivityItem {
  id: string;
  event: string;
  detail?: string | null;
  createdAt: string;
  user: { name: string; email: string; uid: string } | null;
}

export default function AdminAuditPage() {
  const params = new URLSearchParams({ pageSize: "100" });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit"],
    // The activity endpoint filters by a single `event`; fetch all admin-action events in
    // parallel and merge, since there's no `event=a,b,c` support (keeps the backend query simple).
    queryFn: async () => {
      const results = await Promise.all(
        AUDIT_EVENTS.map((event) => api.get<{ items: AdminActivityItem[] }>(`/api/admin/activity?event=${event}&${params.toString()}`))
      );
      return results.flatMap((r) => r.items).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
  });

  const items: TimelineEvent[] = (data ?? []).map((a) => ({
    id: a.id, event: a.event, detail: a.detail, createdAt: a.createdAt,
    actorLabel: a.user ? `Acted by ${a.user.name} (${a.user.email})` : null,
  }));

  return (
    <>
      <Topbar title="Audit Dashboard" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <AdminPageHeader
          icon={ClipboardList}
          title="Audit Dashboard"
          description="Who approved whom, who deleted users, who changed permissions or platform settings."
        />
        <Card>
          <CardContent className="pt-5">
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />)}</div>
            ) : items.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No audit events yet" description="Admin actions like approvals, deletions, and settings changes will appear here." />
            ) : (
              <Timeline items={items} />
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
