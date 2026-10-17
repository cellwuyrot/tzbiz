ALTER TABLE "CommerceSettings" ADD COLUMN "sellerInn" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CommerceSettings" ADD COLUMN "sellerKpp" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CommerceSettings" ADD COLUMN "bankName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CommerceSettings" ADD COLUMN "bankBik" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CommerceSettings" ADD COLUMN "bankAccount" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CommerceSettings" ADD COLUMN "bankCorrespondentAccount" TEXT NOT NULL DEFAULT '';
CREATE TABLE "Invoice" (
 "id" TEXT NOT NULL PRIMARY KEY, "number" TEXT NOT NULL, "requestKey" TEXT NOT NULL, "requestHash" TEXT NOT NULL,
 "userId" TEXT NOT NULL, "orderId" TEXT, "method" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'ISSUED', "revision" INTEGER NOT NULL DEFAULT 1,
 "title" TEXT NOT NULL, "amountMinor" INTEGER NOT NULL, "currency" TEXT NOT NULL DEFAULT 'RUB',
 "buyerName" TEXT NOT NULL, "buyerInn" TEXT NOT NULL DEFAULT '', "buyerDetails" TEXT NOT NULL DEFAULT '',
 "sellerSnapshot" TEXT NOT NULL, "taxNote" TEXT NOT NULL, "paymentUrl" TEXT NOT NULL DEFAULT '',
 "periodMonths" INTEGER, "renewalTerms" TEXT NOT NULL DEFAULT '', "dueDate" DATETIME NOT NULL,
 "paidAt" DATETIME, "paymentReference" TEXT NOT NULL DEFAULT '', "createdById" TEXT NOT NULL, "history" TEXT NOT NULL DEFAULT '[]',
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
 CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");
CREATE UNIQUE INDEX "Invoice_requestKey_key" ON "Invoice"("requestKey");
CREATE INDEX "Invoice_userId_createdAt_idx" ON "Invoice"("userId","createdAt");
CREATE INDEX "Invoice_status_createdAt_idx" ON "Invoice"("status","createdAt");

CREATE TABLE "MaintenanceState" ("key" TEXT NOT NULL PRIMARY KEY, "lastSuccessAt" DATETIME NOT NULL);
