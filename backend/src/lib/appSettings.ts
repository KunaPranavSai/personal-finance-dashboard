import { prisma } from "./prisma";

export async function getAppSettingsData(): Promise<Record<string, unknown>> {
  const rec = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  return (rec?.data ?? {}) as Record<string, unknown>;
}

export async function patchAppSettingsData(patch: Record<string, unknown>): Promise<void> {
  const data = await getAppSettingsData();
  const merged = { ...data, ...patch };
  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", data: merged as object },
    update: { data: merged as object },
  });
}
