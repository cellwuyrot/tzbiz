-- AlterTable
ALTER TABLE "LeadRequest" ADD COLUMN "requestHash" TEXT;
ALTER TABLE "LeadRequest" ADD COLUMN "submissionKey" TEXT;

-- CreateTable
CREATE TABLE "ServiceAlias" (
    "slug" TEXT NOT NULL PRIMARY KEY,
    "serviceId" TEXT NOT NULL,
    CONSTRAINT "ServiceAlias_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommerceSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'commerce',
    "sellerName" TEXT NOT NULL DEFAULT '',
    "sellerDetails" TEXT NOT NULL DEFAULT '',
    "supportEmail" TEXT NOT NULL DEFAULT 'info@trioz.ru',
    "paymentInstructions" TEXT NOT NULL DEFAULT '',
    "fulfillmentTerms" TEXT NOT NULL DEFAULT '',
    "refundTerms" TEXT NOT NULL DEFAULT '',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BusinessOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "settlementMode" TEXT NOT NULL,
    "amountMinor" INTEGER,
    "currency" TEXT NOT NULL,
    "planRevision" INTEGER NOT NULL,
    "snapshot" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "history" TEXT NOT NULL DEFAULT '[]',
    "message" TEXT NOT NULL,
    "acceptedAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BusinessOrder_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BillingPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RateBucket" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "hits" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MailJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "availableAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" DATETIME,
    "leaseToken" TEXT,
    "errorCategory" TEXT,
    CONSTRAINT "MailJob_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "LeadRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BillingPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "serviceId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "settlementMode" TEXT NOT NULL DEFAULT 'PREPAYMENT',
    "externalProductId" TEXT NOT NULL DEFAULT '',
    "amountMinor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "periodUnit" TEXT,
    "periodCount" INTEGER,
    "renewalTerms" TEXT NOT NULL DEFAULT '',
    "cancellationTerms" TEXT NOT NULL DEFAULT '',
    "internalNotes" TEXT NOT NULL DEFAULT '',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BillingPlan_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BillingPlan" ("amountMinor", "cancellationTerms", "createdAt", "currency", "description", "id", "internalNotes", "isArchived", "isPublished", "kind", "mode", "periodCount", "periodUnit", "renewalTerms", "revision", "serviceId", "title", "updatedAt") SELECT "amountMinor", "cancellationTerms", "createdAt", "currency", "description", "id", "internalNotes", "isArchived", "isPublished", "kind", "mode", "periodCount", "periodUnit", "renewalTerms", "revision", "serviceId", "title", "updatedAt" FROM "BillingPlan";
DROP TABLE "BillingPlan";
ALTER TABLE "new_BillingPlan" RENAME TO "BillingPlan";
CREATE INDEX "BillingPlan_isPublished_isArchived_idx" ON "BillingPlan"("isPublished", "isArchived");
CREATE INDEX "BillingPlan_serviceId_idx" ON "BillingPlan"("serviceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ServiceAlias_serviceId_idx" ON "ServiceAlias"("serviceId");

-- CreateIndex
CREATE INDEX "BusinessOrder_userId_createdAt_idx" ON "BusinessOrder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessOrder_status_idx" ON "BusinessOrder"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessOrder_userId_requestKey_key" ON "BusinessOrder"("userId", "requestKey");

-- CreateIndex
CREATE INDEX "RateBucket_expiresAt_idx" ON "RateBucket"("expiresAt");

-- CreateIndex
CREATE INDEX "MailJob_status_availableAt_idx" ON "MailJob"("status", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "MailJob_leadId_channel_key" ON "MailJob"("leadId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "LeadRequest_submissionKey_key" ON "LeadRequest"("submissionKey");


-- Preserve old one-time offers as prepayment; old recurring offers remain recurring.
UPDATE "BillingPlan" SET "settlementMode" = 'SUBSCRIPTION' WHERE "mode" = 'RECURRING';
-- A central product without its actual ID/interval must not masquerade as buyable.
UPDATE "BillingPlan" SET "isPublished" = false WHERE "kind" IN ('PREMIUM','VPN');
