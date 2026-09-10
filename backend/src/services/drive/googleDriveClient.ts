import { google } from "googleapis";
import { Readable } from "stream";

// drive.file — the app can only see/manage files and folders IT creates in the
// connected user's own Drive. This intentionally cannot see or touch anything
// else in that user's Drive, and there is no server-side/shared credential
// anywhere in this flow: every request below is authenticated with that one
// user's own OAuth token. This is also the narrowest scope that still lets
// the user open and inspect their own Penny Pilot folder in Drive directly.
export const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/userinfo.email"];

export const ROOT_FOLDER_NAME = "Penny Pilot";
export const DATA_FOLDER_NAME = "Data";
export const REPORTS_FOLDER_NAME = "Reports";
export const METADATA_FOLDER_NAME = "Metadata";

export function oauthClient() {
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

export function isGoogleDriveConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}

export function getAuthUrl(state: string): string {
  const client = oauthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: DRIVE_SCOPES,
    state,
  });
}

export async function exchangeCode(code: string) {
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
}

export async function refreshAccessToken(refreshToken: string) {
  const client = oauthClient();
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();
  return {
    accessToken: credentials.access_token!,
    expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
  };
}

export async function findFolder(accessToken: string, name: string, parentId?: string): Promise<string | null> {
  const drive = driveClient(accessToken);
  const parentClause = parentId ? ` and '${parentId}' in parents` : " and 'root' in parents";
  const res = await drive.files.list({
    q: `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentClause}`,
    fields: "files(id)",
    spaces: "drive",
  });
  return res.data.files?.[0]?.id ?? null;
}

export async function findOrCreateFolder(accessToken: string, name: string, parentId?: string): Promise<string> {
  const existing = await findFolder(accessToken, name, parentId);
  if (existing) return existing;

  const drive = driveClient(accessToken);
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

export interface DriveFolderSet {
  rootId: string;
  dataId: string;
  reportsId: string;
  metadataId: string;
}

/** Idempotent — safe to call on every connect/reconnect. Never wipes existing files. */
export async function getOrCreatePennyPilotFolders(accessToken: string): Promise<DriveFolderSet> {
  const rootId = await findOrCreateFolder(accessToken, ROOT_FOLDER_NAME);
  const [dataId, reportsId, metadataId] = await Promise.all([
    findOrCreateFolder(accessToken, DATA_FOLDER_NAME, rootId),
    findOrCreateFolder(accessToken, REPORTS_FOLDER_NAME, rootId),
    findOrCreateFolder(accessToken, METADATA_FOLDER_NAME, rootId),
  ]);
  return { rootId, dataId, reportsId, metadataId };
}

/** Read-only probe — used to detect whether a Google account already has a Penny Pilot folder, without creating one. */
export async function findExistingPennyPilotRoot(accessToken: string): Promise<string | null> {
  return findFolder(accessToken, ROOT_FOLDER_NAME);
}

export async function findFile(accessToken: string, folderId: string, filename: string): Promise<string | null> {
  const drive = driveClient(accessToken);
  const res = await drive.files.list({
    q: `name='${filename.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
  });
  return res.data.files?.[0]?.id ?? null;
}

export async function createFile(accessToken: string, folderId: string, filename: string, content: string): Promise<string> {
  const drive = driveClient(accessToken);
  const created = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType: "application/json", body: Readable.from([content]) },
    fields: "id",
  });
  return created.data.id!;
}

/** Overwrites a file's content. Drive automatically keeps this as a new revision, which is what backs the restore "safe pre-restore state" requirement. */
export async function updateFileContent(accessToken: string, fileId: string, content: string): Promise<void> {
  const drive = driveClient(accessToken);
  await drive.files.update({
    fileId,
    media: { mimeType: "application/json", body: Readable.from([content]) },
  });
}

export async function readFileContent(accessToken: string, fileId: string): Promise<string> {
  const drive = driveClient(accessToken);
  const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "text" });
  return res.data as unknown as string;
}

/** Create-if-missing, update-if-present. Returns the file id either way. */
export async function upsertFile(accessToken: string, folderId: string, filename: string, content: string, existingFileId?: string | null): Promise<string> {
  const fileId = existingFileId ?? (await findFile(accessToken, folderId, filename));
  if (fileId) {
    await updateFileContent(accessToken, fileId, content);
    return fileId;
  }
  return createFile(accessToken, folderId, filename, content);
}

export async function listFilesInFolder(accessToken: string, folderId: string): Promise<{ id: string; name: string; createdTime: string }[]> {
  const drive = driveClient(accessToken);
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: "files(id,name,createdTime)",
    orderBy: "createdTime desc",
    pageSize: 100,
  });
  return (res.data.files ?? []).map((f) => ({ id: f.id!, name: f.name!, createdTime: f.createdTime! }));
}

export async function deleteFile(accessToken: string, fileId: string): Promise<void> {
  const drive = driveClient(accessToken);
  await drive.files.delete({ fileId });
}

/** Lists Drive's own revision history for a file — this is what "Restore" reads from and what
 * backs the "safe pre-restore state" requirement, instead of a hand-rolled snapshot mechanism. */
export async function listFileRevisions(accessToken: string, fileId: string): Promise<{ id: string; modifiedTime: string }[]> {
  const drive = driveClient(accessToken);
  const res = await drive.revisions.list({ fileId, fields: "revisions(id,modifiedTime)" });
  return (res.data.revisions ?? []).map((r) => ({ id: r.id!, modifiedTime: r.modifiedTime! }));
}

export async function readFileRevisionContent(accessToken: string, fileId: string, revisionId: string): Promise<string> {
  const drive = driveClient(accessToken);
  const res = await drive.revisions.get({ fileId, revisionId, alt: "media" }, { responseType: "text" });
  return res.data as unknown as string;
}
