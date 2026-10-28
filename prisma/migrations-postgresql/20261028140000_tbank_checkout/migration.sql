CREATE TABLE "BankPayment" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "orderId" TEXT NOT NULL,
 "activeKey" TEXT,
 "paymentId" TEXT,
 "terminalKey" TEXT NOT NULL,
 "amountMinor" INTEGER NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'CREATING',
 "paymentUrl" TEXT NOT NULL DEFAULT '',
 "revision" INTEGER NOT NULL DEFAULT 1,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "BankPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "BusinessOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BankPayment_activeKey_key" ON "BankPayment"("activeKey");
CREATE UNIQUE INDEX "BankPayment_paymentId_key" ON "BankPayment"("paymentId");
CREATE INDEX "BankPayment_orderId_createdAt_idx" ON "BankPayment"("orderId", "createdAt");
