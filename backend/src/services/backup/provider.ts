/**
 * Provider-agnostic cloud backup contract. Adding OneDrive/Dropbox/iCloud later
 * means implementing this interface and registering it in `getProvider` below —
 * no changes needed to routes, the DB schema, or any existing provider.
 *
 * Every call takes the *connecting user's own* access token — there is no
 * concept of a shared/service-account Drive anywhere in this interface, so a
 * provider implementation can only ever read or write inside the account that
 * granted the token.
 */
export interface CloudBackupProvider {
  readonly id: string;

  /** Build the URL the user is redirected to in order to grant access. */
  getAuthUrl(state: string): string;

  /** Exchange an OAuth authorization code for tokens. */
  exchangeCode(code: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    accountEmail?: string;
  }>;

  /** Refresh an expired access token using the stored refresh token. */
  refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt?: Date }>;

  /** Find (or create) the dedicated backup folder in the user's own Drive. Returns its folder id. */
  getOrCreateBackupFolder(accessToken: string): Promise<string>;

  /** Upload a new, timestamped backup snapshot into the given folder. Returns the created file's id. */
  uploadBackup(accessToken: string, folderId: string, filename: string, content: string): Promise<string>;

  /** Download a specific backup snapshot's raw content by file id. */
  downloadBackup(accessToken: string, fileId: string): Promise<string>;

  /** List backup files in the folder, newest first. */
  listBackups(accessToken: string, folderId: string): Promise<{ id: string; name: string; createdTime: string }[]>;

  /** Delete a backup file (used to prune old snapshots beyond the retention limit). */
  deleteBackup(accessToken: string, fileId: string): Promise<void>;
}
