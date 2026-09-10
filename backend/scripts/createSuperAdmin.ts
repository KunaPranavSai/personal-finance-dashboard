/**
 * One-off script: creates the dedicated Super Admin account and demotes the
 * previous single-admin account to a plain USER. Safe to re-run — skips
 * creation if the target uid already exists.
 *
 * Run with: npx ts-node scripts/createSuperAdmin.ts
 */
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

const NEW_ADMIN = {
  name: "Penny Pilot Super Admin",
  email: "pranavsaikuna634@gmail.com",
  uid: "superadmin",
  password: "PennyPilotsuperadmin@2005",
};

const LEGACY_ADMIN_UID = "9704347240";

async function main() {
  const existing = await prisma.user.findUnique({ where: { uid: NEW_ADMIN.uid } });

  let superAdminId: string;
  if (existing) {
    console.log(`User with uid "${NEW_ADMIN.uid}" already exists (id=${existing.id}, role=${existing.role}). Skipping creation.`);
    superAdminId = existing.id;
  } else {
    const hash = await bcrypt.hash(NEW_ADMIN.password, 12);
    const created = await prisma.user.create({
      data: {
        name: NEW_ADMIN.name,
        email: NEW_ADMIN.email,
        uid: NEW_ADMIN.uid,
        passwordHash: hash,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        mustChangePassword: true,
        sessionVersion: 0,
      },
    });
    superAdminId = created.id;
    await prisma.activityLog.create({
      data: { userId: created.id, event: "user_created", detail: "Super Admin account created via createSuperAdmin.ts script" },
    });
    console.log(`Created Super Admin: id=${created.id}, uid=${created.uid}, email=${created.email}`);
  }

  const legacy = await prisma.user.findUnique({ where: { uid: LEGACY_ADMIN_UID } });
  if (!legacy) {
    console.log(`Legacy admin with uid "${LEGACY_ADMIN_UID}" not found — nothing to demote.`);
  } else if (legacy.role === "USER") {
    console.log(`Legacy admin (uid=${LEGACY_ADMIN_UID}) is already role USER. Nothing to do.`);
  } else {
    const otherSuperAdmins = await prisma.user.count({ where: { role: "SUPER_ADMIN", id: { not: legacy.id } } });
    if (legacy.role === "SUPER_ADMIN" && otherSuperAdmins === 0) {
      throw new Error("Refusing to demote: no other SUPER_ADMIN exists yet. Check that the new account was created successfully first.");
    }
    await prisma.user.update({ where: { id: legacy.id }, data: { role: "USER" } });
    await prisma.activityLog.create({
      data: { userId: legacy.id, event: "user_updated", detail: `Role changed to USER (demoted by createSuperAdmin.ts, previously ${legacy.role})` },
    });
    console.log(`Demoted legacy admin (uid=${LEGACY_ADMIN_UID}, id=${legacy.id}) from ${legacy.role} to USER.`);
  }

  console.log("Done. Super Admin id:", superAdminId);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
