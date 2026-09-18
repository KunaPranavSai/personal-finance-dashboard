import type { Metadata } from "next";
import { AppShellLayoutClient } from "./AppShellLayoutClient";

// These routes require an authenticated session and render the visitor's own
// private financial data — there is nothing here for a crawler to index, and
// indexing a login-gated page would only ever show a redirect anyway. This
// mirrors robots.ts's disallow list, enforced here at the per-page level too.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return <AppShellLayoutClient>{children}</AppShellLayoutClient>;
}
