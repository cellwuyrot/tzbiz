-- CreateTable
CREATE TABLE "ServiceSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tzSubject" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "snapshot" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "months" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "allowCancel" BOOLEAN NOT NULL,
    "rebillEncrypted" TEXT,
    "consent" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "activeKey" TEXT,
    "anchor" TIMESTAMP(3) NOT NULL,
    "paidUntil" TIMESTAMP(3),
    "paidIndex" INTEGER NOT NULL DEFAULT -1,
    "syncVersion" INTEGER NOT NULL DEFAULT 0,
    "syncPending" BOOLEAN NOT NULL DEFAULT false,
    "stopRequested" BOOLEAN NOT NULL DEFAULT false,
    "stopNow" BOOLEAN NOT NULL DEFAULT false,
    "leaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCycle" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "cycleIndex" INTEGER NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "terminalKey" TEXT NOT NULL,
    "paymentId" TEXT,
    "paymentUrl" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'CREATING',
    "rebillEncrypted" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceNotice" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "leaseUntil" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceSubscription_requestKey_key" ON "ServiceSubscription"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceSubscription_activeKey_key" ON "ServiceSubscription"("activeKey");

-- CreateIndex
CREATE INDEX "ServiceSubscription_userId_createdAt_idx" ON "ServiceSubscription"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceSubscription_status_paidUntil_idx" ON "ServiceSubscription"("status", "paidUntil");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCycle_paymentId_key" ON "ServiceCycle"("paymentId");

-- CreateIndex
CREATE INDEX "ServiceCycle_status_updatedAt_idx" ON "ServiceCycle"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCycle_subscriptionId_cycleIndex_key" ON "ServiceCycle"("subscriptionId", "cycleIndex");

-- CreateIndex
CREATE INDEX "ServiceNotice_status_availableAt_idx" ON "ServiceNotice"("status", "availableAt");

