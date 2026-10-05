"use client";

import { useQuery } from "@tanstack/react-query";
import { Monitor } from "lucide-react";
import { Badge, EmptyState, ErrorState, PageHeader, Panel, Skeleton } from "@/components/admin/ui";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/adminFormat";

interface SessionRow {
  id: string; browser: string | null; os: string | null; device: string | null; ip: string | null;
  createdAt: string; lastSeenAt: string; revokedAt: string | null; current: boolean;
}

export default function AdminSessionsPage() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["admin", "my-sessions"], queryFn: () => api.get<{ items: SessionRow[] }>("/api/auth/sessions") });
  return (
    <>
      <PageHeader title="My Sessions" description="Where your administrator account is signed in. Only one device stays signed in: signing in elsewhere ends the previous session." />
      <Panel padded={false}>
        {isError ? <ErrorState onRetry={() => void refetch()} /> : isLoading ? <Skeleton h={120} className="m-4" /> : !data || data.items.length === 0 ? (
          <EmptyState icon={Monitor} title="No sessions yet" description="Sessions appear after you sign in." />
        ) : (
          <ul className="m-0 list-none p-0 px-4">
            {data.items.map((s) => (
              <li key={s.id} className="ad-row">
                <Monitor size={18} className="ad-faint shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{[s.browser, s.os].filter(Boolean).join(" on ") || "Unknown device"}</div>
                  <div className="ad-faint text-xs">{s.ip ?? "Unknown IP"} · started {fmtDateTime(s.createdAt)}{s.revokedAt ? ` · signed out ${fmtDateTime(s.revokedAt)}` : ` · last seen ${fmtDateTime(s.lastSeenAt)}`}</div>
                </div>
                {s.current ? <Badge tone="green">This device</Badge> : s.revokedAt ? <Badge>Signed out</Badge> : <Badge tone="blue">Active</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
