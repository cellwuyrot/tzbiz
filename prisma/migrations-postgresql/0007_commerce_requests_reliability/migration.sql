-- AlterTable
ALTER TABLE "LeadRequest" ADD COLUMN     "requestHash" TEXT,
ADD COLUMN     "submissionKey" TEXT;

-- AlterTable
ALTER TABLE "BillingPlan" ADD COLUMN     "externalProductId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "settlementMode" TEXT NOT NULL DEFAULT 'PREPAYMENT';

-- CreateTable
CREATE TABLE "ServiceAlias" (
    "slug" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    CONSTRAINT "ServiceAlias_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "CommerceSettings" (
    "id" TEXT NOT NULL DEFAULT 'commerce',
    "sellerName" TEXT NOT NULL DEFAULT '',
    "sellerDetails" TEXT NOT NULL DEFAULT '',
    "supportEmail" TEXT NOT NULL DEFAULT 'info@trioz.ru',
    "paymentInstructions" TEXT NOT NULL DEFAULT '',
    "fulfillmentTerms" TEXT NOT NULL DEFAULT '',
    "refundTerms" TEXT NOT NULL DEFAULT '',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessOrder" (
    "id" TEXT NOT NULL,
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
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateBucket" (
    "key" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "MailJob" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" TEXT,
    "errorCategory" TEXT,

    CONSTRAINT "MailJob_pkey" PRIMARY KEY ("id")
);

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

-- AddForeignKey
ALTER TABLE "ServiceAlias" ADD CONSTRAINT "ServiceAlias_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessOrder" ADD CONSTRAINT "BusinessOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessOrder" ADD CONSTRAINT "BusinessOrder_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailJob" ADD CONSTRAINT "MailJob_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "LeadRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Preserve old one-time offers as prepayment; old recurring offers remain recurring.
UPDATE "BillingPlan" SET "settlementMode" = 'SUBSCRIPTION' WHERE "mode" = 'RECURRING';
-- A central product without its actual ID/interval must not masquerade as buyable.
UPDATE "BillingPlan" SET "isPublished" = false WHERE "kind" IN ('PREMIUM','VPN');
