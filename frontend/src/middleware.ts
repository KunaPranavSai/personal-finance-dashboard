import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Phase 3 mobile/desktop integration. Rewrites (never redirects — the URL
 * bar and browser history stay on the normal Penny Pilot URL) a phone
 * request for a route that has a finished /m/* mobile screen to that
 * screen's implementation, and leaves every other request — desktop
 * browsers, and any route with no mobile screen yet — completely alone.
 *
 * Why a rewrite in middleware rather than a client-side viewport check:
 * a client component branching on window.innerWidth at render time would
 * either render the desktop tree during SSR and swap after hydration
 * (a visible flash + a hydration mismatch warning) or need its own
 * cookie/UA plumbing to avoid that — middleware makes the decision once,
 * at the edge, before either tree ever renders, so there is no flicker,
 * no mismatch, and no duplicated data fetching.
 *
 * Device detection is by User-Agent (phone-class devices only — iPad and
 * other tablets intentionally fall through to the desktop UI, matching
 * how most responsive-by-device products split "mobile site" vs
 * "everything else"). Only the routes in MOBILE_ROUTE_MAP are affected;
 * every other existing route (including all of /settings, /login,
 * /signup, /connect-drive, /admin/*) is untouched and keeps rendering the
 * existing desktop implementation on every device, exactly as before this
 * change, since no mobile screen exists for them yet.
 */
const MOBILE_ROUTE_MAP: Record<string, string> = {
  "/dashboard": "/m/dashboard",
  "/transactions": "/m/transactions",
  "/expenses": "/m/transactions",
  "/income": "/m/transactions",
  "/budget": "/m/budget",
  "/investments": "/m/investments",
  "/bills": "/m/bills",
  "/goals": "/m/goals",
  "/savings": "/m/savings",
  "/accounts": "/m/manage",
  "/customizations": "/m/manage",
  "/analytics": "/m/analytics",
  "/reports": "/m/reports",
  "/notifications": "/m/notifications",
  "/profile": "/m/profile",
};

// A dedicated route-level query param carries the desktop route's implied
// filter into the mobile screen (e.g. /expenses and /income both being
// filtered views over the same Transaction collection — see the design
// spec — collapse into /m/transactions with an initial type filter rather
// than losing that filter on rewrite).
const IMPLIED_TYPE_FILTER: Record<string, string> = {
  "/expenses": "EXPENSE",
  "/income": "INCOME",
};

const MOBILE_USER_AGENT = /iPhone|iPod|Android(?=.*Mobile)|Windows Phone|BlackBerry|Opera Mini|IEMobile/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const target = MOBILE_ROUTE_MAP[pathname];
  if (!target) return NextResponse.next();

  // Explicit escape hatch: a mobile screen that intentionally links out to a
  // desktop-only feature (e.g. Reports' PDF export, which has no mobile
  // equivalent yet) appends ?desktop=1 so that one link isn't immediately
  // rewritten straight back to the mobile screen it just left.
  if (request.nextUrl.searchParams.get("desktop") === "1") return NextResponse.next();

  const userAgent = request.headers.get("user-agent") ?? "";
  if (!MOBILE_USER_AGENT.test(userAgent)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = target;
  const impliedType = IMPLIED_TYPE_FILTER[pathname];
  if (impliedType && !url.searchParams.has("type")) {
    url.searchParams.set("type", impliedType);
  }
  return NextResponse.rewrite(url);
}

// Next.js requires config.matcher to be a statically analyzable literal
// (it inspects the AST at build time, not runtime) — Object.keys(MOBILE_ROUTE_MAP)
// fails "next build" with "Unsupported node type CallExpression" even though
// it works fine under "next dev". Kept as an explicit literal, one entry per
// MOBILE_ROUTE_MAP key, rather than any computed expression.
export const config = {
  matcher: [
    "/dashboard",
    "/transactions",
    "/expenses",
    "/income",
    "/budget",
    "/investments",
    "/bills",
    "/goals",
    "/savings",
    "/accounts",
    "/customizations",
    "/analytics",
    "/reports",
    "/notifications",
    "/profile",
  ],
};
