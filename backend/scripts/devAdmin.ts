/**
 * Local development test admin.
 *
 *   npm run dev-admin:create   -> creates (or resets) the test Super Admin and writes its login to .dev-admin.local.json
 *   npm run dev-admin:remove   -> deletes the account and that file
 *
 * Safety:
 *  - refuses to run when NODE_ENV=production
 *  - the email uses the reserved ".invalid" domain, so it can never receive mail or belong to a real person
 *  - the password is random, generated fresh on every `create`, and only ever written to the git-ignored file above
 *  - nothing here touches real accounts; `remove` deletes only this one uid
 *
 * NOTE: this project's only configured database is the shared Supabase one, so the account exists there while you
 * work. Remove it when you are done.
 */
import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

const UID = "dev.admin.local";
const EMAIL = "dev-admin@pennypilot.invalid";
const FILE = path.resolve(__dirname, "..", ".dev-admin.local.json");

async function create() {
  const password = `Dev-${crypto.randomBytes(12).toString("base64url")}9a`;
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();
  await prisma.user.upsert({
    where: { uid: UID },
    update: { passwordHash, status: "ACTIVE", role: "SUPER_ADMIN", mustChangePassword: false, lockedUntil: null, failedLoginAttempts: 0, twoFactorEnabled: false, twoFactorSecret: null, pinHash: null },
    create: {
      uid: UID, email: EMAIL, name: "DEV TEST ADMIN (delete me)", role: "SUPER_ADMIN", status: "ACTIVE", passwordHash,
      mustChangePassword: false, emailVerifiedAt: now, profileCompletedAt: now,
    },
  });
  fs.writeFileSync(FILE, JSON.stringify({ email: EMAIL, uid: UID, password, createdAt: now.toISOString(), note: "Local test admin. Run `npm run dev-admin:remove` when done." }, null, 2));
  console.log(`Dev admin ready.\n  email: ${EMAIL}\n  login details saved to ${path.relative(process.cwd(), FILE)} (git-ignored)\n  remove it with: npm run dev-admin:remove`);
}

async function remove() {
  const u = await prisma.user.findUnique({ where: { uid: UID } });
  if (u) {
    await prisma.recoverySession.deleteMany({ where: { userId: u.id } });
    await prisma.impersonationRequest.deleteMany({ where: { OR: [{ adminId: u.id }, { targetUserId: u.id }] } });
    await prisma.consentRecord.deleteMany({ where: { userId: u.id } });
    await prisma.session.deleteMany({ where: { userId: u.id } });
    await prisma.notification.deleteMany({ where: { userId: u.id } });
    await prisma.activityLog.deleteMany({ where: { OR: [{ userId: u.id }, { targetUserId: u.id }] } });
    await prisma.user.delete({ where: { id: u.id } });
  }
  if (fs.existsSync(FILE)) fs.unlinkSync(FILE);
  console.log(u ? "Dev admin removed." : "No dev admin found (nothing to remove).");
}

(async () => {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to run: NODE_ENV=production.");
    process.exit(1);
  }
  const cmd = process.argv[2];
  if (cmd === "create") await create();
  else if (cmd === "remove") await remove();
  else {
    console.error("Usage: devAdmin.ts create | remove");
    process.exit(1);
  }
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
