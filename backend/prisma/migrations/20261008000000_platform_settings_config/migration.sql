-- AlterTable
ALTER TABLE "platform_settings" ADD COLUMN "appUrl" TEXT,
ADD COLUMN "emailFromName" TEXT,
ADD COLUMN "emailFromAddress" TEXT,
ADD COLUMN "superAdminEmail" TEXT,
ADD COLUMN "apiRateLimit" INTEGER NOT NULL DEFAULT 300;
