"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { HardDrive, Laptop, Download, Upload, AlertCircle } from "lucide-react";
import { getStorageMode, setStorageMode, STORAGE_COLLECTIONS, StorageCollection } from "@/lib/storage";
import { idbGetAll, idbReplaceAll } from "@/lib/storage/localDb";
import { encryptBackupText, decryptBackupText, isEncryptedBackupEnvelope, type EncryptedBackupEnvelope } from "@/lib/storage/backupCrypto";
import { getLocalRecoveryAction } from "@/lib/errorActions";

const BACKUP_FORMAT_VERSION = 1;

interface LocalBackupFile {
  formatVersion: number;
  exportedAt: string;
  app: "penny-pilot";
  collections: Partial<Record<StorageCollection, unknown[]>>;
}

/** "Settings → Data & Storage" (Master Plan §7-8): shows the active storage
 * mode and, for Local-Only users, lets them export/import a backup of their
 * IndexedDB data. Drive-mode users keep seeing the existing
 * GoogleDriveBackupCard alongside this — this card only adds mode awareness
 * and local backup, it doesn't replace anything. */
/** Validates and (if all sections check out) writes a decrypted/plaintext
 * backup's collections into IndexedDB. Every collection is validated before
 * anything is written, so a malformed file never partially overwrites
 * existing local data. */
async function applyBackupJson(json: string): Promise<{ ok: true } | { ok: false; error: string; code: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "That file isn't a valid Penny Pilot backup (not valid JSON).", code: "IMPORT_INVALID" };
  }
  const backup = parsed as Partial<LocalBackupFile>;
  if (backup.app !== "penny-pilot" || typeof backup.collections !== "object" || backup.collections === null) {
    return { ok: false, error: "That file doesn't look like a Penny Pilot backup.", code: "IMPORT_INVALID" };
  }
  if (backup.formatVersion !== BACKUP_FORMAT_VERSION) {
    return { ok: false, error: "This backup was made with a different, unsupported format version.", code: "IMPORT_VALIDATION_FAILED" };
  }
  for (const collection of STORAGE_COLLECTIONS) {
    const records = backup.collections[collection];
    if (records !== undefined && !Array.isArray(records)) {
      return { ok: false, error: `Backup file is corrupted (invalid "${collection}" section).`, code: "IMPORT_VALIDATION_FAILED" };
    }
  }
  for (const collection of STORAGE_COLLECTIONS) {
    const records = backup.collections[collection];
    if (Array.isArray(records)) await idbReplaceAll(collection, records);
  }
  return { ok: true };
}

