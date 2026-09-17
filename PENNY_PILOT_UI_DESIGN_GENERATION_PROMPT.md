# Penny Pilot — UI/UX Design Generation Prompt

## Purpose

You are a **senior product UI/UX designer and frontend design systems architect** working on the existing **Penny Pilot** personal-finance application.

Your task is to **design (and, where instructed, implement) the Penny Pilot user interface** using `PENNY_PILOT_BACKEND_UI_UX_DESIGN_SPEC.md` (in the repo root) as your **single source of truth**. That document was produced by an exhaustive, read-only analysis of the actual backend and frontend codebase — it tells you exactly what data, states, endpoints, validation rules, error conditions, and existing UI patterns are real, as opposed to what a generic finance app "should" have.

Do **not** design a generic finance dashboard. Design Penny Pilot from its real backend contracts, real storage architecture (Google Drive + Local-Only), real security model, and real user workflows, as documented in the spec.

---

## 1. Required reading before you design anything

Read `PENNY_PILOT_BACKEND_UI_UX_DESIGN_SPEC.md` in full before producing any design output. Pay special attention to:

- **§4–5** — architecture and data model, especially the fact that financial data lives in the user's own Google Drive (not Postgres), and that a parallel Local-Only/IndexedDB storage mode exists client-side.
- **§9–10** (financial module specs + dashboard data mapping) — exact fields, validation rules, and computed values (e.g. budget status, financial health score, goal progress) for every screen you design.
- **§11–17** (auth, recovery, Google Drive UX, Local-Only UX, backup/import, migration) — these are not optional edge cases; they are core flows with real state machines you must design screens for.
- **§18–20** (error system, error presentation rules, success/failure/unknown states) — every mutation you design a UI for must account for these three outcomes, not just success/failure.
- **§31–34** (visual design system extraction, dark mode, motion, state library) — distinguishes what's `CURRENTLY IMPLEMENTED` from `DESIGN RECOMMENDATION`. Preserve the former; propose deliberately on the latter.
- **§40–41** (UI state matrix, backend-to-frontend traceability) — use these as your working checklist so no screen ships without its full state set.
- **§45–46** and the spec's own "Critical unresolved / open questions" — do not silently resolve these. Surface them back to me as design decisions before you commit to an interaction pattern that depends on the answer (see §5 below).

## 2. Source-of-truth rule

Priority order, matching the spec's own methodology:

1. What the spec marks `CURRENT` (already implemented) — this is what exists today; redesign it, don't reinvent its data contract.
2. What the spec marks `PARTIAL` — design the missing piece, but keep it consistent with the implemented portion.
3. What the spec marks `MISSING` — you may design it, but label your output `DESIGN RECOMMENDATION` and flag that it requires backend work.
4. What the spec marks `NOT VERIFIED` — do not assume behavior. Either design defensively (cover multiple plausible states) or list it as an open question rather than guessing.

Never invent fields, endpoints, validation rules, or states that aren't in the spec. If you need something the spec doesn't cover, say so explicitly rather than fabricating it.

## 3. Scope of this design pass

Produce UI designs (screen layouts, component specs, and interaction flows — not necessarily production code unless I ask for that separately) for:

