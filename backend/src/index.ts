import "dotenv/config";
import { createApp } from "./app";
import { ensureReferenceData } from "./lib/startup";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

async function main() {
  try {
    await ensureReferenceData();
  } catch (err) {
    console.warn("Reference data initialization skipped:", (err as Error).message);
  }

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Personal Finance Dashboard Pro API listening on http://localhost:${PORT}`);
  });
}

main();