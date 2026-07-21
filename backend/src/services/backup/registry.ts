import type { CloudBackupProvider } from "./provider";
import { googleDriveProvider } from "./googleDriveProvider";

const PROVIDERS: Record<string, CloudBackupProvider> = {
  google_drive: googleDriveProvider,
  // onedrive / dropbox / icloud register here later — same interface, no route changes.
};

export function getProvider(id: string): CloudBackupProvider | null {
  return PROVIDERS[id] ?? null;
}

export function isProviderConfigured(id: string): boolean {
  if (id === "google_drive") {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
  }
  return false;
}
