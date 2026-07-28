-- Additive only: links the existing User row to a Clerk identity. No columns
-- dropped, no existing data touched, no foreign keys changed. Both new
-- columns are nullable so every existing row remains valid untouched, and
-- the legacy auth system (password/2FA/session columns below) keeps working
-- exactly as before when AUTH_PROVIDER=legacy (the default).
ALTER TABLE "User" ADD COLUMN "clerkUserId" TEXT;
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;

-- Postgres unique indexes allow multiple NULLs, so existing (non-Clerk) rows
-- are unaffected by this constraint.
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");
