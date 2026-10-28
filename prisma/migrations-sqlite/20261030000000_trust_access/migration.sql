ALTER TABLE "ServiceSubscription" ADD COLUMN "trustUntil" DATETIME;
CREATE TABLE "ServiceTrustGrant" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "tzSubject" TEXT NOT NULL,
 "serviceId" TEXT NOT NULL,
 "subscriptionId" TEXT NOT NULL,
 "until" DATETIME NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ServiceTrustGrant_tzSubject_serviceId_key" ON "ServiceTrustGrant"("tzSubject", "serviceId");
CREATE UNIQUE INDEX "ServiceTrustGrant_subscriptionId_key" ON "ServiceTrustGrant"("subscriptionId");
CREATE TABLE "ServiceTrustPolicy" (
 "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'services',
 "hours" INTEGER NOT NULL DEFAULT 24,
 "updatedBy" TEXT,
 "updatedAt" DATETIME NOT NULL
);
