"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIsMobile } from "@/lib/DeviceContext";
import { MobileSecurityView } from "@/components/mobile/MobileSecurityView";

/**
 * Real route for mobile 2FA/passkeys/password. Desktop has no separate
 * route for this — it's the "Security" tab within /settings — so desktop
 * UAs are redirected there, preserving the exact existing desktop tab UX
 * untouched. Mobile UAs get the native screen directly, no redirect.
 */
export default function SecuritySettingsPage() {
  const router = useRouter();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) return;
    router.replace("/settings?tab=security");
  }, [router, isMobile]);

  if (isMobile) return <MobileSecurityView />;
  return null;
}
