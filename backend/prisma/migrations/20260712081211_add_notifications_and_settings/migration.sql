-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "data" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_read_idx" ON "Notification"("read");
