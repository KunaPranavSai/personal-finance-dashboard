"use client";

import { useEffect } from "react";
import { syncPushIdentity } from "@/lib/push";

/** Mounted in the authenticated shell: tells the service worker who is signed in (so it can drop another account's pushes). */
export function PushIdentitySync() {
  useEffect(() => {
    void syncPushIdentity();
  }, []);
  return null;
}
