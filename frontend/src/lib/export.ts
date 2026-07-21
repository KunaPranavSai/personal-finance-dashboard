import { API_BASE_URL } from "./api";

export async function downloadExport(
  format: string,
  toast?: (msg: string, type: "success" | "error") => void,
  range?: { from?: string; to?: string },
  types?: string[]
) {
  try {
    const params = new URLSearchParams({ format: format === "excel" ? "xlsx" : format });
    if (range?.from) params.set("from", range.from);
    if (range?.to) params.set("to", range.to);
    if (types && types.length > 0) params.set("types", types.join(","));
    const res = await fetch(
      `${API_BASE_URL}/api/export?${params.toString()}`,
      { credentials: "include" }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Export failed" }));
      throw new Error(err.error || `Export failed (${res.status})`);
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?(.+?)"?$/);
    const ext = format === "excel" ? "xlsx" : format;
    const filename = match
      ? match[1]
      : `finance-export-${new Date().toISOString().split("T")[0]}.${ext}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast?.(`${format.toUpperCase()} downloaded successfully`, "success");

    return filename;
  } catch (err) {
    toast?.(
      err instanceof Error ? err.message : "Download failed",
      "error"
    );
    throw err;
  }
}
