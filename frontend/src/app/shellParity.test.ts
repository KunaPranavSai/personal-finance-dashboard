import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Regression: the outbox worker, push identity sync and install prompt were mounted only in the DESKTOP branch of the app
// shell, so the phone PWA never ran them (saves stayed blocking, offline items never synced). Every shell branch must mount
// <ShellServices />.
describe("app shell parity (phone and desktop)", () => {
  const src = readFileSync("src/app/(app)/AppShellLayoutClient.tsx", "utf8");

  it("mounts ShellServices in both the mobile and the desktop branch", () => {
    expect(src.match(/<ShellServices \/>/g)).toHaveLength(2);
  });

  it("never mounts the individual services directly (they would drift between branches again)", () => {
    for (const name of ["OfflineSyncManager", "PushIdentitySync", "PwaInstallPrompt"]) expect(src).not.toMatch(new RegExp(`<${name}\b`));
  });

  it("ShellServices contains all three", () => {
    const s = readFileSync("src/components/pwa/ShellServices.tsx", "utf8");
    for (const name of ["OfflineSyncManager", "PushIdentitySync", "PwaInstallPrompt"]) expect(s).toContain(`<${name} />`);
  });
});
