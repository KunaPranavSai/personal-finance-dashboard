-- Drop the old Postgres-backup feature's dead columns/table. `lastBackupAt` and
-- `lastBackupFileId` have not been written by any code since Google Drive replaced Postgres
-- as the source of truth for financial data (see services/drive/init.ts), and `BackupHistory`
-- has had zero readers or writers since the same change.
ALTER TABLE "BackupHistory" DROP CONSTRAINT IF EXISTS "BackupHistory_connectionId_fkey";
DROP TABLE IF EXISTS "BackupHistory";

ALTER TABLE "BackupConnection" DROP COLUMN IF EXISTS "lastBackupAt";
ALTER TABLE "BackupConnection" DROP COLUMN IF EXISTS "lastBackupFileId";

-- Operational visibility into the Drive connect/migrate flow, for the admin Migration Status
-- view only (see backend/src/routes/admin.routes.ts and drive.routes.ts). Never read by any
-- user-facing logic.
ALTER TABLE "BackupConnection" ADD COLUMN "lastConnectAttemptAt" TIMESTAMP(3);
ALTER TABLE "BackupConnection" ADD COLUMN "lastConnectError" TEXT;
