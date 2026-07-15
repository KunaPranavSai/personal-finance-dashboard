import "dotenv/config";
import { createApp } from "../src/app";
import { ensureReferenceData } from "../src/lib/startup";

const app = createApp();

// Run reference data seed on cold start (safe — idempotent)
ensureReferenceData().catch((err) =>
  console.warn("Reference data init skipped:", (err as Error).message)
);

export default app;
