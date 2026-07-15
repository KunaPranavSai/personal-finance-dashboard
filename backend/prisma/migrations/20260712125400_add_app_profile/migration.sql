-- CreateTable
CREATE TABLE "app_profile" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "data" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "app_profile_pkey" PRIMARY KEY ("id")
);
