/**
 * Provider-agnostic cloud backup contract. Adding OneDrive/Dropbox/iCloud later
 * means implementing this interface and registering it in `getProvider` below —
 * no changes needed to routes, the DB schema, or any existing provider.
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

  /** Upload (or overwrite) the backup snapshot file. Returns the provider's file id. */
  uploadBackup(accessToken: string, filename: string, content: string): Promise<string>;

  /** Download the most recent backup snapshot's raw content. */
  downloadBackup(accessToken: string, fileId: string): Promise<string>;
}
