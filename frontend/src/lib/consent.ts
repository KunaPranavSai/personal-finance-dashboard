import { API_BASE_URL } from "./api";

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function consentFilename(acceptedAt: string | Date): string {
  const d = typeof acceptedAt === "string" ? new Date(acceptedAt) : acceptedAt;
  const dateStr = Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
  return `Penny-Pilot-Signed-Consent-${dateStr}.pdf`;
}

/** Immediate post-signup download — no authenticated session exists yet, so
 * the PDF comes back inline (base64) in the signup response itself rather
 * than from an authenticated endpoint. Returns false (without throwing) if
 * the browser blocks the automatic download, so the caller can fall back to
 * a manual "Download Signed Consent" button. */
export function downloadConsentPdfFromBase64(base64: string, acceptedAt: string): boolean {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/pdf" });
    triggerBlobDownload(blob, consentFilename(acceptedAt));
    return true;
  } catch {
    return false;
  }
}

/** Re-download for an authenticated user (Profile/Settings, or the signup
 * confirmation screen's manual fallback button). Requires a signed-in
 * session — the backend enforces that a user can only fetch their own
 * consent document. */
export async function downloadConsentPdfAuthenticated(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/auth/consent/download`, { credentials: "include" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Download failed" }));
    throw new Error(err.error || `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?(.+?)"?$/);
  triggerBlobDownload(blob, match ? match[1] : consentFilename(new Date().toISOString()));
}
