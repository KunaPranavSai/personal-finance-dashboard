-- CreateTable
CREATE TABLE "EmailTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "preheader" TEXT NOT NULL DEFAULT '',
    "mode" TEXT NOT NULL DEFAULT 'blocks',
    "blocks" JSONB,
    "customHtml" TEXT,
    "compiledHtml" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "EmailTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplateVersion_templateKey_version_key" ON "EmailTemplateVersion"("templateKey", "version");

-- CreateIndex
CREATE INDEX "EmailTemplateVersion_templateKey_status_idx" ON "EmailTemplateVersion"("templateKey", "status");
