"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Users, UserPlus, ShieldAlert, Clock, Download } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { api, API_BASE_URL } from "@/lib/api";
import { cn } from "@/lib/format";

type ReportType = "users" | "signups" | "security" | "pending";

interface ReportTable {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

const REPORT_TYPES: { id: ReportType; label: string; icon: typeof Users }[] = [
  { id: "users", label: "Users", icon: Users },
  { id: "signups", label: "Signups", icon: UserPlus },
  { id: "security", label: "Security Events", icon: ShieldAlert },
  { id: "pending", label: "Pending Approvals", icon: Clock },
];

const FORMATS = ["csv", "xlsx", "json", "pdf"];
const selectCls = "rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white";

export default function AdminReportsPage() {
  const [type, setType] = useState<ReportType>("users");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-report", type, from, to],
    queryFn: () => api.get<ReportTable>(`/api/admin/reports/${type}${params.toString() ? `?${params.toString()}` : ""}`),
  });

  const handleDownload = async (format: string) => {
    setDownloading(format);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/reports/${type}/export?format=${format}${params.toString() ? `&${params.toString()}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?(.+?)"?$/);
      const filename = match ? match[1] : `${type}-report.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <>
      <Topbar title="Reports" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <AdminPageHeader icon={FileText} title="Reports" description="Generate and export platform-wide reports." />

        <Card className="mb-4">
          <CardContent className="pt-5">
            <div className="flex flex-wrap gap-2">
              {REPORT_TYPES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setType(r.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all",
                    type === r.id ? "border-teal bg-teal/10 text-teal" : "border-black/10 text-navy hover:border-teal/50 dark:border-white/10 dark:text-white"
                  )}
                >
                  <r.icon className="h-4 w-4" /> {r.label}
                </button>
              ))}
            </div>
            {(type === "users" || type === "signups" || type === "security") && (
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-navy/50 dark:text-white/50">From</label>
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={selectCls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-navy/50 dark:text-white/50">To</label>
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={selectCls} />
                </div>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {FORMATS.map((f) => (
                <Button key={f} type="button" size="sm" variant="secondary" onClick={() => handleDownload(f)} disabled={downloading !== null}>
                  <Download className="h-3.5 w-3.5" /> {downloading === f ? "Downloading…" : f.toUpperCase()}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />)}</div>
            ) : !data || data.rows.length === 0 ? (
              <EmptyState icon={FileText} title="No records" description="No data matches this report and date range." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/5 dark:border-white/10 text-left text-navy/50 dark:text-white/50">
                      {data.headers.map((h) => <th key={h} className="pb-2 pr-3 font-medium">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.slice(0, 100).map((row, i) => (
                      <tr key={i} className="border-b border-black/5 dark:border-white/5">
                        {row.map((cell, j) => <td key={j} className="py-2 pr-3 text-navy/70 dark:text-white/70 whitespace-nowrap">{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.rows.length > 100 && (
                  <p className="mt-3 text-center text-xs text-navy/40 dark:text-white/40">Showing first 100 of {data.rows.length} rows — download for the full report.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
