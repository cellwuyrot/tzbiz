ALTER TABLE "Session" ADD COLUMN "tzRefreshTokenEncrypted" TEXT;
ALTER TABLE "Session" ADD COLUMN "tzAccessTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "Session" ADD COLUMN "tzRefreshLockUntil" TIMESTAMP(3);
