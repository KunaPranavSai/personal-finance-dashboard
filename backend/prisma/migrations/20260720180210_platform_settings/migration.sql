-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "siteName" TEXT NOT NULL DEFAULT 'Penny Pilot',
    "supportEmail" TEXT,
    "defaultSessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 30,
    "minPasswordLength" INTEGER NOT NULL DEFAULT 8,
    "require2FAForAdmins" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton row
INSERT INTO "platform_settings" ("id", "updatedAt") VALUES ('singleton', NOW());
