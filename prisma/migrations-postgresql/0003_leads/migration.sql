CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'DONE');

CREATE TABLE "LeadRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "serviceId" TEXT,
    "serviceTitle" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "privacyConsentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeadRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadRequest_status_idx" ON "LeadRequest"("status");
CREATE INDEX "LeadRequest_createdAt_idx" ON "LeadRequest"("createdAt");
CREATE INDEX "LeadRequest_email_idx" ON "LeadRequest"("email");
CREATE INDEX "LeadRequest_serviceId_idx" ON "LeadRequest"("serviceId");

ALTER TABLE "LeadRequest" ADD CONSTRAINT "LeadRequest_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
