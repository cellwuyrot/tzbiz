-- AlterTable
ALTER TABLE "LeadRequest" ADD COLUMN     "agreementAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "agreementVersion" TEXT,
ADD COLUMN     "privacyVersion" TEXT;

