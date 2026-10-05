"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { Alert, Badge, Button, Column, DataTable, EmptyState, Modal, PageHeader, Panel, Switch, TextField } from "@/components/admin/ui";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { fmtDateTime } from "@/lib/adminFormat";

interface Item {
  key: string; name: string; description: string; audience: "user" | "admin"; locked: boolean; enabled: boolean; updatedAt: string | null;
  design: { kind: "built-in" | "custom" | "legacy"; version?: number };
  stats30d: { sent: number; failed: number; skipped: number };
}

export default function AutomatedEmailsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isSuper = user?.role === "SUPER_ADMIN";
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [testing, setTesting] = useState<Item | null>(null);
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["admin", "automated-emails"], queryFn: () => api.get<{ items: Item[] }>("/api/admin/automated-emails") });
  const stale = () => void queryClient.invalidateQueries({ queryKey: ["admin", "automated-emails"] });

  const toggle = async (it: Item, enabled: boolean) => {
    setBusyKey(it.key);
    try {
      await api.patch(`/api/admin/automated-emails/${it.key}`, { enabled });
      toast(`${it.name} is now ${enabled ? "on" : "off"}`, "success");
      stale();
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't change that setting", "error"); } finally { setBusyKey(null); }
  };

  const sendTest = async () => {
    if (!testing) return;
    setSending(true);
    try {
      const r = await api.post<{ emailSent: boolean }>(`/api/admin/email-builder/${testing.key}/test`, { to });
      if (r.emailSent) { toast(`Test email sent to ${to}`, "success"); setTesting(null); } else toast("The email could not be sent. Check the sender settings and Resend key.", "error");
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't send the test", "error"); } finally { setSending(false); }
  };

  const columns: Column<Item>[] = [
    { key: "name", header: "Email", primary: true, render: (i) => (
      <div className="min-w-0">
        <div className="font-semibold">{i.name} {i.audience === "admin" && <Badge tone="blue">Admins</Badge>}</div>
        <div className="ad-faint text-xs">{i.description}</div>
      </div>
    ) },
    { key: "on", header: "Status", render: (i) => (i.locked ? (
      <span title="Needed to sign in or recover an account, so it cannot be turned off"><Badge tone="blue">Always on</Badge></span>
    ) : (
      <span className="inline-flex items-center gap-2">
        <Switch label={`${i.name}: ${i.enabled ? "on" : "off"}`} checked={i.enabled} disabled={!isSuper || busyKey === i.key} onChange={(v) => void toggle(i, v)} />
        <span className="ad-muted">{i.enabled ? "On" : "Off"}</span>
      </span>
    )) },
    { key: "design", header: "Design", render: (i) => <Badge tone={i.design.kind === "custom" ? "accent" : i.design.kind === "legacy" ? "amber" : ""}>{i.design.kind === "custom" ? `Custom v${i.design.version}` : i.design.kind === "legacy" ? "Legacy HTML" : "Built-in"}</Badge> },
    { key: "recent", header: "Last 30 days", render: (i) => (
      <span className="text-[13px]"><span style={{ color: "var(--ad-green)" }}>{i.stats30d.sent} sent</span>{i.stats30d.failed > 0 && <span style={{ color: "var(--ad-red)" }}> · {i.stats30d.failed} failed</span>}{i.stats30d.skipped > 0 && <span className="ad-faint"> · {i.stats30d.skipped} skipped</span>}</span>
    ) },
    { key: "upd", header: "Last updated", render: (i) => (i.updatedAt ? fmtDateTime(i.updatedAt) : <span className="ad-faint">Never changed</span>) },
    { key: "act", header: "Actions", hideLabelOnCard: true, align: "right", render: (i) => (
      <span className="inline-flex flex-wrap justify-end gap-2">
        {isSuper && <Link className="ad-btn sm" href={`/admin/email-builder/${i.key}`}>Edit</Link>}
        {isSuper && <Button size="sm" onClick={() => { setTesting(i); setTo(user?.email ?? ""); }}>Send test</Button>}
      </span>
    ) },
  ];

  return (
    <>
      <PageHeader title="Email Automations" description="Every email Penny Pilot sends automatically. Turn them on or off, edit the design, and send yourself a test." />
      <div className="mb-4 grid gap-2">
        <Alert>Resend&apos;s free plan has a small daily limit, so an email that is switched off is never sent, queued or retried. Each event sends exactly one email.</Alert>
        {!isSuper && <Alert tone="warn">Only a Super Admin can switch emails on or off, edit them, or send tests. You can see their status here.</Alert>}
      </div>
      <Panel padded={false}>
        <DataTable<Item> caption="Automated emails" columns={columns} rows={data?.items} rowKey={(i) => i.key} loading={isLoading}
          error={isError ? "Couldn't load email automations" : null} onRetry={() => void refetch()} empty={<EmptyState icon={Mail} title="No automated emails" />} />
      </Panel>

      <Modal open={testing !== null} onClose={() => setTesting(null)} title={`Send a test: ${testing?.name ?? ""}`}
        description="Sends the live version of this email with sample data. The subject starts with [Test]. Counts toward your Resend limit."
        footer={<><Button onClick={() => setTesting(null)}>Cancel</Button><Button variant="primary" loading={sending} disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)} onClick={() => void sendTest()}>Send test email</Button></>}>
        <TextField label="Send to" type="email" value={to} onChange={(e) => setTo(e.target.value)} data-autofocus />
      </Modal>
    </>
  );
}
