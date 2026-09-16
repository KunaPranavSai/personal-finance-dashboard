"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MobileShell } from "@/components/mobile/MobileShell";
import { MobileSheet } from "@/components/mobile/MobileSheet";
import { ConfirmSheet } from "@/components/mobile/ConfirmSheet";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { useDriveStatus, isDriveReady, DRIVE_STATUS_QUERY_KEY } from "@/lib/driveStatus";
import { getStorageMode, setStorageMode, STORAGE_COLLECTIONS, StorageCollection } from "@/lib/storage";
import { idbGetAll, idbReplaceAll } from "@/lib/storage/localDb";
import { encryptBackupText, decryptBackupText, isEncryptedBackupEnvelope, type EncryptedBackupEnvelope } from "@/lib/storage/backupCrypto";
import { formatDateIN } from "@/lib/format";

const BACKUP_FORMAT_VERSION = 1;

interface LocalBackupFile {
  formatVersion: number;
  exportedAt: string;
  app: "penny-pilot";
  collections: Partial<Record<StorageCollection, unknown[]>>;
}

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

async function applyBackupJson(json: string): Promise<{ ok: true } | { ok: false; error: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "That file isn't a valid Penny Pilot backup (not valid JSON)." };
  }
  const backup = parsed as Partial<LocalBackupFile>;
  if (backup.app !== "penny-pilot" || typeof backup.collections !== "object" || backup.collections === null) {
    return { ok: false, error: "That file doesn't look like a Penny Pilot backup." };
  }
  if (backup.formatVersion !== BACKUP_FORMAT_VERSION) {
    return { ok: false, error: "This backup was made with a different, unsupported format version." };
  }
  for (const collection of STORAGE_COLLECTIONS) {
    const records = backup.collections[collection];
    if (records !== undefined && !Array.isArray(records)) {
      return { ok: false, error: `Backup file is corrupted (invalid "${collection}" section).` };
    }
  }
  for (const collection of STORAGE_COLLECTIONS) {
    const records = backup.collections[collection];
    if (Array.isArray(records)) await idbReplaceAll(collection, records);
  }
  return { ok: true };
}

/**
 * Mobile "Manage Storage" — the native equivalent of desktop's Settings →
 * Storage tab (DataStorageCard + GoogleDriveBackupCard), reusing the exact
 * same real endpoints (/api/drive/connect, /disconnect, /verify,
 * /restore/:collection/*) and the exact same client-side encrypted local
 * backup logic (IndexedDB + backupCrypto) — no new backend behavior, no
 * invented states. Reached from Dashboard "Sync" and Settings
 * "Manage Storage", both as real /settings/* routes (no desktop escape).
 */
