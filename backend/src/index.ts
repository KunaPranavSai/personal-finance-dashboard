import "dotenv/config";
import { createApp } from "./app";
import { initSessionVersion } from "./lib/sessionVersion";
import { initSessionRevocations } from "./lib/sessionRevocation";
import { checkEnv } from "./lib/envCheck";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

async function main() {
  checkEnv();

  try {
    await initSessionVersion();
  } catch (err) {
    console.warn("Session version initialization skipped:", (err as Error).message);
  }

  try {
    await initSessionRevocations();
  } catch (err) {
    console.warn("Session revocation initialization skipped:", (err as Error).message);
  }

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Penny Pilot API listening on http://localhost:${PORT}`);
  });
}

main();