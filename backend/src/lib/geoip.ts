import geoip from "geoip-lite";

/**
 * Offline, self-contained IP→approximate-location lookup (MaxMind GeoLite2 data bundled with
 * geoip-lite) — no API key, no external network call. Returns exactly the fields the library
 * provides; does NOT include ISP/ASN (geoip-lite has no such data — a real ISP lookup needs a
 * different, paid-API provider, out of scope). Returns null for localhost/private/unresolvable
 * IPs — never guess or fall back to the server's own location.
 */
export interface GeoLocation {
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string;
  ll: [number, number];
  timezone: string;
}

export function lookupGeo(ip: string | null | undefined): GeoLocation | null {
  if (!ip) return null;
  const result = geoip.lookup(ip);
  if (!result) return null;
  return {
    city: result.city || null,
    region: result.region || null,
    country: result.country || null,
    countryCode: result.country,
    ll: result.ll,
    timezone: result.timezone,
  };
}
