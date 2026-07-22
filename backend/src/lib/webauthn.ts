// Shared WebAuthn (passkey) relying-party config, derived from the same
// APP_URL/FRONTEND_URL env vars already used for CORS and email links (see
// backend/src/app.ts) so there's no separate config surface to keep in sync.
function parseOriginList(value: string | undefined): string[] {
  return (value ?? "").split(",").map((v) => v.trim()).filter(Boolean);
}

const isProd = process.env.NODE_ENV === "production";

export const RP_ORIGINS = [
  ...parseOriginList(process.env.APP_URL),
  ...parseOriginList(process.env.FRONTEND_URL),
  ...(!isProd ? ["http://localhost:3000"] : []),
];

// The RP ID must be a bare domain (no scheme/port) and must be the same
// domain, or a parent domain, of the origin the browser navigated to.
export const RP_ID = (() => {
  const first = RP_ORIGINS[0];
  if (!first) return "localhost";
  try {
    return new URL(first).hostname;
  } catch {
    return "localhost";
  }
})();

export const RP_NAME = "Penny Pilot";
