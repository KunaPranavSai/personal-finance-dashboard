-- CreateTable
CREATE TABLE "PaymentMethodType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMethodType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethodType_name_key" ON "PaymentMethodType"("name");

-- Seed rows for the existing enum values
INSERT INTO "PaymentMethodType" ("id", "name") VALUES
    ('seed-cash', 'CASH'),
    ('seed-upi', 'UPI'),
    ('seed-credit-card', 'CREDIT_CARD'),
    ('seed-debit-card', 'DEBIT_CARD'),
    ('seed-net-banking', 'NET_BANKING'),
    ('seed-wallet', 'WALLET');

-- AlterTable: add new relation column
ALTER TABLE "Transaction" ADD COLUMN "paymentMethodTypeId" TEXT;

-- Backfill new column from the old enum column
UPDATE "Transaction" SET "paymentMethodTypeId" = CASE "paymentMethod"
    WHEN 'CASH' THEN 'seed-cash'
    WHEN 'UPI' THEN 'seed-upi'
    WHEN 'CREDIT_CARD' THEN 'seed-credit-card'
    WHEN 'DEBIT_CARD' THEN 'seed-debit-card'
    WHEN 'NET_BANKING' THEN 'seed-net-banking'
    WHEN 'WALLET' THEN 'seed-wallet'
    ELSE NULL
END
WHERE "paymentMethod" IS NOT NULL;

-- Drop old enum column
ALTER TABLE "Transaction" DROP COLUMN "paymentMethod";

-- DropEnum
DROP TYPE "PaymentMethod";

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_paymentMethodTypeId_fkey" FOREIGN KEY ("paymentMethodTypeId") REFERENCES "PaymentMethodType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
