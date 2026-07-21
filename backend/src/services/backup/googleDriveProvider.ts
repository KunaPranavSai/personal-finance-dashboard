import { google } from "googleapis";
import { Readable } from "stream";
import type { CloudBackupProvider } from "./provider";

const SCOPES = ["https://www.googleapis.com/auth/drive.appdata", "https://www.googleapis.com/auth/userinfo.email"];
const BACKUP_FILENAME = "penny-pilot-backup.json";

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
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

  async uploadBackup(accessToken: string, _filename: string, content: string) {
    const client = oauthClient();
    client.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: "v3", auth: client });

    const existing = await drive.files.list({
      spaces: "appDataFolder",
      q: `name='${BACKUP_FILENAME}'`,
      fields: "files(id)",
    });
    const existingId = existing.data.files?.[0]?.id;

    const media = { mimeType: "application/json", body: Readable.from([content]) };

    if (existingId) {
      await drive.files.update({ fileId: existingId, media });
      return existingId;
    }

    const created = await drive.files.create({
      requestBody: { name: BACKUP_FILENAME, parents: ["appDataFolder"] },
      media,
      fields: "id",
    });
    return created.data.id!;
  },

  async downloadBackup(accessToken: string, fileId: string) {
    const client = oauthClient();
    client.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: "v3", auth: client });
    const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "text" });
    return res.data as unknown as string;
  },
};
