-- AlterTable
ALTER TABLE "User" ADD COLUMN "supervisedAt" TIMESTAMP(3),
ADD COLUMN "supervisedById" TEXT,
ADD COLUMN "supervisionReason" TEXT,
ADD COLUMN "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN "scheduledDeletionAt" TIMESTAMP(3);