export function DataStorageCard() {
  const { toast } = useToast();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"drive" | "local" | null>(null);
  const [busy, setBusy] = useState(false);
  const [exportPrompt, setExportPrompt] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [exportPasswordConfirm, setExportPasswordConfirm] = useState("");
  const [exportError, setExportError] = useState("");
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState("");
  const [importError, setImportError] = useState("");
  const [importErrorCode, setImportErrorCode] = useState<string | undefined>();

  useEffect(() => {
    setMode(getStorageMode());
  }, []);

  if (mode === null) return null;

  const downloadBlob = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleConfirmExport = async () => {
    setExportError("");
    if (exportPassword.length < 8) {
      setExportError("Password must be at least 8 characters.");
      return;
    }
    if (exportPassword !== exportPasswordConfirm) {
      setExportError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const collections: LocalBackupFile["collections"] = {};
      for (const collection of STORAGE_COLLECTIONS) {
        collections[collection] = await idbGetAll(collection);
      }
      const backup: LocalBackupFile = {
        formatVersion: BACKUP_FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        app: "penny-pilot",
        collections,
      };
      const envelope = await encryptBackupText(JSON.stringify(backup), exportPassword);
      downloadBlob(JSON.stringify(envelope), `penny-pilot-local-backup-${new Date().toISOString().slice(0, 10)}.json`);
      toast("Encrypted backup downloaded — remember your password, it can't be recovered.", "success");
      setExportPrompt(false);
      setExportPassword("");
      setExportPasswordConfirm("");
    } catch {
      // code: EXPORT_FAILED (Master Plan §16) — surfaced via the toast message only;
      // there's no useful automatic recovery action beyond "try again."
      toast("Couldn't export your local data. Please try again.", "error");
    } finally {
      setBusy(false);
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
    // Legacy/unencrypted backup — validate and apply directly.
    setBusy(true);
    try {
      const result = await applyBackupJson(text);
      if (!result.ok) toast(result.error, "error");
      else toast("Backup imported successfully", "success");
    } catch {
      toast("Couldn't import that backup. Your existing local data was not changed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingImportFile) return;
    setImportError("");
    setImportErrorCode(undefined);
    setBusy(true);
    try {
      const text = await pendingImportFile.text();
      const envelope = JSON.parse(text) as EncryptedBackupEnvelope;
      let decrypted: string;
      try {
        decrypted = await decryptBackupText(envelope, importPassword);
      } catch {
        setImportError("Incorrect password, or this backup file is corrupted.");
        setImportErrorCode("IMPORT_DECRYPTION_FAILED");
        return;
      }
      const result = await applyBackupJson(decrypted);
      if (!result.ok) {
        setImportError(result.error);
        setImportErrorCode(result.code);
        toast(result.error, "error");
      } else {
        toast("Backup imported successfully", "success");
        setPendingImportFile(null);
        setImportPassword("");
      }
    } catch {
      toast("Couldn't import that backup. Your existing local data was not changed.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Data &amp; Storage</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-black/5 px-4 py-3 dark:border-white/10">
          {mode === "drive" ? <HardDrive className="h-5 w-5 text-teal" /> : <Laptop className="h-5 w-5 text-teal" />}
          <div>
            <p className="text-sm font-medium text-navy dark:text-white">
              {mode === "drive" ? "Google Drive" : "This Device Only"}
            </p>
            <p className="text-xs text-navy/50 dark:text-white/50">
              {mode === "drive"
                ? "Your financial data is stored in your own Google Drive."
                : "Your financial data is stored only in this browser."}
            </p>
          </div>
        </div>

        {mode === "local" && (
          <>
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Local-only data isn&apos;t backed up automatically. Export a backup regularly.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => { setExportPrompt(true); setExportError(""); }} disabled={busy}>
                <Download className="h-4 w-4" /> Export Backup
              </Button>
              <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                <Upload className="h-4 w-4" /> Import Backup
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileSelected(file);
                  e.target.value = "";
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStorageMode("drive");
                  router.push("/connect-drive");
                }}
              >
                Switch to Google Drive
              </Button>
            </div>

            {exportPrompt && (
              <div className="space-y-2 rounded-lg border border-black/10 p-3 dark:border-white/10">
                <p className="text-xs font-medium text-navy dark:text-white">Protect this backup with a password</p>
                <p className="text-xs text-navy/50 dark:text-white/50">
                  This encrypts the downloaded file. There is no way to recover it if you forget this password — store it somewhere safe.
                </p>
                <input
                  type="password"
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  placeholder="Backup password (min 8 characters)"
                  className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10"
                />
                <input
                  type="password"
                  value={exportPasswordConfirm}
                  onChange={(e) => setExportPasswordConfirm(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10"
                />
                {exportError && <p className="text-xs text-red-500">{exportError}</p>}
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleConfirmExport} disabled={busy}>{busy ? "Encrypting…" : "Download Encrypted Backup"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setExportPrompt(false); setExportPassword(""); setExportPasswordConfirm(""); setExportError(""); }}>Cancel</Button>
                </div>
              </div>
            )}

            {pendingImportFile && (
              <div className="space-y-2 rounded-lg border border-black/10 p-3 dark:border-white/10">
                <p className="text-xs font-medium text-navy dark:text-white">Enter the backup&apos;s password</p>
                <p className="text-xs text-navy/50 dark:text-white/50">&quot;{pendingImportFile.name}&quot; is encrypted.</p>
                <input
                  type="password"
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                  placeholder="Backup password"
                  className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10"
                />
                {importError && <p className="text-xs text-red-500">{importError}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={handleConfirmImport} disabled={busy}>{busy ? "Decrypting…" : "Restore Backup"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setPendingImportFile(null); setImportPassword(""); setImportError(""); setImportErrorCode(undefined); }}>Cancel</Button>
                  {(() => {
                    const action = getLocalRecoveryAction(importErrorCode, () => {
                      setPendingImportFile(null);
                      setImportPassword("");
                      setImportError("");
                      setImportErrorCode(undefined);
                      fileInputRef.current?.click();
                    });
                    return action ? <Button size="sm" variant="ghost" onClick={action.onClick}>{action.label}</Button> : null;
                  })()}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
