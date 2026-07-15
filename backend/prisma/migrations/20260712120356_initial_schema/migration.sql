-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "FixedVariable" AS ENUM ('FIXED', 'VARIABLE');

-- CreateEnum
CREATE TYPE "Essentiality" AS ENUM ('ESSENTIAL', 'NON_ESSENTIAL');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'NET_BANKING', 'WALLET');

-- CreateEnum
CREATE TYPE "BudgetPeriod" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('UNDER_BUDGET', 'NEAR_LIMIT', 'OVER_BUDGET');

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EntryType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subcategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "Subcategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "type" "EntryType" NOT NULL,
    "categoryId" TEXT NOT NULL,
    "subcategoryId" TEXT,
    "merchant" TEXT,
    "accountId" TEXT,
    "paymentMethod" "PaymentMethod",
    "location" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "fixedVariable" "FixedVariable",
    "essentiality" "Essentiality",
    "attachmentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "period" "BudgetPeriod" NOT NULL DEFAULT 'MONTHLY',
    "periodKey" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investment" (
    "id" TEXT NOT NULL,
    "instrument" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "currentValue" DECIMAL(14,2) NOT NULL,
    "monthlyContribution" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "annualReturnPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "autoPay" BOOLEAN NOT NULL DEFAULT false,
    "interestRate" DECIMAL(5,2),
    "tenureMonths" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "targetAmount" DECIMAL(14,2) NOT NULL,
    "currentAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "monthlyContribution" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Subcategory_categoryId_name_key" ON "Subcategory"("categoryId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Account_name_key" ON "Account"("name");

-- CreateIndex
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");

-- CreateIndex
CREATE INDEX "Transaction_categoryId_idx" ON "Transaction"("categoryId");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_categoryId_period_periodKey_key" ON "Budget"("categoryId", "period", "periodKey");

-- AddForeignKey
ALTER TABLE "Subcategory" ADD CONSTRAINT "Subcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
