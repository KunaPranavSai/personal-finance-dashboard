"use client";

import { OfflineSyncManager } from "./OfflineSyncManager";
import { PushIdentitySync } from "./PushIdentitySync";
import { PwaInstallPrompt } from "./PwaInstallPrompt";

/**
 * Background services every signed-in screen needs, on phone AND desktop: the durable save outbox (sets the signed-in owner,
 * syncs, shows pending/refused entries), the push identity check, and the install prompt. They were once mounted only in the
 * desktop layout, so the phone PWA never started the outbox worker. Mount THIS in every shell branch (a test enforces it).
 */
export function ShellServices() {
  return (
    <>
      <OfflineSyncManager />
      <PushIdentitySync />
      <PwaInstallPrompt />
    </>
  );
}
