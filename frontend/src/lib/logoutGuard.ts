"use client";

import { useCallback } from "react";
import { useAuth } from "./AuthContext";
import { usePpConfirm } from "@/components/ui/PpConfirm";
import { countUnsynced } from "./pendingTransactions";
import { requestFlush } from "./offlineSync";

/**
 * Call before a DELIBERATE sign-out. Resolves true when it is fine to continue.
 * If this account still has entries Drive hasn't confirmed, the user chooses: stay signed in (and we keep syncing) or
 * sign out anyway. Signing out never deletes them: they stay on this device, tied to this account, and are only ever sent
 * under this account's own session (lib/offlineSync owner check). Forced sign-outs (expired session, idle) can't ask,
 * and keep the entries the same way.
 */
export function useUnsyncedLogoutGuard() {
  const { user } = useAuth();
  const confirm = usePpConfirm();
  return useCallback(async (): Promise<boolean> => {
    const n = await countUnsynced(user?.uid ?? null);
    if (n === 0) return true;
    void requestFlush(); // while the user decides, keep trying
    const signOut = await confirm({
      title: "Changes are still syncing",
      message: `${n} ${n === 1 ? "change hasn't" : "changes haven't"} finished syncing to Google Drive. If you sign out now ${n === 1 ? "it stays" : "they stay"} on this device under your account and will sync the next time you sign in. Staying signed in lets them finish now.`,
      confirmLabel: "Sign out anyway",
      cancelLabel: "Stay signed in",
      danger: false,
    });
    return signOut;
  }, [user?.uid, confirm]);
}
