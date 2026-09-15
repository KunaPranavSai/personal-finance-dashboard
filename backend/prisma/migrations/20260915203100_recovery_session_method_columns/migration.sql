-- Additive only: new nullable/defaulted columns on RecoverySession for the
-- choice-based recovery flow. Depends on 20260915203000_recovery_state_enum_values
-- having already been committed (new enum default value used here).

ALTER TABLE "RecoverySession"
  ADD COLUMN "method" TEXT,
  ADD COLUMN "totpAttempts" INTEGER NOT NULL DEFAULT 0,
  ALTER COLUMN "state" SET DEFAULT 'STARTED';
