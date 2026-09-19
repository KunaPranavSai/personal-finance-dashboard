-- CreateTable
CREATE TABLE "UserEntitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planLabel" TEXT NOT NULL DEFAULT 'FREE',
    "features" JSONB NOT NULL DEFAULT '{}',
    "limits" JSONB NOT NULL DEFAULT '{}',
    "restricted" BOOLEAN NOT NULL DEFAULT false,
    "notifyEligible" BOOLEAN NOT NULL DEFAULT true,
    "emailEligible" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplateOverride" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "subject" TEXT,
    "html" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplateOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailAutomationConfig" (
    "id" TEXT NOT NULL,
    "triggerKey" TEXT NOT NULL,
    "templateKey" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailAutomationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserEntitlement_userId_key" ON "UserEntitlement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplateOverride_templateKey_key" ON "EmailTemplateOverride"("templateKey");

-- CreateIndex
CREATE UNIQUE INDEX "EmailAutomationConfig_triggerKey_key" ON "EmailAutomationConfig"("triggerKey");

-- AddForeignKey
ALTER TABLE "UserEntitlement" ADD CONSTRAINT "UserEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
