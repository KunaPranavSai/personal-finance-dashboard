The investigation is clean, and **the proposed reconciliation is the correct direction**.

I would approve **steps 1–3**, but I would **not automatically approve step 4 in the same run**. Keep the actual `ConsentRecord` migration as a separate approval after `migrate status` is clean.

Send Claude this:

```markdown
## APPROVED — RECONCILE MIGRATION HISTORY ONLY

Proceed with steps 1–3 only.

### Step 1
Restore the missing migration file verbatim from:

`772f856`

Specifically restore:

`backend/prisma/migrations/20260728100000_clerk_user_link/migration.sql`

Do not modify the historical SQL.

This is only to restore the local migration history and must not execute the migration.

### Step 2
Run:

`npx prisma migrate resolve --applied 20260728100000_clerk_user_link`

against the production database.

IMPORTANT:
- This must be metadata/history reconciliation only.
- Do not run the original migration SQL.
- Do not run migrate dev.
- Do not run migrate reset.
- Do not run db execute.
- Do not run db push.

### Step 3
Run:

`npx prisma migrate status`

Confirm that:

- There are no missing migrations.
- There are no unapplied historical migrations.
- There are no failed migrations.
- Migration history is synchronized between local and production.

Also verify that the production user count remains unchanged.

### STOP AFTER STEP 3

Do NOT create or apply the ConsentRecord migration yet.

Do NOT run `prisma migrate dev` yet.

Do NOT make any other production database changes.

After steps 1–3, report:

1. Exact migration status before/after.
2. Confirmation that the historical migration file was restored verbatim.
3. Confirmation that `migrate resolve` only reconciled migration metadata.
4. Confirmation that no migration SQL was executed.
5. Production user count before/after.
6. Final `prisma migrate status` output.
7. Whether the database is now safe to proceed with the new ConsentRecord migration.

Then STOP and wait for my approval.
```

### Why this separation is important

Claude's investigation found that the situation is actually very clean:

```text
2026-07-28
Clerk migration applied
        ↓
2026-07-30
Clerk feature reverted in Git
        ↓
2026-07-30
Clerk columns explicitly dropped by NEW migration
        ↓
Today
Production schema = correct
Only local migration history = missing one historical folder
```

So **we don't want to re-run that old migration**. Restoring its file + marking it as already applied is the appropriate reconciliation path based on Claude's findings.

Then we want:

```text
Historical migration restored
        ↓
migrate resolve --applied
        ↓
migrate status = clean
        ↓
STOP
        ↓
Review
        ↓
Create/apply ConsentRecord migration
        ↓
Test real signup
        ↓
Verify ConsentRecord
        ↓
Verify PDF
        ↓
Commit + push
        ↓
Production verification
```

**Don't approve the ConsentRecord migration yet.** Let Claude prove that the migration history is clean first.
