import { prisma } from "./prisma";

export async function getAppSettingsData(userId: string): Promise<Record<string, unknown>> {
  const rec = await prisma.appSettings.findUnique({ where: { userId } });
  return (rec?.data ?? {}) as Record<string, unknown>;
}

export async function patchAppSettingsData(userId: string, patch: Record<string, unknown>): Promise<void> {
  const data = await getAppSettingsData(userId);
  const merged = { ...data, ...patch };
  await prisma.appSettings.upsert({
    where: { userId },
    create: { userId, data: merged as object },
    update: { data: merged as object },
  });
}
