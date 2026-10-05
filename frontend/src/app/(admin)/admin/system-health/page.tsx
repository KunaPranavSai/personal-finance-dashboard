"use client";

import Link from "next/link";
import { Clock, Database, HardDrive, Mail } from "lucide-react";
import { Alert, Badge, ErrorState, PageHeader, Panel, Skeleton, Stat } from "@/components/admin/ui";
import { useAdminStats } from "@/lib/adminHooks";
import { fmtNumber, fmtUptime } from "@/lib/adminFormat";

/** System health and third-party integrations in one place (these used to be two pages showing the same checks). */
export default function AdminSystemHealthPage() {
  const { data, isLoading, isError, refetch } = useAdminStats(30_000);
  if (isError) return <><PageHeader title="Health & Integrations" /><ErrorState onRetry={() => void refetch()} /></>;
  const h = data?.systemHealth;
  const dbOk = h?.database.status === "ok";
  const emailOk = h?.email.status === "configured";
  const driveOk = h?.driveApi.status === "configured";

  return (
    <>
      <PageHeader title="Health & Integrations" description="Live checks of the services Penny Pilot depends on. Refreshes every 30 seconds." />
      {h && (!dbOk || !emailOk || !driveOk) && (
        <div className="mb-4 grid gap-2">
          {!dbOk && <Alert tone="error" title="Database check failed">The API could not reach the database.</Alert>}
          {!emailOk && <Alert tone="warn" title="Email is not configured">No Resend API key is set on the server, so no emails can be sent.</Alert>}
          {!driveOk && <Alert tone="warn" title="Google Drive is not configured">Google OAuth credentials are missing on the server, so users cannot connect Drive.</Alert>}
        </div>
      )}
      <div className="ad-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
        {isLoading || !h ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={92} className="rounded-xl" />) : (
          <>
            <Stat label="Database" icon={Database} tone={dbOk ? "green" : "red"} value={dbOk ? "Healthy" : "Issue"} hint={h.database.latencyMs != null ? `${h.database.latencyMs} ms response` : undefined} />
            <Stat label="Email (Resend)" icon={Mail} tone={emailOk ? "green" : "red"} value={emailOk ? "Configured" : "Not set"} href="/admin/automated-emails" hint="Open Email Automations" />
            <Stat label="Google Drive API" icon={HardDrive} tone={driveOk ? "green" : "red"} value={driveOk ? "Configured" : "Not set"} hint={data ? `${fmtNumber(data.driveConnectedCount)} accounts connected` : undefined} href="/admin/migration" />
            <Stat label="Backend uptime" icon={Clock} value={fmtUptime(h.uptimeSeconds)} hint="Since the last restart" />
          </>
        )}
      </div>
      <Panel title="Notes" className="mt-4">
        <ul className="m-0 grid gap-2 pl-5">
          <li>Google Drive tokens are never shown here, and administrators cannot open a user&apos;s Drive.</li>
          <li>Background jobs are not monitored because no job runner exists yet. This page only shows checks that really run.</li>
          <li>Sender address, support email and app URL are edited in <Link href="/admin/settings" className="underline">System Settings</Link>. Secrets such as API keys stay in the server environment. <Badge tone="blue">Read-only here</Badge></li>
        </ul>
      </Panel>
    </>
  );
}
