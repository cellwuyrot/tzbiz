-- Historical leads have no trustworthy mail history; never mark them delivered.
CREATE TYPE "MailNotificationStatus" AS ENUM ('UNTRACKED', 'PENDING', 'SMTP_ACCEPTED', 'FAILED', 'UNKNOWN');
ALTER TABLE "LeadRequest" ADD COLUMN "clientEmailStatus" "MailNotificationStatus" NOT NULL DEFAULT 'UNTRACKED';
ALTER TABLE "LeadRequest" ADD COLUMN "clientEmailAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LeadRequest" ADD COLUMN "clientEmailAttemptedAt" TIMESTAMP(3);
ALTER TABLE "LeadRequest" ADD COLUMN "clientEmailErrorCategory" TEXT;
ALTER TABLE "LeadRequest" ADD COLUMN "internalEmailStatus" "MailNotificationStatus" NOT NULL DEFAULT 'UNTRACKED';
ALTER TABLE "LeadRequest" ADD COLUMN "internalEmailAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LeadRequest" ADD COLUMN "internalEmailAttemptedAt" TIMESTAMP(3);
ALTER TABLE "LeadRequest" ADD COLUMN "internalEmailErrorCategory" TEXT;
CREATE TABLE "IntegrationCheck" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "status" TEXT NOT NULL,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "errorCategory" TEXT
);
