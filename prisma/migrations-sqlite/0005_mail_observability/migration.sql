-- Historical leads have no trustworthy mail history; never mark them delivered.
ALTER TABLE "LeadRequest" ADD COLUMN "clientEmailStatus" TEXT NOT NULL DEFAULT 'UNTRACKED';
ALTER TABLE "LeadRequest" ADD COLUMN "clientEmailAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LeadRequest" ADD COLUMN "clientEmailAttemptedAt" DATETIME;
ALTER TABLE "LeadRequest" ADD COLUMN "clientEmailErrorCategory" TEXT;
ALTER TABLE "LeadRequest" ADD COLUMN "internalEmailStatus" TEXT NOT NULL DEFAULT 'UNTRACKED';
ALTER TABLE "LeadRequest" ADD COLUMN "internalEmailAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LeadRequest" ADD COLUMN "internalEmailAttemptedAt" DATETIME;
ALTER TABLE "LeadRequest" ADD COLUMN "internalEmailErrorCategory" TEXT;
CREATE TABLE "IntegrationCheck" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "status" TEXT NOT NULL,
  "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "errorCategory" TEXT
);
