import type { Metadata } from "next";
import { AdminShellLayoutClient } from "./AdminShellLayoutClient";

// Admin routes require an authenticated ADMIN/SUPER_ADMIN session and expose
// operational tooling — never appropriate for search engines to index.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminShellLayout({ children }: { children: React.ReactNode }) {
  return <AdminShellLayoutClient>{children}</AdminShellLayoutClient>;
}
