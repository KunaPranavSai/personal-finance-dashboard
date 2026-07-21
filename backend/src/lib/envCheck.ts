const FALLBACK_VALUES = new Set(["pfd-access-secret", "pfd-refresh-secret", "pfd-cookie-secret"]);
const MIN_SECRET_LENGTH = 20;

interface EnvRule {
  name: string;
  minLength?: number;
  rejectFallback?: boolean;
}

const REQUIRED_IN_PRODUCTION: EnvRule[] = [
  { name: "DATABASE_URL" },
  { name: "JWT_ACCESS_SECRET", minLength: MIN_SECRET_LENGTH, rejectFallback: true },
  { name: "JWT_REFRESH_SECRET", minLength: MIN_SECRET_LENGTH, rejectFallback: true },
  { name: "COOKIE_SECRET", minLength: MIN_SECRET_LENGTH, rejectFallback: true },
  { name: "APP_URL" },
];

/**
 * Fails fast in production if critical secrets are missing or left at their
 * insecure source-code fallback values (see auth.routes.ts / app.ts). In
 * development this only warns, so local work isn't blocked by a missing .env.
 */
export function checkEnv(): void {
  const isProd = process.env.NODE_ENV === "production";
  const problems: string[] = [];

  for (const rule of REQUIRED_IN_PRODUCTION) {
    const value = process.env[rule.name];
    if (!value) {
      problems.push(`${rule.name} is not set`);
      continue;
    }
    if (rule.rejectFallback && FALLBACK_VALUES.has(value)) {
      problems.push(`${rule.name} is still set to its insecure default value`);
    }
    if (rule.minLength && value.length < rule.minLength) {
      problems.push(`${rule.name} is too short (expected at least ${rule.minLength} characters)`);
    }
  }

  if (problems.length === 0) return;

  const message = `Environment validation failed:\n${problems.map((p) => `  - ${p}`).join("\n")}`;
  if (isProd) {
    console.error(message);
    console.error("Refusing to start in production with an insecure or incomplete configuration.");
    process.exit(1);
  } else {
    console.warn(`${message}\n(Continuing anyway — NODE_ENV is not "production".)`);
  }
}
