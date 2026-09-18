import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

/** Master Plan §33 — "Do not unnecessarily expose authenticated financial
 * pages to search engines." Only the public marketing/auth/legal routes are
 * allowed; every authenticated app route (dashboard, expenses, settings,
 * admin, etc.) is explicitly disallowed since it requires a session and
 * shows the visitor's own private financial data — there is nothing there
 * for a crawler to usefully index anyway. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/signup", "/forgot-password", "/terms", "/privacy-policy"],
      disallow: [
        "/dashboard",
        "/expenses",
        "/income",
        "/budget",
        "/bills",
        "/investments",
        "/savings",
        "/goals",
        "/analytics",
        "/reports",
        "/notifications",
        "/customizations",
        "/profile",
        "/settings",
        "/connect-drive",
        "/setup-2fa",
        "/admin",
        "/admin-login",
        "/403",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
