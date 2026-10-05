"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { isRememberSession, markLoggedInToday, pinToday, readLoginDay } from "@/lib/pinDay";

/**
 * Without "Remember me", sign-in is required once per local calendar day on a device: when the day rolls over
 * (checked on load, on focus, and every minute for tabs left open overnight) the session ends
 * and the login page (PIN or email/User ID) takes over. Sessions that predate this rule are
 * stamped as today's rather than logged out.
 */
export function useDailyLogin(loginPath = "/login") {
  const { user, logout } = useAuth();
  const router = useRouter();
  const uid = user?.uid;

  useEffect(() => {
    // Remembered sessions are persistent until logout; the server ends them, and PinGate handles the daily unlock.
    if (!uid || isRememberSession()) return;
    const check = () => {
      const day = readLoginDay(uid);
      if (day === null) { markLoggedInToday(uid); return; }
      if (day !== pinToday()) void logout({ preserveRedirect: true }).then(() => router.replace(loginPath));
    };
    check();
    const t = window.setInterval(check, 60000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [uid, logout, router, loginPath]);
}
