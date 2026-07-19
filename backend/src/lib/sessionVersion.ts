import { getAppSettingsData, patchAppSettingsData } from "./appSettings";

let currentVersion = 0;

/** Load the last-persisted session version at server startup. */
export async function initSessionVersion(): Promise<void> {
  const data = await getAppSettingsData();
  currentVersion = typeof data.__sessionVersion === "number" ? data.__sessionVersion : 0;
}

export function getSessionVersion(): number {
  return currentVersion;
}

/** Invalidate every previously issued token by bumping the version. Returns the new version to stamp into fresh tokens. */
export function bumpSessionVersion(): number {
  currentVersion += 1;
  patchAppSettingsData({ __sessionVersion: currentVersion }).catch(() => {});
  return currentVersion;
}
