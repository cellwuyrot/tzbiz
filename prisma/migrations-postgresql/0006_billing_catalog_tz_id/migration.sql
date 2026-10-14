-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "tzAccessTokenEncrypted" TEXT,
ADD COLUMN     "tzIssuer" TEXT,
ADD COLUMN     "tzSubject" TEXT;

-- CreateTable
CREATE TABLE "TzIdentityLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TzIdentityLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TzLoginAttempt" (
    "stateHash" TEXT NOT NULL,
    "localUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "TzLoginAttempt_pkey" PRIMARY KEY ("stateHash")
);

-- CreateTable
CREATE TABLE "BillingPlan" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "serviceId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPlanAudit" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "actorId" TEXT,
    "revision" INTEGER NOT NULL,
    "snapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingPlanAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TzIdentityLink_userId_key" ON "TzIdentityLink"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TzIdentityLink_issuer_subject_key" ON "TzIdentityLink"("issuer", "subject");

-- CreateIndex
CREATE INDEX "TzLoginAttempt_expiresAt_idx" ON "TzLoginAttempt"("expiresAt");

-- CreateIndex
CREATE INDEX "BillingPlan_isPublished_isArchived_idx" ON "BillingPlan"("isPublished", "isArchived");

-- CreateIndex
CREATE INDEX "BillingPlan_serviceId_idx" ON "BillingPlan"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPlanAudit_planId_revision_key" ON "BillingPlanAudit"("planId", "revision");

-- AddForeignKey
ALTER TABLE "TzIdentityLink" ADD CONSTRAINT "TzIdentityLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPlan" ADD CONSTRAINT "BillingPlan_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPlanAudit" ADD CONSTRAINT "BillingPlanAudit_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPlanAudit" ADD CONSTRAINT "BillingPlanAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
