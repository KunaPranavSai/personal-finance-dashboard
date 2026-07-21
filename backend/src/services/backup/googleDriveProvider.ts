import { google } from "googleapis";
import { Readable } from "stream";
import type { CloudBackupProvider } from "./provider";

// drive.file — the app can only see/manage files and folders IT creates in the
// connected user's own Drive. This intentionally cannot see or touch anything
// else in that user's Drive, and there is no server-side/shared credential
// anywhere in this flow: every request below is authenticated with that one
// user's own OAuth token.
const SCOPES = ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/userinfo.email"];
const ROOT_FOLDER_NAME = "PennyPilot";
const BACKUP_FOLDER_NAME = "Backups";

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function driveClient(accessToken: string) {
  const client = oauthClient();
  client.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth: client });
}

async function findOrCreateFolder(drive: ReturnType<typeof driveClient>, name: string, parentId?: string): Promise<string> {
  const parentClause = parentId ? ` and '${parentId}' in parents` : " and 'root' in parents";
  const existing = await drive.files.list({
    q: `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentClause}`,
    fields: "files(id)",
    spaces: "drive",
  });
  const found = existing.data.files?.[0]?.id;
  if (found) return found;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
  });
  return created.data.id!;
}

export const googleDriveProvider: CloudBackupProvider = {
  id: "google_drive",

  getAuthUrl(state: string) {
    const client = oauthClient();
    return client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
      state,
    });
  },

  async exchangeCode(code: string) {
    const client = oauthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ auth: client, version: "v2" });
    const { data: profile } = await oauth2.userinfo.get();
    return {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token ?? undefined,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      accountEmail: profile.email ?? undefined,
    };
  },

  async refreshAccessToken(refreshToken: string) {
    const client = oauthClient();
    client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await client.refreshAccessToken();
    return {
      accessToken: credentials.access_token!,
      expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
    };
  },

  async getOrCreateBackupFolder(accessToken: string) {
    const drive = driveClient(accessToken);
    const rootId = await findOrCreateFolder(drive, ROOT_FOLDER_NAME);
    return findOrCreateFolder(drive, BACKUP_FOLDER_NAME, rootId);
  },

  async uploadBackup(accessToken: string, folderId: string, filename: string, content: string) {
    const drive = driveClient(accessToken);
    const created = await drive.files.create({
      requestBody: { name: filename, parents: [folderId] },
      media: { mimeType: "application/json", body: Readable.from([content]) },
      fields: "id",
    });
    return created.data.id!;
  },

  async downloadBackup(accessToken: string, fileId: string) {
    const drive = driveClient(accessToken);
    const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "text" });
    return res.data as unknown as string;
  },

  async listBackups(accessToken: string, folderId: string) {
    const drive = driveClient(accessToken);
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id,name,createdTime)",
      orderBy: "createdTime desc",
      pageSize: 100,
    });
    return (res.data.files ?? []).map((f) => ({ id: f.id!, name: f.name!, createdTime: f.createdTime! }));
  },

  async deleteBackup(accessToken: string, fileId: string) {
    const drive = driveClient(accessToken);
    await drive.files.delete({ fileId });
  },
};
