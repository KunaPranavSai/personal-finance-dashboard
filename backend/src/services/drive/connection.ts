import type { BackupConnection } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { encryptSecret, decryptSecret } from "../../lib/crypto";
import { ApiError } from "../../middleware/errorHandler";
import { refreshAccessToken } from "./googleDriveClient";

// Reuses the `BackupConnection` model (provider="google_drive") that already existed for the
// old Postgres-backup feature — no schema change needed. Its meaning is now "the user's Drive
// connection", not "a backup destination". `backupFolderId` continues to hold the root
// `Penny Pilot` folder id; `lastBackupAt`/`lastBackupFileId` are no longer written by anything.
export const DRIVE_PROVIDER = "google_drive";

export async function getConnection(userId: string): Promise<BackupConnection | null> {
  return prisma.backupConnection.findUnique({
    where: { userId_provider: { userId, provider: DRIVE_PROVIDER } },
  });
}

export async function requireConnection(userId: string): Promise<BackupConnection> {
  const connection = await getConnection(userId);
  if (!connection) throw new ApiError(400, "Google Drive is not connected.", "DRIVE_NOT_CONNECTED");
  return connection;
}

/** Decrypts a connection's tokens and refreshes the access token if it's expired/near-expiry. */
export async function getValidAccessToken(connection: BackupConnection): Promise<string> {
  const decryptedAccess = decryptSecret(connection.accessToken);

  if (connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() < Date.now() + 60000) {
    if (!connection.refreshToken) {
      throw new ApiError(401, "Google Drive session expired. Please reconnect.", "DRIVE_REAUTH_REQUIRED");
    }
    try {
      const refreshed = await refreshAccessToken(decryptSecret(connection.refreshToken));
      await prisma.backupConnection.update({
        where: { id: connection.id },
        data: { accessToken: encryptSecret(refreshed.accessToken), tokenExpiresAt: refreshed.expiresAt },
      });
      return refreshed.accessToken;
    } catch {
      // Refresh token itself was revoked/invalidated (user revoked access in their Google
      // account, or it expired) — surface a clear reconnect prompt rather than a raw 500.
      throw new ApiError(401, "Google Drive access was revoked. Please reconnect.", "DRIVE_REAUTH_REQUIRED");
    }
  }
  return decryptedAccess;
}

/** Convenience: resolve a connected user straight to a usable access token, or throw a clear error. */
export async function getAccessTokenForUser(userId: string): Promise<{ connection: BackupConnection; accessToken: string }> {
  const connection = await requireConnection(userId);
  const accessToken = await getValidAccessToken(connection);
  return { connection, accessToken };
}
