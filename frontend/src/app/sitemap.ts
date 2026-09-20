import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

/** Only indexable public routes. Auth routes (/login, /signup,
 * /forgot-password) stay publicly accessible and allowed in robots.txt, but
 * are noindex,nofollow at the page level (see their own metadata) and are
 * intentionally excluded here since a sitemap should only list indexable
 * URLs. Authenticated app pages are omitted too (see robots.ts for why). */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/", "/terms", "/privacy-policy", "/cookie-notice", "/manual"];
  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "/" ? "yearly" : "monthly",
    priority: route === "/" ? 1 : route === "/manual" ? 0.7 : 0.5,
  }));
}
