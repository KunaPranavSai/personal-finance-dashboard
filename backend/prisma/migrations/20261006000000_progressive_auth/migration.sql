-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN "profileCompletedAt" TIMESTAMP(3),
ADD COLUMN "emailOtpHash" TEXT,
ADD COLUMN "emailOtpExpiry" TIMESTAMP(3),
ADD COLUMN "emailOtpAttempts" INTEGER NOT NULL DEFAULT 0;

-- Every account that exists before this change signed up with name + consent: treat as verified and complete.
UPDATE "User" SET "emailVerifiedAt" = "createdAt", "profileCompletedAt" = "createdAt";
