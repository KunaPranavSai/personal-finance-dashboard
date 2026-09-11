// Single source of truth for the legal-document version identifiers recorded
// on a consent record and shown in the generated consent PDF. Mirrors the
// "Last updated" dates on the frontend's /terms and /privacy-policy pages
// (frontend/src/app/terms/page.tsx, frontend/src/app/privacy-policy/page.tsx)
// — bump both the version and this comment's reference date together if the
// legal text is materially revised.
export const TERMS_VERSION = "1.0";
export const TERMS_LAST_UPDATED = "September 11, 2026";

export const PRIVACY_VERSION = "1.0";
export const PRIVACY_LAST_UPDATED = "September 11, 2026";
