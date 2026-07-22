// Local, per-device preference: "show the biometric option first on the
// login screen" — set from Settings → Security → Passkeys & Biometrics, or
// implicitly whenever a user completes a biometric sign-in.
export const PREFER_BIOMETRIC_KEY = "pfd-prefer-biometric";

export function getPreferBiometric(): boolean {
  try {
    return localStorage.getItem(PREFER_BIOMETRIC_KEY) === "1";
  } catch {
    return false;
  }
}

export function setPreferBiometric(prefer: boolean) {
  try {
    if (prefer) localStorage.setItem(PREFER_BIOMETRIC_KEY, "1");
    else localStorage.removeItem(PREFER_BIOMETRIC_KEY);
  } catch {
    // ignore
  }
}
