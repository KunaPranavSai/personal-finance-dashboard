// Progressive sign-up: explorers can look around; the first attempt to change data opens the verify-email
// + complete-profile sheet (StepUpHost). Anything that is refused for that reason calls requestStepUp().
export const STEP_UP_EVENT = "pp:step-up";
const EXPLORER_KEY = "pp_explorer";

export function requestStepUp(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(STEP_UP_EVENT));
}

export function setExplorer(on: boolean): void {
  try { if (on) localStorage.setItem(EXPLORER_KEY, "1"); else localStorage.removeItem(EXPLORER_KEY); } catch { /* ignore */ }
}

export function isExplorer(): boolean {
  try { return localStorage.getItem(EXPLORER_KEY) === "1"; } catch { return false; }
}