1. **Design system foundations** — typography, color (light + dark, per spec §31/§32), spacing, elevation, and the core component set from spec §39 (KPI card, data table, financial row, currency input, modal, toast, banner, empty/skeleton/error states, etc.). Mark each as `CURRENTLY IMPLEMENTED` (refine only) vs `DESIGN RECOMMENDATION` (new).
2. **Screen inventory** — one design per screen in spec §38, organized by group: Public/Auth → Onboarding (storage-mode choice + Local-Only warning) → Authenticated app (Dashboard, Expenses, Income, Transactions, Budgets, Investments, Bills/EMIs, Goals, Savings, Categories, Wallets, Money Sources, Analytics, Reports, Notifications, Profile, Settings) → Settings sub-sections (Appearance, Security incl. 2FA/Passkeys/Recovery setup, Data & Storage, Privacy) → Admin → Error/system pages (403, offline, session-expired).
3. **Full state coverage per screen**, per spec §40's UI state matrix: initial, loading (skeleton), success-with-data, success-empty (with a meaningful CTA, never fake data), validation error, auth error, network error, storage error (Drive-specific per §14, e.g. quota full vs permission revoked vs auth expired — these must NOT share one generic message), unknown-outcome (per §20 — never say "not saved" when the outcome is actually unknown), and recovery.
4. **Forms**, per spec §21's field-level table — every form must show field order, labels, required/optional, input type, validation, conditional fields (e.g. Bill's `interestRate`/`tenureMonths` only for EMI-type bills, per spec §9), and duplicate-submit prevention.
5. **The account recovery flow** as an explicit multi-step wizard matching the spec's documented state machine (method choice → OTP/TOTP/security-questions → authorized → reset → complete), including lockout and rate-limit states — do not simplify this into a generic "forgot password" screen.
6. **The Google Drive and Local-Only onboarding/storage flows**, matching spec §14–17 exactly: storage-mode choice screen, Local-Only risk acknowledgment (checkbox-gated), Drive connect/OAuth/callback/account-choice states, and the Data & Storage settings panel (export/import/switch-mode).
7. **Error-to-UI mapping**, per spec §18–19 — build the actual error code table (from spec §4.4/§18) into component-level designs: which errors get a toast vs inline field error vs persistent banner vs full recovery panel, and the exact recovery action (Reconnect Drive / Free Up Space / Verify Data / Retry) tied to each.
8. **Responsive behavior** at 375/390/430px and desktop (spec §29) and accessibility requirements (spec §30) for every screen, not as an afterthought pass.

## 4. Constraints (carried over from the extraction phase — still binding)

- This is a **design task**, not a blind implementation task. If you also write code, treat the spec's `CURRENT` marks as the existing contract you must not break, and get my confirmation before touching any backend code, Prisma schema, or Drive/local storage logic.
- Do not invent backend behavior, API fields, or states that aren't in the spec.
- Use the product's actual terminology from the spec (Money Source, not Payment Method; Wallet, not Account; This Device Only, not just "local"; the user's own Google Drive, not "cloud storage").
- Currency is INR throughout; follow spec §36 for amount/sign/rounding conventions.
- Never design fake/sample financial data into empty states or charts — use the spec's documented empty-state and zero-data CTA guidance instead.
- Never expose anything the spec lists as security-sensitive (tokens, hashes, OTPs, secrets) in any UI, including debug/admin views.
- Admins must never see another user's financial records — this is confirmed architecturally impossible per spec §27, and no admin screen should imply otherwise.

## 5. Where the spec has open questions, ask me first

The spec explicitly flags several unresolved points that affect UI copy and interaction design. Before finalizing designs that depend on these, ask me for a decision rather than guessing:

- Whether "Switch to Google Drive" in Settings actually migrates existing Local-Only data, or only flips a mode flag (affects whether the UI can promise "your data will move" or must instead warn "start fresh in Drive").
- Whether Drive-to-Drive account switching should show a "Drive A stays active while B is prepared" pattern per the Master Plan, or reflect the current reconnect-based implementation.
- The exact intended behavior of Investment's `isAutoSync` toggle (spec found no backing sync service) — should the UI treat it as a working feature, a "coming soon" state, or be omitted until backend work lands?
- Whether Goals should get a `targetDate` field added (currently missing from the schema) before you design "time remaining" / "on track" UI, or whether that messaging should be deferred.

## 6. Deliverable format

Unless I specify otherwise, produce your output as:

1. A short design-system summary (tokens + core components, CURRENT vs RECOMMENDATION).
2. Per-screen specs grouped as in §3.2 above, each covering layout, states (per §3.3), and any forms/tables/charts it contains.
3. A running list of open questions from §5 plus anything else you hit that the spec marks `NOT VERIFIED` and that materially affects a design decision.

Work through the full screen inventory before stopping — don't produce a partial pass and call it done. If the scope is too large for one response, tell me which batch of screens you're covering now and what's queued next, rather than silently truncating.
