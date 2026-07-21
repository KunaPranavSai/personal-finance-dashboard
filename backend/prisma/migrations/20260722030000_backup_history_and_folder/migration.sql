-- AlterTable
ALTER TABLE "BackupConnection" ADD COLUMN "backupFolderId" TEXT;

-- CreateTable
CREATE TABLE "BackupHistory" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fileId" TEXT,
    "errorMessage" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "triggeredBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackupHistory_connectionId_createdAt_idx" ON "BackupHistory"("connectionId", "createdAt");

-- CreateIndex
CREATE INDEX "BackupHistory_userId_status_idx" ON "BackupHistory"("userId", "status");

-- AddForeignKey
ALTER TABLE "BackupHistory" ADD CONSTRAINT "BackupHistory_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "BackupConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
