import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function stubBrowser(opts: { ua?: string; standalone?: boolean; touch?: number } = {}) {
  const session = new Map<string, string>();
  const local = new Map<string, string>();
  const listeners = new Map<string, ((e: Event) => void)[]>();
  const store = (m: Map<string, string>) => ({ getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) });
  vi.stubGlobal("window", {
    matchMedia: () => ({ matches: Boolean(opts.standalone) }),
    navigator: { userAgent: opts.ua ?? "Mozilla/5.0 Chrome", maxTouchPoints: opts.touch ?? 0 },
    addEventListener: (n: string, cb: (e: Event) => void) => listeners.set(n, [...(listeners.get(n) ?? []), cb]),
  });
  vi.stubGlobal("navigator", { userAgent: opts.ua ?? "Mozilla/5.0 Chrome", maxTouchPoints: opts.touch ?? 0 });
  vi.stubGlobal("sessionStorage", store(session));
  vi.stubGlobal("localStorage", store(local));
  return { session, local, fire: (n: string, e: Partial<Event> = {}) => (listeners.get(n) ?? []).forEach((cb) => cb({ preventDefault() {}, ...e } as Event)) };
}

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("install prompt state", () => {
  it("a dismissal lasts for this login only (sessionStorage), so the prompt returns at the next sign-in", async () => {
    const env = stubBrowser();
    const m = await import("./pwaInstall");
    expect(m.wasDismissedRecently()).toBe(false);
    m.dismissInstallPrompt();
    expect(m.wasDismissedRecently()).toBe(true);
    env.session.clear(); // what clearClientSensitiveStorage does on logout
    expect(m.wasDismissedRecently()).toBe(false);
  });

  it("a stale 'installed' flag from an old build can no longer suppress the prompt", async () => {
    const env = stubBrowser();
    env.local.set("pfd-pwa-installed", "1");
    const m = await import("./pwaInstall");
    expect(m.isPwaInstalled()).toBe(false);
  });

  it("never prompts inside the installed app", async () => {
    stubBrowser({ standalone: true });
    const m = await import("./pwaInstall");
    expect(m.isPwaInstalled()).toBe(true);
    expect(m.installSupport()).toBe("installed");
  });

  it("offers the native prompt once the browser fires beforeinstallprompt", async () => {
    const env = stubBrowser();
    const m = await import("./pwaInstall");
    m.initPwaInstallCapture();
    expect(m.installSupport()).toBe("unsupported");
    env.fire("beforeinstallprompt");
    expect(m.installSupport()).toBe("prompt");
  });

  it("iPhone Safari gets Share instructions instead of a fake install button", async () => {
    stubBrowser({ ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari" });
    const m = await import("./pwaInstall");
    expect(m.installSupport()).toBe("ios");
  });

  it("iPadOS in desktop mode is recognised as iOS", async () => {
    stubBrowser({ ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari", touch: 5 });
    expect((await import("./pwaInstall")).isIos()).toBe(true);
  });
});
