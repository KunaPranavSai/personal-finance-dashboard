-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'USER');
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "passwordHash" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "twoFactorPendingSecret" TEXT,
    "twoFactorBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "resetOtpHash" TEXT,
    "resetOtpExpiry" TIMESTAMP(3),
    "onboardedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_uid_key" ON "User"("uid");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_status_idx" ON "User"("status");

-- Migrate the single existing admin (AppSettings/AppProfile singleton rows) into the first
-- real User row, as SUPER_ADMIN, already ACTIVE, with their existing password hash carried
-- over verbatim (no re-hashing needed) and onboarded (no forced password change).
INSERT INTO "User" ("id", "uid", "email", "name", "phone", "role", "status", "passwordHash",
                     "mustChangePassword", "twoFactorEnabled", "twoFactorSecret", "twoFactorBackupCodes",
                     "sessionVersion", "onboardedAt", "approvedAt", "createdAt", "updatedAt")
SELECT
    'seed-super-admin',
    COALESCE(s.data->>'__adminUid', 'admin'),
    COALESCE(p.data->>'email', 'admin@pennypilot.app'),
    COALESCE(p.data->>'name', 'Admin'),
    NULL,
    'SUPER_ADMIN'::"UserRole",
    'ACTIVE'::"UserStatus",
    s.data->>'__passwordHash',
    false,
    COALESCE((s.data->>'__twoFactorEnabled')::boolean, false),
    s.data->>'__twoFactorSecret',
    COALESCE(
        (SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(s.data->'__twoFactorBackupCodes', '[]'::jsonb)) x),
        ARRAY[]::TEXT[]
    ),
    COALESCE((s.data->>'__sessionVersion')::int, 0),
    now(),
    now(),
    now(),
    now()
FROM "app_settings" s
LEFT JOIN "app_profile" p ON p.id = 'singleton'
WHERE s.id = 'singleton';

-- Fallback: if no app_settings singleton row existed at all (fresh DB), seed a default super admin.
INSERT INTO "User" ("id", "uid", "email", "name", "role", "status", "mustChangePassword",
                     "sessionVersion", "createdAt", "updatedAt")
SELECT 'seed-super-admin', 'admin', 'admin@pennypilot.app', 'Admin', 'SUPER_ADMIN'::"UserRole",
       'ACTIVE'::"UserStatus", true, 0, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = 'seed-super-admin');

-- AlterTable: add nullable userId to every data table, backfill to the migrated super admin,
-- then enforce NOT NULL + FK + composite uniques.

ALTER TABLE "Category" ADD COLUMN "userId" TEXT;
UPDATE "Category" SET "userId" = 'seed-super-admin';
ALTER TABLE "Category" ALTER COLUMN "userId" SET NOT NULL;
DROP INDEX IF EXISTS "Category_name_key";
CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId", "name");
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Account" ADD COLUMN "userId" TEXT;
UPDATE "Account" SET "userId" = 'seed-super-admin';
ALTER TABLE "Account" ALTER COLUMN "userId" SET NOT NULL;
DROP INDEX IF EXISTS "Account_name_key";
CREATE UNIQUE INDEX "Account_userId_name_key" ON "Account"("userId", "name");
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentMethodType" ADD COLUMN "userId" TEXT;
UPDATE "PaymentMethodType" SET "userId" = 'seed-super-admin';
ALTER TABLE "PaymentMethodType" ALTER COLUMN "userId" SET NOT NULL;
DROP INDEX IF EXISTS "PaymentMethodType_name_key";
CREATE UNIQUE INDEX "PaymentMethodType_userId_name_key" ON "PaymentMethodType"("userId", "name");
ALTER TABLE "PaymentMethodType" ADD CONSTRAINT "PaymentMethodType_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Transaction" ADD COLUMN "userId" TEXT;
UPDATE "Transaction" SET "userId" = 'seed-super-admin';
ALTER TABLE "Transaction" ALTER COLUMN "userId" SET NOT NULL;
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Budget" ADD COLUMN "userId" TEXT;
UPDATE "Budget" SET "userId" = 'seed-super-admin';
ALTER TABLE "Budget" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Investment" ADD COLUMN "userId" TEXT;
UPDATE "Investment" SET "userId" = 'seed-super-admin';
ALTER TABLE "Investment" ALTER COLUMN "userId" SET NOT NULL;
CREATE INDEX "Investment_userId_idx" ON "Investment"("userId");
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Bill" ADD COLUMN "userId" TEXT;
UPDATE "Bill" SET "userId" = 'seed-super-admin';
ALTER TABLE "Bill" ALTER COLUMN "userId" SET NOT NULL;
CREATE INDEX "Bill_userId_idx" ON "Bill"("userId");
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Goal" ADD COLUMN "userId" TEXT;
UPDATE "Goal" SET "userId" = 'seed-super-admin';
ALTER TABLE "Goal" ALTER COLUMN "userId" SET NOT NULL;
CREATE INDEX "Goal_userId_idx" ON "Goal"("userId");
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD COLUMN "userId" TEXT;
UPDATE "Notification" SET "userId" = 'seed-super-admin';
ALTER TABLE "Notification" ALTER COLUMN "userId" SET NOT NULL;
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ActivityLog.userId stays nullable (e.g. failed logins by unknown uid have no resolvable user).
ALTER TABLE "ActivityLog" ADD COLUMN "userId" TEXT;
UPDATE "ActivityLog" SET "userId" = 'seed-super-admin';
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- app_settings / app_profile: move from a fixed "singleton" row to one row per user.
ALTER TABLE "app_settings" ADD COLUMN "userId" TEXT;
UPDATE "app_settings" SET "userId" = 'seed-super-admin' WHERE "id" = 'singleton';
DELETE FROM "app_settings" WHERE "id" != 'singleton';
ALTER TABLE "app_settings" ALTER COLUMN "userId" SET NOT NULL;
CREATE UNIQUE INDEX "app_settings_userId_key" ON "app_settings"("userId");
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_profile" ADD COLUMN "userId" TEXT;
UPDATE "app_profile" SET "userId" = 'seed-super-admin' WHERE "id" = 'singleton';
DELETE FROM "app_profile" WHERE "id" != 'singleton';
ALTER TABLE "app_profile" ALTER COLUMN "userId" SET NOT NULL;
CREATE UNIQUE INDEX "app_profile_userId_key" ON "app_profile"("userId");
ALTER TABLE "app_profile" ADD CONSTRAINT "app_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
