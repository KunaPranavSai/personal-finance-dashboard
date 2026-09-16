// Single source of truth for phone-class User-Agent detection, shared by
// middleware.ts (edge runtime) and the server-rendered root layout (which
// resolves it once, server-side, before either tree renders — see
// DeviceContext.tsx for why that matters).
export const MOBILE_USER_AGENT = /iPhone|iPod|Android(?=.*Mobile)|Windows Phone|BlackBerry|Opera Mini|IEMobile/;

export function isMobileUserAgent(ua: string): boolean {
  return MOBILE_USER_AGENT.test(ua);
}
