ALTER TABLE "Session" ADD COLUMN "tzRefreshTokenEncrypted" TEXT;
ALTER TABLE "Session" ADD COLUMN "tzAccessTokenExpiresAt" DATETIME;
ALTER TABLE "Session" ADD COLUMN "tzRefreshLockUntil" DATETIME;
