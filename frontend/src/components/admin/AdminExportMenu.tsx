"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button, Modal } from "@/components/admin/ui";
import { API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/Toast";

/** Branded export of the Users list or Audit log (PDF / Excel / CSV). Super Admin only, matching the server. */
export function AdminExportMenu({ type, from, to }: { type: "users" | "audit"; from?: string; to?: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  if (user?.role !== "SUPER_ADMIN") return null;

  const run = async (format: "pdf" | "xlsx" | "csv") => {
    setBusy(format);
    try {
      const qs = new URLSearchParams({ type, format });
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      const res = await fetch(`${API_BASE_URL}/api/admin/export?${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Export failed (${res.status})`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${type}-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(a.href);
      setOpen(false);
    } catch (e) {
      toast((e as Error).message || "Export failed", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}><Download size={16} aria-hidden="true" />Export</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={type === "users" ? "Export users" : "Export audit log"}
        description={type === "audit" && (from || to) ? "Uses the date range currently selected." : "Choose a format. The file is branded with the site name."}>
        <div className="grid gap-2">
          {(["pdf", "xlsx", "csv"] as const).map((f) => (
            <Button key={f} loading={busy === f} disabled={busy !== null} onClick={() => void run(f)}>
              {f === "pdf" ? "PDF document" : f === "xlsx" ? "Excel workbook" : "CSV file"}
            </Button>
          ))}
        </div>
      </Modal>
    </>
  );
}
