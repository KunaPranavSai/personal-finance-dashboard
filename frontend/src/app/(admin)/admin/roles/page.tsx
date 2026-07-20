"use client";

import { useQuery } from "@tanstack/react-query";
import { Crown, ShieldCheck, User as UserIcon, Check, Minus } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { ManagedUser } from "@/components/admin/UserManagementShared";

const PERMISSIONS = ["Create", "Edit", "Delete", "Approve", "Reports", "Export", "System Settings"];

const ROLE_CARDS = [
  {
    role: "SUPER_ADMIN",
    label: "Super Admin",
    icon: Crown,
    description: "Complete platform administration — user management, approvals, roles, security, reports, backups, system settings, and audit logs.",
    grants: [true, true, true, true, true, true, true],
  },
  {
    role: "ADMIN",
    label: "Admin",
    icon: ShieldCheck,
    description: "Delegated administration assigned by a Super Admin — manages users and approvals. Cannot grant Super Admin access or change system settings.",
    grants: [true, true, true, true, true, true, false],
  },
  {
    role: "USER",
    label: "User",
    icon: UserIcon,
    description: "Access to their own personal financial data only — transactions, budgets, investments, bills, and goals. No administrative access.",
    grants: [true, true, true, false, false, true, false],
  },
] as const;

export default function AdminRolesPage() {
  const { data } = useQuery({
    queryKey: ["users-all"],
    queryFn: () => api.get<{ items: ManagedUser[] }>("/api/auth/users"),
  });

  const counts = (role: string) => (data?.items ?? []).filter((u) => u.role === role).length;

  return (
    <>
      <Topbar title="Roles & Permissions" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {ROLE_CARDS.map((r) => (
            <Card key={r.role}>
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal/10 text-teal">
                  <r.icon className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>{r.label}</CardTitle>
                  <p className="text-xs text-navy/50 dark:text-white/50">{counts(r.role)} user{counts(r.role) === 1 ? "" : "s"}</p>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-navy/60 dark:text-white/60">{r.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-6">
          <CardHeader><CardTitle>Permission Matrix</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/5 dark:border-white/10 text-left text-navy/50 dark:text-white/50">
                    <th className="pb-2 pr-3 font-medium">Permission</th>
                    {ROLE_CARDS.map((r) => <th key={r.role} className="pb-2 px-3 font-medium text-center">{r.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSIONS.map((p, i) => (
                    <tr key={p} className="border-b border-black/5 dark:border-white/5">
                      <td className="py-2 pr-3 text-navy dark:text-white">{p}</td>
                      {ROLE_CARDS.map((r) => (
                        <td key={r.role} className="py-2 px-3 text-center">
                          {r.grants[i] ? <Check className="mx-auto h-4 w-4 text-teal" /> : <Minus className="mx-auto h-4 w-4 text-navy/20 dark:text-white/20" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-navy/40 dark:text-white/40">
              This reflects what&apos;s currently enforced by the API. Per-admin customizable permission toggles are planned for a future update.
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
