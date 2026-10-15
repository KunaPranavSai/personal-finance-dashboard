import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
import { pushSupport, supportMessage, urlBase64ToUint8Array } from "./push";

afterEach(() => vi.unstubAllGlobals());

describe("VAPID key decoding", () => {
  it("decodes url-safe base64 (with and without padding) to the exact bytes", () => {
    const bytes = [4, 255, 254, 253, 1, 2, 3];
    const std = btoa(String.fromCharCode(...bytes));
    const urlSafe = std.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect([...urlBase64ToUint8Array(urlSafe)]).toEqual(bytes);
  });
});

describe("push capability detection (no false promises)", () => {
  const win = (over: Record<string, unknown> = {}) => {
    const w: Record<string, unknown> = { isSecureContext: true, PushManager: class {}, Notification: class {}, matchMedia: () => ({ matches: false }), navigator: {}, ...over };
    for (const k of Object.keys(w)) if (w[k] === undefined) delete w[k]; // "in window" must be false, not "present but undefined"
    return w;
  };

  it("insecure origins are rejected", () => {
    vi.stubGlobal("window", win({ isSecureContext: false }));
    vi.stubGlobal("navigator", { serviceWorker: {}, userAgent: "Chrome", maxTouchPoints: 0 });
    expect(pushSupport()).toEqual({ ok: false, reason: "insecure" });
  });

  it("no service worker support is reported", () => {
    vi.stubGlobal("window", win());
    vi.stubGlobal("navigator", { userAgent: "Chrome", maxTouchPoints: 0 });
    expect(pushSupport()).toEqual({ ok: false, reason: "no-service-worker" });
  });

  it("iPhone Safari in a browser tab is told to install first, because iOS only pushes to installed web apps", () => {
    vi.stubGlobal("window", win());
    vi.stubGlobal("navigator", { serviceWorker: {}, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", maxTouchPoints: 5 });
    expect(pushSupport()).toEqual({ ok: false, reason: "ios-needs-install" });
    expect(supportMessage["ios-needs-install"]).toMatch(/Add to Home Screen/);
  });

  it("a capable browser is accepted", () => {
    vi.stubGlobal("window", win());
    vi.stubGlobal("navigator", { serviceWorker: {}, userAgent: "Chrome", maxTouchPoints: 0 });
    expect(pushSupport()).toEqual({ ok: true });
  });

  it("missing PushManager is reported", () => {
    vi.stubGlobal("window", win({ PushManager: undefined }));
    vi.stubGlobal("navigator", { serviceWorker: {}, userAgent: "Chrome", maxTouchPoints: 0 });
    expect(pushSupport()).toEqual({ ok: false, reason: "no-push" });
  });
});
