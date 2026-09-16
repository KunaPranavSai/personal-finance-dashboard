"use client";

import { createContext, useContext } from "react";

/**
 * Device decision resolved once, server-side, in the root layout (via
 * `headers()` + isMobileUserAgent) and threaded down as this context's
 * initial value. Deliberately never re-detected on the client — a
 * client-side check (e.g. window.innerWidth at render time) would render
 * one tree during SSR and swap after hydration, causing a visible flash and
 * a hydration mismatch warning. Reading a value the server already computed
 * keeps server and client render output identical on the very first paint,
 * the same guarantee the previous middleware-rewrite approach provided.
 */
const DeviceContext = createContext(false);

export function DeviceProvider({ isMobile, children }: { isMobile: boolean; children: React.ReactNode }) {
  return <DeviceContext.Provider value={isMobile}>{children}</DeviceContext.Provider>;
}

export function useIsMobile(): boolean {
  return useContext(DeviceContext);
}
