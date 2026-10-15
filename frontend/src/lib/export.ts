import { api, API_BASE_URL } from "./api";

const EXPORT_TIMEOUT_MS = 120_000; // building a large PDF/XLSX from Drive can take a while; do not hang forever

export async function downloadExport(
  format: string,
  toast?: (msg: string, type: "success" | "error") => void,
  range?: { from?: string; to?: string; categoryId?: string; accountId?: string; paymentMethodTypeId?: string },
  types?: string[],
  kinds?: string[]
) {
  try {
    const params = new URLSearchParams({ format: format === "excel" ? "xlsx" : format });
    if (range?.from) params.set("from", range.from);
    if (range?.to) params.set("to", range.to);
    if (range?.categoryId) params.set("categoryId", range.categoryId);
    if (range?.accountId) params.set("accountId", range.accountId);
    if (range?.paymentMethodTypeId) params.set("paymentMethodTypeId", range.paymentMethodTypeId);
    if (types && types.length > 0) params.set("types", types.join(","));
    if (kinds && kinds.length > 0) params.set("kinds", kinds.join(","));
    const endpoint = `${API_BASE_URL}/api/export?${params.toString()}`;
    const attempt = async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), EXPORT_TIMEOUT_MS);
      try {
        return await fetch(endpoint, { credentials: "include", signal: ctrl.signal });
      } catch (e) {
        if ((e as Error).name === "AbortError") throw new Error("The export took too long and was stopped. Try a smaller date range or fewer data types.");
        throw new Error("Couldn't reach the server. Check your connection and try again.");
      } finally {
        clearTimeout(timer);
      }
    };
    let res = await attempt();
    if (res.status === 401) {
      // This raw fetch bypasses the API client's silent token refresh. One authenticated call through the client
      // refreshes the session (or ends it properly); then try once more.
      await api.get("/api/auth/me").catch(() => {});
      res = await attempt();
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "" }));
      throw new Error(err.error || (res.status === 401 ? "Your session has ended. Please sign in again." : `Export failed (${res.status}).`));
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
    // The file was fully received and handed to the browser; where it is saved is up to the browser.
    toast?.(`${format.toUpperCase()} export ready: ${filename}`, "success");

    return filename;
  } catch (err) {
    toast?.(
      err instanceof Error ? err.message : "Download failed",
      "error"
    );
    throw err;
  }
}
