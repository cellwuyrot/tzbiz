-- CreateTable
CREATE TABLE "LeadRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "serviceId" TEXT,
    "serviceTitle" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "privacyConsentAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeadRequest_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "LeadRequest_status_idx" ON "LeadRequest"("status");
CREATE INDEX "LeadRequest_createdAt_idx" ON "LeadRequest"("createdAt");
CREATE INDEX "LeadRequest_email_idx" ON "LeadRequest"("email");
CREATE INDEX "LeadRequest_serviceId_idx" ON "LeadRequest"("serviceId");
