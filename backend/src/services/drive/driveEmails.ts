import { prisma } from "../../lib/prisma";
import { sendAutomatedEmail } from "../email/automation";

const DRIVE_PROVIDER = "google_drive";

async function who(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
}

/**
 * Emails about Google Drive, each sent at most once per real change of state (free-tier friendly):
 *  - setup finished        -> only when this connection was not already set up
 *  - setup failed          -> only on the FIRST failure; later failed retries stay quiet until a success clears it
 *  - access lost (re-auth) -> once, until the user reconnects
 * Fire-and-forget: a mail problem must never affect the Drive flow itself. Technical error text is never emailed.
 */
export async function emailDriveSetupCompleted(userId: string, wasAlreadySetUp: boolean): Promise<void> {
  try {
    await prisma.backupConnection.updateMany({ where: { userId, provider: DRIVE_PROVIDER }, data: { reauthNotifiedAt: null } });
    if (wasAlreadySetUp) return;
    const user = await who(userId);
    if (user) await sendAutomatedEmail({ triggerKey: "migration_completed", userId, to: user.email, vars: { name: user.name || "there" } });
  } catch (err) {
    console.error("Drive completed email failed:", err);
  }
}

export async function emailDriveSetupFailed(userId: string, hadErrorBefore: boolean): Promise<void> {
  try {
    if (hadErrorBefore) return;
    const user = await who(userId);
    if (user) await sendAutomatedEmail({ triggerKey: "migration_failed", userId, to: user.email, vars: { name: user.name || "there" } });
  } catch (err) {
    console.error("Drive failed email failed:", err);
  }
}

export async function emailDriveReauthRequired(connectionId: string, userId: string): Promise<void> {
  try {
    // Claim the notification atomically: only the request that flips the marker from null sends the email.
    const claimed = await prisma.backupConnection.updateMany({ where: { id: connectionId, reauthNotifiedAt: null }, data: { reauthNotifiedAt: new Date() } });
    if (claimed.count === 0) return;
    const user = await who(userId);
    if (user) await sendAutomatedEmail({ triggerKey: "drive_disconnected", userId, to: user.email, vars: { name: user.name || "there" } });
  } catch (err) {
    console.error("Drive re-auth email failed:", err);
  }
}
