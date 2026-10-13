-- Nullable fields preserve historical leads without inventing acceptance.
ALTER TABLE "LeadRequest" ADD COLUMN "agreementAcceptedAt" TIMESTAMP(3);
ALTER TABLE "LeadRequest" ADD COLUMN "agreementVersion" TEXT;
ALTER TABLE "LeadRequest" ADD COLUMN "privacyVersion" TEXT;
