import "dotenv/config";
import { createApp } from "./app";
import { ensureReferenceData } from "./lib/startup";
import { initSessionVersion } from "./lib/sessionVersion";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

async function main() {
  try {
    await ensureReferenceData();
  } catch (err) {
    console.warn("Reference data initialization skipped:", (err as Error).message);
  }

  try {
    await initSessionVersion();
  } catch (err) {
    console.warn("Session version initialization skipped:", (err as Error).message);
  }

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Penny Pilot API listening on http://localhost:${PORT}`);
  });
}

main();