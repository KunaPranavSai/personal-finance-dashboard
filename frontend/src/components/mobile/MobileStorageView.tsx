"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MobileShell } from "@/components/mobile/MobileShell";
import { MobileSheet } from "@/components/mobile/MobileSheet";
import { ConfirmSheet } from "@/components/mobile/ConfirmSheet";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { useDriveStatus, isDriveReady, DRIVE_STATUS_QUERY_KEY } from "@/lib/driveStatus";
import { getStorageMode, setStorageMode } from "@/lib/storage";
import { formatDateIN } from "@/lib/format";

const COLLECTION_LABELS: Record<string, string> = {
  transactions: "Transactions",
  budgets: "Budgets",
  investments: "Investments",
  bills: "Bills & EMIs",
  goals: "Goals",
  accounts: "Wallets",
  categories: "Categories",
  paymentMethods: "Money Sources",
  settings: "Settings & Profile",
};
const COLLECTIONS = Object.keys(COLLECTION_LABELS);

interface VerifyResult {
  ok: boolean;
  issues: string[];
  collections: Record<string, { count: number; dataVersion: number; lastUpdated: string }>;
}
interface Revision {
  id: string;
  modifiedTime: string;
}
interface RevisionPreview {
  recordCount: number;
  lastUpdated: string;
}

/**
 * Mobile "Manage Storage" — the native equivalent of desktop's Settings →
 * Storage tab, reusing the exact same real endpoints (/api/drive/connect,
 * /disconnect, /verify, /restore/:collection/*) — no new backend behavior,
 * no invented states. Reached from Dashboard "Sync" and Settings
 * "Manage Storage", both as real /settings/* routes (no desktop escape).
 */
