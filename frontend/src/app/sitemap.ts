import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.pennypilot.pro";

/** Only the public routes — matches robots.ts's allow-list. Authenticated
 * app pages are intentionally omitted (see robots.ts for why). */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/", "/login", "/signup", "/forgot-password", "/terms", "/privacy-policy"];
  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "/terms" || route === "/privacy-policy" ? "monthly" : "yearly",
    priority: route === "/" ? 1 : 0.5,
  }));
}
