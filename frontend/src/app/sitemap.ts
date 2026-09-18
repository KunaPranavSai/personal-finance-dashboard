import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

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