export function MobileStorageView() {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  const isLocalOnly = getStorageMode() === "local";
  const { data: status, isLoading: statusLoading } = useDriveStatus();

  const [switchConfirmOpen, setSwitchConfirmOpen] = useState(false);

  // Drive mode
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreCollection, setRestoreCollection] = useState<string>("transactions");
  const [selectedRevision, setSelectedRevision] = useState<string | null>(null);
  const [revisionPreview, setRevisionPreview] = useState<RevisionPreview | null>(null);
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);

  useEffect(() => {
    setSelectedRevision(null);
    setRevisionPreview(null);
  }, [restoreCollection]);

  const { data: revisions } = useQuery({
    queryKey: ["drive-revisions", restoreCollection],
    queryFn: () => api.get<{ items: Revision[] }>(`/api/drive/restore/${restoreCollection}/revisions`),
    enabled: restoreOpen,
  });

  const connectMutation = useMutation({
    mutationFn: () => api.get<{ authUrl: string }>("/api/drive/connect"),
    onSuccess: (data) => { window.location.href = data.authUrl; },
    onError: (err) => toast(err instanceof Error ? err.message : "Could not start Google Drive connection", "error"),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.delete("/api/drive/disconnect"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DRIVE_STATUS_QUERY_KEY });
      toast("Google Drive disconnected. Reconnect to access your Penny Pilot data.", "success");
      setDisconnectConfirmOpen(false);
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Failed to disconnect", "error"),
  });

  const verifyMutation = useMutation({
    mutationFn: () => api.post<VerifyResult>("/api/drive/verify"),
    onSuccess: (data) => {
      setVerifyResult(data);
      toast(data.ok ? "All your data checks out" : "Some data files failed an integrity check", data.ok ? "success" : "error");
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Verification failed", "error"),
  });

  const previewRevisionMutation = useMutation({
    mutationFn: (revisionId: string) => api.get<RevisionPreview>(`/api/drive/restore/${restoreCollection}/preview?revisionId=${encodeURIComponent(revisionId)}`),
    onSuccess: (data, revisionId) => { setRevisionPreview(data); setSelectedRevision(revisionId); },
    onError: (err) => toast(err instanceof Error ? err.message : "Could not read that version", "error"),
  });

  const restoreMutation = useMutation({
    mutationFn: () => api.post(`/api/drive/restore/${restoreCollection}`, { revisionId: selectedRevision, confirm: true }),
    onSuccess: () => {
      toast(`${COLLECTION_LABELS[restoreCollection] ?? "Data"} restored`, "success");
      setRestoreConfirmOpen(false);
      setRestoreOpen(false);
      setSelectedRevision(null);
      setRevisionPreview(null);
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Restore failed", "error"),
  });

  return (
    <MobileShell title="Manage Storage">
      <div className="ppm-page-title">
        <h2>Manage Storage</h2>
        <p>{isLocalOnly ? "This device only" : "Google Drive"}</p>
      </div>

      {isLocalOnly ? (
        <>
          <div className="ppm-card">
            <div className="ppm-list-item" style={{ cursor: "default" }}>
              <div className="ppm-ic" aria-hidden="true">💾</div>
              <div className="ppm-info">
                <div className="ppm-name">This Device Only</div>
                <div className="ppm-meta">Your financial data is stored only in this browser.</div>
              </div>
            </div>
          </div>

          <div className="ppm-card" style={{ marginTop: 14, background: "var(--ppm-warning-bg, rgba(255,190,11,0.12))" }}>
            <p style={{ fontSize: 12, color: "var(--ppm-text-dim)" }}>⚠️ Local-only data isn&apos;t backed up automatically. Export a backup regularly.</p>
          </div>

          <div className="ppm-card" style={{ marginTop: 14 }}>
            <button type="button" className="ppm-list-item" onClick={() => setSwitchConfirmOpen(true)}>
              <div className="ppm-ic" aria-hidden="true">🔗</div>
              <div className="ppm-info"><div className="ppm-name">Switch to Google Drive</div></div>
              <span className="ppm-chev">›</span>
            </button>
          </div>
        </>
      ) : statusLoading ? (
        <div className="ppm-card"><p style={{ fontSize: 13, color: "var(--ppm-text-dim)" }}>Loading…</p></div>
      ) : !status?.configured ? (
        <div className="ppm-card"><p style={{ fontSize: 13, color: "var(--ppm-text-dim)" }}>Google Drive isn&apos;t set up on this server yet. Check back soon.</p></div>
      ) : isDriveReady(status) ? (
        <>
          <div className="ppm-card">
            <div className="ppm-list-item" style={{ cursor: "default" }}>
              <div className="ppm-ic" aria-hidden="true">✅</div>
              <div className="ppm-info">
                <div className="ppm-name">Connected as {status.accountEmail}</div>
                <div className="ppm-meta">Stored in your Google Drive, in a &quot;Penny Pilot&quot; folder.</div>
              </div>
            </div>
          </div>

          <div className="ppm-card" style={{ marginTop: 14 }}>
            <button type="button" className="ppm-list-item" onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending}>
              <div className="ppm-ic" aria-hidden="true">🛡️</div>
              <div className="ppm-info"><div className="ppm-name">{verifyMutation.isPending ? "Checking…" : "Verify Data"}</div></div>
              <span className="ppm-chev">›</span>
            </button>
            <button type="button" className="ppm-list-item" onClick={() => setRestoreOpen(true)}>
              <div className="ppm-ic" aria-hidden="true">🕓</div>
              <div className="ppm-info"><div className="ppm-name">Restore Data</div></div>
              <span className="ppm-chev">›</span>
            </button>
            <button type="button" className="ppm-list-item" onClick={() => setDisconnectConfirmOpen(true)}>
              <div className="ppm-ic" aria-hidden="true">🔓</div>
              <div className="ppm-info"><div className="ppm-name" style={{ color: "var(--ppm-critical)" }}>Disconnect</div></div>
              <span className="ppm-chev">›</span>
            </button>
          </div>

          {verifyResult && (
            <div className="ppm-card" style={{ marginTop: 14 }}>
              <div className="ppm-section-label">Storage Status</div>
              {Object.entries(verifyResult.collections).map(([key, v]) => (
                <div className="ppm-cat-row" key={key}>
                  <div className="ppm-info"><div className="ppm-name">{COLLECTION_LABELS[key] ?? key}</div></div>
                  <div className="ppm-amt">{v.count}</div>
                </div>
              ))}
              {verifyResult.issues.length > 0 && (
                <p style={{ fontSize: 12, color: "var(--ppm-critical)", marginTop: 8 }}>{verifyResult.issues.join("; ")}</p>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="ppm-card">
          <p style={{ fontSize: 13, color: "var(--ppm-text-dim)", marginBottom: 12 }}>Google Drive is disconnected. Reconnect to access your Penny Pilot data.</p>
          <button type="button" className="ppm-qa-btn primary" style={{ width: "100%" }} onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
            {connectMutation.isPending ? "Connecting…" : "🔗 Reconnect Google Drive"}
          </button>
        </div>
      )}

      <ConfirmSheet
        open={switchConfirmOpen}
        onClose={() => setSwitchConfirmOpen(false)}
        onConfirm={() => { setStorageMode("drive"); router.push("/connect-drive"); }}
        title="Switch to Google Drive"
        message="Your local data stays on this device. You'll be taken to Google Drive setup next."
        confirmLabel="Switch"
      />

      <ConfirmSheet
        open={disconnectConfirmOpen}
        onClose={() => setDisconnectConfirmOpen(false)}
        onConfirm={() => disconnectMutation.mutate()}
        title="Disconnect Google Drive"
        message="You'll need to reconnect to access your Penny Pilot data again. Nothing in your Drive is deleted."
        confirmLabel="Disconnect"
        isPending={disconnectMutation.isPending}
      />

      {/* Restore Data */}
      <MobileSheet open={restoreOpen} onClose={() => setRestoreOpen(false)} title="Restore Data">
        <p style={{ fontSize: 12, color: "var(--ppm-text-dim)", marginBottom: 12 }}>
          Restore reverts one data file to an earlier saved version from your Google Drive&apos;s own history — nothing is ever deleted, so you can always restore again.
        </p>
        <div className="ppm-field">
          <label htmlFor="ppm-restore-col">Data</label>
          <select id="ppm-restore-col" value={restoreCollection} onChange={(e) => setRestoreCollection(e.target.value)}>
            {COLLECTIONS.map((c) => <option key={c} value={c}>{COLLECTION_LABELS[c]}</option>)}
          </select>
        </div>
        {!revisions || revisions.items.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--ppm-text-dim)" }}>No earlier versions found for this data yet.</p>
        ) : (
          <div className="ppm-card" style={{ background: "var(--ppm-surface-2)", maxHeight: 220, overflowY: "auto" }}>
            {revisions.items.map((r) => (
              <button
                key={r.id}
                type="button"
                className="ppm-list-item"
                style={{ background: selectedRevision === r.id ? "var(--ppm-chip-bg)" : "transparent" }}
                onClick={() => previewRevisionMutation.mutate(r.id)}
              >
                <div className="ppm-info"><div className="ppm-name" style={{ fontWeight: 500, fontSize: ".82rem" }}>{formatDateIN(r.modifiedTime)}</div></div>
                {selectedRevision === r.id && <span aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>
        )}
        {revisionPreview && selectedRevision && (
          <div className="ppm-card" style={{ marginTop: 12, background: "var(--ppm-surface-2)" }}>
            <p style={{ fontSize: 12, color: "var(--ppm-text-dim)" }}>This version has {revisionPreview.recordCount} record(s), last updated {formatDateIN(revisionPreview.lastUpdated)}.</p>
            <p style={{ fontSize: 11, color: "var(--ppm-text-dim)", marginTop: 4 }}>Restoring replaces your current {COLLECTION_LABELS[restoreCollection]?.toLowerCase()} with this version.</p>
            <button type="button" className="ppm-danger-btn" style={{ width: "100%", marginTop: 10 }} onClick={() => setRestoreConfirmOpen(true)}>
              Restore {COLLECTION_LABELS[restoreCollection]}
            </button>
          </div>
        )}
        <div className="ppm-sheet-actions">
          <button type="button" className="ppm-sheet-cancel" onClick={() => setRestoreOpen(false)}>Close</button>
        </div>
      </MobileSheet>

      <ConfirmSheet
        open={restoreConfirmOpen}
        onClose={() => setRestoreConfirmOpen(false)}
        onConfirm={() => restoreMutation.mutate()}
        title={`Restore ${COLLECTION_LABELS[restoreCollection]}`}
        message={`This replaces your current ${COLLECTION_LABELS[restoreCollection]?.toLowerCase()} with the selected earlier version. This can't be undone.`}
        confirmLabel="Restore"
        isPending={restoreMutation.isPending}
      />
    </MobileShell>
  );
}
