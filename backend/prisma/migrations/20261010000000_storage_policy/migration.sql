-- AlterTable
ALTER TABLE "platform_settings" ADD COLUMN "driveStorageEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "deviceStorageEnabled" BOOLEAN NOT NULL DEFAULT true;
