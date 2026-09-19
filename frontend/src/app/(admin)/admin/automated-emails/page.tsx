"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Zap, ShieldCheck, Power, RotateCcw, Info } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";

interface AutomationRule {
  key: string;
  name: string;
  securityCritical: boolean;
  templateKey: string;
  enabled: boolean;
  updatedAt: string | null;
}

/**
 * Communication → Automated Emails. Reflects the 6 real sendEmail(...) call sites in
 * auth.routes.ts (grouped as 5 triggers — the password-reset-OTP request and resend call sites
 * share one "recovery_otp" trigger since they're the same email). Only "Account Updated by
 * Admin" is actually disable-able — the other 4 are security-critical and always send
 * regardless of this toggle, disclosed per row rather than letting the switch imply otherwise.
 */
export default function AdminAutomatedEmailsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-automated-emails"],
    queryFn: () => api.get<{ items: AutomationRule[] }>("/api/admin/automated-emails"),
  });

  const toggle = async (rule: AutomationRule) => {
    setBusyKey(rule.key);
    try {
      await api.patch(`/api/admin/automated-emails/${rule.key}`, { enabled: !rule.enabled });
      toast(rule.enabled ? "Rule disabled" : "Rule enabled", "success");
      queryClient.invalidateQueries({ queryKey: ["admin-automated-emails"] });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update rule", "error");
    } finally {
      setBusyKey(null);
    }
  };

  const reset = async (rule: AutomationRule) => {
    setBusyKey(rule.key);
    try {
      await api.delete(`/api/admin/automated-emails/${rule.key}`);
      toast("Reset to defaults", "success");
      queryClient.invalidateQueries({ queryKey: ["admin-automated-emails"] });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to reset rule", "error");
    } finally {
      setBusyKey(null);
    }
  };

  const items = data?.items ?? [];

  return (
    <>
      <Topbar title="Automated Emails" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <AdminPageHeader icon={Zap} title="Automated Emails" description="Real backend triggers only — every row below is a genuine sendEmail(...) call site." />

        <div className="cc-panel mb-4 flex items-start gap-2 p-3">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--cc-text-faint)" }} />
          <p className="text-xs" style={{ color: "var(--cc-text-faint)" }}>
            Security-critical triggers (password resets, security codes, admin-issued credential changes) always send
            regardless of Enable/Disable — this cannot be turned off from here, by design. Disabling also respects each
            recipient&apos;s Access &amp; Entitlements email-eligibility flag, except for security-critical triggers, which
            are never suppressed.
          </p>
        </div>

        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <div key={i} className="cc-panel h-16 animate-pulse" />)
          ) : (
            items.map((rule) => (
              <div key={rule.key} className="cc-panel flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold" style={{ color: "var(--cc-text)" }}>{rule.name}</p>
                    {rule.securityCritical && (
                      <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ background: "rgba(52,211,153,0.12)", color: "var(--cc-green)" }}>
                        <ShieldCheck className="h-3 w-3" /> Always Sends
                      </span>
                    )}
                  </div>
                  <p className="cc-mono mt-1 text-[10px]" style={{ color: "var(--cc-text-faint)" }}>
                    trigger: {rule.key} · template: {rule.templateKey}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggle(rule)}
                    disabled={busyKey === rule.key || rule.securityCritical}
                    className="cc-mono flex min-h-[44px] items-center gap-1.5 rounded border px-3 py-1.5 text-xs disabled:opacity-40 sm:min-h-0"
                    style={{ borderColor: "var(--cc-border)", color: rule.enabled ? "var(--cc-green)" : "var(--cc-text-faint)" }}
                    title={rule.securityCritical ? "Security-critical — cannot be disabled" : undefined}
                  >
                    <Power className="h-3.5 w-3.5" /> {rule.enabled ? "Enabled" : "Disabled"}
                  </button>
                  <button
                    onClick={() => reset(rule)}
                    disabled={busyKey === rule.key}
                    className="cc-mono flex min-h-[44px] items-center gap-1.5 rounded border px-3 py-1.5 text-xs disabled:opacity-40 sm:min-h-0"
                    style={{ borderColor: "var(--cc-border)", color: "var(--cc-text-dim)" }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </>
  );
}
