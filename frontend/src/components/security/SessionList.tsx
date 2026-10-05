"use client";

import { useQuery } from "@tanstack/react-query";
import { Monitor, Smartphone } from "lucide-react";
import { api } from "@/lib/api";
import { LoadingCard, ErrorCard, EmptyCard } from "@/components/mobile/MobileStates";

interface SessionRow {
  id: string;
  browser: string | null;
  os: string | null;
  device: string | null;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
  current: boolean;
}

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** Where the signed-in account is (or was) signed in. Shared by the user and admin Sessions pages. */
export function SessionList() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["sessions"], queryFn: () => api.get<{ items: SessionRow[] }>("/api/auth/sessions") });
  return (
    <>
      <div className="ppm-page-title">
        <h2>Sessions</h2>
        <p>Only one device stays signed in. Signing in elsewhere ends the previous session.</p>
      </div>
      {isLoading && <LoadingCard lines={3} />}
      {isError && <ErrorCard onRetry={() => refetch()} />}
      {data && data.items.length === 0 && <EmptyCard icon={<Monitor size={22} />} title="No sessions yet" subtitle="Sessions appear after you sign in." />}
      {data && data.items.length > 0 && (
        <div className="ppm-card">
          {data.items.map((s) => {
            const Icon = /mobile|phone|android|ios/i.test(`${s.device} ${s.os}`) ? Smartphone : Monitor;
            const state = s.current ? "This device · active" : s.revokedAt ? `Signed out ${when(s.revokedAt)}` : "Active";
            return (
              <div className="ppm-list-item" key={s.id} style={{ cursor: "default" }}>
                <div className="ppm-ic" aria-hidden="true"><Icon size={18} /></div>
                <div className="ppm-info">
                  <div className="ppm-name">{[s.browser, s.os].filter(Boolean).join(" on ") || "Unknown device"}</div>
                  <div className="ppm-meta">{state} · {s.ip ?? "unknown IP"} · started {when(s.createdAt)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
