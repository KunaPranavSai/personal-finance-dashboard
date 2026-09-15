-- Additive only: new RecoveryState enum values for the choice-based recovery
-- flow. Split into its own migration because Postgres forbids using a new
-- enum value in the same transaction that adds it.

ALTER TYPE "RecoveryState" ADD VALUE IF NOT EXISTS 'STARTED';
ALTER TYPE "RecoveryState" ADD VALUE IF NOT EXISTS 'METHOD_SELECTED';
ALTER TYPE "RecoveryState" ADD VALUE IF NOT EXISTS 'TOTP_VERIFIED';
ALTER TYPE "RecoveryState" ADD VALUE IF NOT EXISTS 'SECURITY_QUESTIONS_VERIFIED';