export function MobileStorageView() {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLocalOnly = getStorageMode() === "local";
  const { data: status, isLoading: statusLoading } = useDriveStatus();

  // Local-only backup/restore
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [exportPasswordConfirm, setExportPasswordConfirm] = useState("");
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState("");
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
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

  const downloadBlob = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirmExport = async () => {
    setExportError("");
    if (exportPassword.length < 8) { setExportError("Password must be at least 8 characters."); return; }
    if (exportPassword !== exportPasswordConfirm) { setExportError("Passwords do not match."); return; }
    setExporting(true);
    try {
      const collections: LocalBackupFile["collections"] = {};
      for (const collection of STORAGE_COLLECTIONS) collections[collection] = await idbGetAll(collection);
      const backup: LocalBackupFile = { formatVersion: BACKUP_FORMAT_VERSION, exportedAt: new Date().toISOString(), app: "penny-pilot", collections };
      const envelope = await encryptBackupText(JSON.stringify(backup), exportPassword);
      downloadBlob(JSON.stringify(envelope), `penny-pilot-local-backup-${new Date().toISOString().slice(0, 10)}.json`);
      toast("Encrypted backup downloaded — remember your password, it can't be recovered.", "success");
      setExportOpen(false);
      setExportPassword("");
      setExportPasswordConfirm("");
    } catch {
      toast("Couldn't export your local data. Please try again.", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelected = async (file: File) => {
    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      toast("That file isn't a valid Penny Pilot backup (not valid JSON).", "error");
      return;
    }
    if (isEncryptedBackupEnvelope(parsed)) {
      setPendingImportFile(file);
      return;
    }
    setImporting(true);
    try {
      const result = await applyBackupJson(text);
      if (!result.ok) toast(result.error, "error");
      else toast("Backup imported successfully", "success");
    } catch {
      toast("Couldn't import that backup. Your existing local data was not changed.", "error");
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingImportFile) return;
    setImportError("");
    setImporting(true);
    try {
      const text = await pendingImportFile.text();
      const envelope = JSON.parse(text) as EncryptedBackupEnvelope;
      let decrypted: string;
      try {
        decrypted = await decryptBackupText(envelope, importPassword);
      } catch {
        setImportError("Incorrect password, or this backup file is corrupted.");
        return;
      }
      const result = await applyBackupJson(decrypted);
      if (!result.ok) {
        setImportError(result.error);
        toast(result.error, "error");
      } else {
        toast("Backup imported successfully", "success");
        setPendingImportFile(null);
        setImportPassword("");
      }
    } catch {
      toast("Couldn't import that backup. Your existing local data was not changed.", "error");
    } finally {
      setImporting(false);
    }
  };

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
            <button type="button" className="ppm-list-item" onClick={() => { setExportOpen(true); setExportError(""); }}>
              <div className="ppm-ic" aria-hidden="true">⬇️</div>
              <div className="ppm-info"><div className="ppm-name">Export Encrypted Backup</div></div>
              <span className="ppm-chev">›</span>
            </button>
            <button type="button" className="ppm-list-item" onClick={() => fileInputRef.current?.click()}>
              <div className="ppm-ic" aria-hidden="true">⬆️</div>
              <div className="ppm-info"><div className="ppm-name">Import Backup</div></div>
              <span className="ppm-chev">›</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFileSelected(file);
                e.target.value = "";
              }}
            />
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

      {/* Export encrypted backup */}
      <MobileSheet open={exportOpen} onClose={() => setExportOpen(false)} title="Export Encrypted Backup">
        <p style={{ fontSize: 12, color: "var(--ppm-text-dim)", marginBottom: 12 }}>
          This encrypts the downloaded file. There is no way to recover it if you forget this password — store it somewhere safe.
        </p>
        <div className="ppm-field">
          <label htmlFor="ppm-exp-pw">Backup Password (min 8 characters)</label>
          <input id="ppm-exp-pw" type="password" value={exportPassword} onChange={(e) => setExportPassword(e.target.value)} />
        </div>
        <div className="ppm-field">
          <label htmlFor="ppm-exp-pw2">Confirm Password</label>
          <input id="ppm-exp-pw2" type="password" value={exportPasswordConfirm} onChange={(e) => setExportPasswordConfirm(e.target.value)} />
        </div>
        {exportError && <div className="err" style={{ marginBottom: 10 }}>{exportError}</div>}
        <div className="ppm-sheet-actions">
          <button type="button" className="ppm-sheet-submit" disabled={exporting} onClick={handleConfirmExport}>{exporting ? "Encrypting…" : "Download Encrypted Backup"}</button>
          <button type="button" className="ppm-sheet-cancel" onClick={() => setExportOpen(false)} disabled={exporting}>Cancel</button>
        </div>
      </MobileSheet>

      {/* Import encrypted backup */}
      <MobileSheet open={Boolean(pendingImportFile)} onClose={() => { setPendingImportFile(null); setImportPassword(""); setImportError(""); }} title="Restore Backup">
        <p style={{ fontSize: 12, color: "var(--ppm-text-dim)", marginBottom: 12 }}>&quot;{pendingImportFile?.name}&quot; is encrypted. Enter its password.</p>
        <div className="ppm-field">
          <label htmlFor="ppm-imp-pw">Backup Password</label>
          <input id="ppm-imp-pw" type="password" value={importPassword} onChange={(e) => setImportPassword(e.target.value)} />
        </div>
        {importError && <div className="err" style={{ marginBottom: 10 }}>{importError}</div>}
        <div className="ppm-sheet-actions">
          <button type="button" className="ppm-sheet-submit" disabled={importing} onClick={handleConfirmImport}>{importing ? "Decrypting…" : "Restore Backup"}</button>
          <button type="button" className="ppm-sheet-cancel" onClick={() => { setPendingImportFile(null); setImportPassword(""); setImportError(""); }} disabled={importing}>Cancel</button>
        </div>
      </MobileSheet>

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
