-- Reverts the Clerk migration's additive columns (20260728100000_clerk_user_link).
-- Verified zero rows had clerkUserId set before this ran, so no data is lost.
DROP INDEX IF EXISTS "User_clerkUserId_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "clerkUserId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "avatarUrl";
