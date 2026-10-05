import { appUrl, renderEmail, whenLabel } from "./emailLayout";

/**
 * The default content of every automated email, all built on the one Penny Pilot layout (emailLayout.ts).
 * Functions take plain values; the layout escapes them. Nothing here ever receives a password, PIN or token, so
 * none of them can appear in an email.
 *
 * `tagged` is the same email written with {{tags}} instead of sample values: it is what the admin editor starts
 * from, and what an admin's pasted HTML replaces (see emailTemplateRenderer.ts for the tag list).
 */
// Built per email (not at import) so a changed App URL in System Settings applies immediately.
const open = () => ({ label: "Open Penny Pilot", url: `${appUrl()}/login` });
const signIn = () => ({ label: "Sign in to Penny Pilot", url: `${appUrl()}/login` });
const notYou = "If this was not you, secure your account now: open Penny Pilot, change your password and review your sessions in Security & Privacy.";

// ── Account ────────────────────────────────────────────────────────────────
export const WELCOME_EMAIL_HTML = (name: string, uid: string) =>
  renderEmail({
    preheader: "Your Penny Pilot account is ready.",
    title: `Welcome to Penny Pilot, ${name}`,
    intro: ["Your account is ready. Penny Pilot keeps your income, expenses, budgets, bills, goals and investments in one clear place."],
    bullets: ["Add your first income or expense with the + button", "Set a monthly budget to see where your money goes", "Connect Google Drive so your data stays in your own account"],
    cta: open(),
    rows: [["Your User ID", uid]],
    notice: { tone: "info", title: "Keep it private", text: "Your PIN and password are never shown in email. Do not share them or your sign-in codes with anyone." },
  });

export const EMAIL_VERIFICATION_EMAIL_HTML = (name: string, code: string) =>
  renderEmail({
    preheader: `Your Penny Pilot verification code is ${code}`,
    title: "Verify your email",
    intro: [`Hi ${name}, enter this code in Penny Pilot to verify your email and start saving your data.`],
    code,
    codeNote: "Expires in 10 minutes. Works once.",
    notice: { tone: "warn", title: "Never share this code", text: "Penny Pilot will never ask you for it. If you did not request it, you can ignore this email." },
  });

export const SIGNIN_CODE_EMAIL_HTML = (name: string, code: string) =>
  renderEmail({
    preheader: `Your Penny Pilot sign-in code is ${code}`,
    title: "Your sign-in code",
    intro: [`Hi ${name}, use this code to sign in to Penny Pilot.`],
    code,
    codeNote: "Expires in 10 minutes. Works once.",
    notice: { tone: "warn", title: "Never share this code", text: "If you did not try to sign in, ignore this email. No one can sign in without it." },
  });

export const RECOVERY_OTP_EMAIL_HTML = (name: string, code: string) =>
  renderEmail({
    preheader: `Your Penny Pilot recovery code is ${code}`,
    title: "Reset your password",
    intro: [`Hi ${name}, use this code to continue resetting your Penny Pilot password.`],
    code,
    codeNote: "Expires in 5 minutes. Works once.",
    notice: { tone: "warn", title: "Did not ask for this?", text: "Ignore this email. Your password has not been changed and nobody can reset it without this code." },
  });

export const PASSWORD_CHANGED_NOTIFICATION_EMAIL_HTML = (name: string, when: string = whenLabel()) =>
  renderEmail({
    preheader: "Your Penny Pilot password was changed.",
    title: "Your password was changed",
    intro: [`Hi ${name}, the password on your Penny Pilot account was just changed. You were signed out of your other devices as a precaution.`],
    rows: [["When", when]],
    notice: { tone: "warn", title: "Was this you?", text: `If you made this change, no action is needed. ${notYou}` },
    cta: signIn(),
  });

export const PASSWORD_RESET_BY_ADMIN_EMAIL_HTML = (name: string) =>
  renderEmail({
    preheader: "An administrator reset your Penny Pilot password.",
    title: "Your password was reset",
    intro: [
      `Hi ${name}, a Penny Pilot administrator reset the password on your account.`,
      "Your old password no longer works. Choose a new one with Forgot password on the sign-in page, or follow the instructions your administrator gave you.",
    ],
    cta: signIn(),
    notice: { tone: "info", title: "Your password is not in this email", text: "Penny Pilot never sends passwords by email. If you did not expect this, contact your administrator." },
  });

export const UID_CHANGED_EMAIL_HTML = (name: string, uid: string, actor: string) =>
  renderEmail({
    preheader: "Your Penny Pilot User ID was changed.",
    title: "Your User ID was changed",
    intro: [`Hi ${name}, your sign-in User ID was changed by ${actor}.`],
    rows: [["New User ID", uid]],
    cta: signIn(),
    notice: { tone: "info", text: "Use the new User ID the next time you sign in. If you did not expect this, contact support." },
  });

export const ACCOUNT_UPDATED_BY_ADMIN_EMAIL_HTML = (name: string, changes: string[]) =>
  renderEmail({
    preheader: "An administrator updated your Penny Pilot account.",
    title: "Your account was updated",
    intro: [`Hi ${name}, a Penny Pilot administrator made these changes to your account:`],
    bullets: changes,
    notice: { tone: "info", text: "If you did not expect this change, contact your administrator." },
  });

export const PIN_CHANGED_EMAIL_HTML = (name: string, when: string = whenLabel()) =>
  renderEmail({
    preheader: "Your Penny Pilot PIN was changed.",
    title: "Your PIN was changed",
    intro: [`Hi ${name}, the PIN you use to sign in to Penny Pilot was just changed. The PIN itself is never shown in email.`],
    rows: [["When", when]],
    notice: { tone: "warn", title: "Was this you?", text: `If you changed it, no action is needed. ${notYou}` },
  });

export const SECURITY_ALERT_EMAIL_HTML = (name: string, event: string, detail: string, when: string = whenLabel()) =>
  renderEmail({
    preheader: `${event} on your Penny Pilot account.`,
    title: event,
    intro: [`Hi ${name}, ${detail}`],
    rows: [["When", when]],
    notice: { tone: "info", title: "Was this you?", text: "If you made this change, no action is needed. If not, change your password and review your sessions in Security & Privacy." },
  });

export const ADMIN_ACCESS_CODE_EMAIL_HTML = (name: string, code: string) =>
  renderEmail({
    preheader: `Admin access code: ${code}`,
    title: "Approve admin access",
    intro: [`Hi ${name}, a Penny Pilot administrator asked for temporary access to your account for support.`, "Only share this code with them if you asked for help."],
    code,
    codeNote: "Expires shortly. Works once.",
    notice: { tone: "warn", title: "Did not ask for support?", text: "Do not share the code. Ignore this email and contact support." },
  });

// ── Data and Google Drive ──────────────────────────────────────────────────
export const MIGRATION_ACTION_REQUIRED_EMAIL_HTML = (name: string) =>
  renderEmail({
    preheader: "Connect Google Drive to keep using Penny Pilot.",
    title: "Connect Google Drive to continue",
    intro: [
      `Hi ${name}, Penny Pilot now keeps your financial data in your own Google Drive.`,
      "Sign in and connect Google Drive to continue. Your existing data is safe and has not been deleted.",
    ],
    cta: { label: "Connect Google Drive", url: `${appUrl()}/connect-drive` },
  });

export const MIGRATION_COMPLETED_EMAIL_HTML = (name: string) =>
  renderEmail({
    preheader: "Your data is now in your Google Drive.",
    title: "Your data is set up in Google Drive",
    intro: [`Hi ${name}, Google Drive is connected and your Penny Pilot data is ready. Nothing else is needed from you.`],
    cta: open(),
    notice: { tone: "info", text: "You can review your connection any time in Backup & Data." },
  });

export const MIGRATION_FAILED_EMAIL_HTML = (name: string) =>
  renderEmail({
    preheader: "We could not finish setting up Google Drive.",
    title: "We could not finish connecting Google Drive",
    intro: [`Hi ${name}, something interrupted the setup, so your Drive is not ready yet. Your existing data is safe and unchanged.`, "Please try again. It usually works the second time."],
    cta: { label: "Try again", url: `${appUrl()}/connect-drive` },
    notice: { tone: "info", text: "If it keeps failing, reply to our support team and we will help." },
  });

export const DRIVE_DISCONNECTED_EMAIL_HTML = (name: string) =>
  renderEmail({
    preheader: "Reconnect Google Drive to keep Penny Pilot working.",
    title: "Reconnect Google Drive",
    intro: [`Hi ${name}, Penny Pilot lost access to your Google Drive, for example because access was removed in your Google account.`, "Reconnect to keep saving and viewing your data. Nothing was deleted."],
    cta: { label: "Reconnect Google Drive", url: `${appUrl()}/connect-drive` },
  });

// ── Admin-facing ───────────────────────────────────────────────────────────
export const NEW_SIGNUP_ADMIN_EMAIL_HTML = (adminName: string, newName: string, newEmail: string, when: string = whenLabel()) =>
  renderEmail({
    preheader: `${newName} just joined Penny Pilot.`,
    title: "New sign-up",
    intro: [`Hi ${adminName}, a new user completed sign-up.`],
    rows: [["Name", newName], ["Email", newEmail], ["When", when]],
    cta: { label: "Open Users", url: `${appUrl()}/admin/users` },
  });

export const SUPER_ADMIN_ALERT_EMAIL_HTML = (title: string, detail: string, account: string, when: string = whenLabel()) =>
  renderEmail({
    preheader: title,
    title: `Admin security event: ${title}`,
    intro: [detail],
    rows: [["Account", account], ["When", when]],
    cta: { label: "Open audit log", url: `${appUrl()}/admin/activity` },
  });

export interface EmailTemplateDef {
  id: string;
  name: string;
  /** Default subject line. */
  subject: string;
  /** Rendered with sample values (preview and test send). */
  html: string;
  /** Same email with {{tags}} in place of values: the editor's starting point. */
  tagged: string;
}

export const EMAIL_TEMPLATES: EmailTemplateDef[] = [
  { id: "welcome", name: "Welcome / Account Ready", subject: "Welcome to Penny Pilot", get html() { return WELCOME_EMAIL_HTML("Pranav", "pranav.sai"); }, get tagged() { return WELCOME_EMAIL_HTML("{{name}}", "{{uid}}"); } },
  { id: "email_verification", name: "Email Verification Code", subject: "Verify your Penny Pilot email", get html() { return EMAIL_VERIFICATION_EMAIL_HTML("Pranav", "482913"); }, get tagged() { return EMAIL_VERIFICATION_EMAIL_HTML("{{name}}", "{{code}}"); } },
  { id: "signin_code", name: "Sign-in Code", subject: "Your Penny Pilot sign-in code", get html() { return SIGNIN_CODE_EMAIL_HTML("Pranav", "482913"); }, get tagged() { return SIGNIN_CODE_EMAIL_HTML("{{name}}", "{{code}}"); } },
  { id: "recovery_otp", name: "Password Reset / Recovery Code", subject: "Your Penny Pilot password reset code", get html() { return RECOVERY_OTP_EMAIL_HTML("Pranav", "482913"); }, get tagged() { return RECOVERY_OTP_EMAIL_HTML("{{name}}", "{{code}}"); } },
  { id: "password_changed", name: "Password Changed", subject: "Your Penny Pilot password was changed", get html() { return PASSWORD_CHANGED_NOTIFICATION_EMAIL_HTML("Pranav", "6 Oct 2026, 4:12 pm IST"); }, get tagged() { return PASSWORD_CHANGED_NOTIFICATION_EMAIL_HTML("{{name}}", "{{when}}"); } },
  { id: "password_reset_by_admin", name: "Admin Password Reset", subject: "Your Penny Pilot password was reset", get html() { return PASSWORD_RESET_BY_ADMIN_EMAIL_HTML("Pranav"); }, get tagged() { return PASSWORD_RESET_BY_ADMIN_EMAIL_HTML("{{name}}"); } },
  { id: "uid_changed", name: "User ID Changed", subject: "Your Penny Pilot User ID was changed", get html() { return UID_CHANGED_EMAIL_HTML("Pranav", "new.uid", "an administrator"); }, get tagged() { return UID_CHANGED_EMAIL_HTML("{{name}}", "{{uid}}", "{{actor}}"); } },
  { id: "account_updated", name: "Account Updated by Admin", subject: "Your Penny Pilot account was updated", get html() { return ACCOUNT_UPDATED_BY_ADMIN_EMAIL_HTML("Pranav", ["Role changed to ADMIN"]); }, get tagged() { return ACCOUNT_UPDATED_BY_ADMIN_EMAIL_HTML("{{name}}", ["{{changes}}"]); } },
  { id: "pin_changed", name: "PIN Changed", subject: "Your Penny Pilot PIN was changed", get html() { return PIN_CHANGED_EMAIL_HTML("Pranav", "6 Oct 2026, 4:12 pm IST"); }, get tagged() { return PIN_CHANGED_EMAIL_HTML("{{name}}", "{{when}}"); } },
  { id: "security_alert", name: "Security Alert", subject: "Security alert on your Penny Pilot account", get html() { return SECURITY_ALERT_EMAIL_HTML("Pranav", "Two-factor authentication turned on", "two-factor authentication was turned on for your account.", "6 Oct 2026, 4:12 pm IST"); }, get tagged() { return SECURITY_ALERT_EMAIL_HTML("{{name}}", "{{event}}", "{{detail}}", "{{when}}"); } },
  { id: "admin_access_code", name: "Admin Access Verification Code", subject: "Penny Pilot admin access verification code", get html() { return ADMIN_ACCESS_CODE_EMAIL_HTML("Pranav", "482913"); }, get tagged() { return ADMIN_ACCESS_CODE_EMAIL_HTML("{{name}}", "{{code}}"); } },
  { id: "migration_action_required", name: "Migration / Drive Setup Required", subject: "Action needed: connect Google Drive to Penny Pilot", get html() { return MIGRATION_ACTION_REQUIRED_EMAIL_HTML("Pranav"); }, get tagged() { return MIGRATION_ACTION_REQUIRED_EMAIL_HTML("{{name}}"); } },
  { id: "migration_completed", name: "Migration Completed", subject: "Your Penny Pilot data is set up in Google Drive", get html() { return MIGRATION_COMPLETED_EMAIL_HTML("Pranav"); }, get tagged() { return MIGRATION_COMPLETED_EMAIL_HTML("{{name}}"); } },
  { id: "migration_failed", name: "Migration Failed", subject: "We could not finish connecting Google Drive", get html() { return MIGRATION_FAILED_EMAIL_HTML("Pranav"); }, get tagged() { return MIGRATION_FAILED_EMAIL_HTML("{{name}}"); } },
  { id: "drive_disconnected", name: "Drive Disconnected / Re-authorization", subject: "Reconnect Google Drive to Penny Pilot", get html() { return DRIVE_DISCONNECTED_EMAIL_HTML("Pranav"); }, get tagged() { return DRIVE_DISCONNECTED_EMAIL_HTML("{{name}}"); } },
  { id: "new_signup_admin", name: "New Sign-up (to admins)", subject: "New Penny Pilot sign-up", get html() { return NEW_SIGNUP_ADMIN_EMAIL_HTML("Admin", "Pranav Sai", "pranav@example.com", "6 Oct 2026, 4:12 pm IST"); }, get tagged() { return NEW_SIGNUP_ADMIN_EMAIL_HTML("{{adminName}}", "{{newName}}", "{{newEmail}}", "{{when}}"); } },
  { id: "super_admin_alert", name: "Super-admin Security Alert", subject: "Penny Pilot admin security event", get html() { return SUPER_ADMIN_ALERT_EMAIL_HTML("Two-factor authentication turned off", "An administrator turned off two-factor authentication.", "admin.user (ADMIN)", "6 Oct 2026, 4:12 pm IST"); }, get tagged() { return SUPER_ADMIN_ALERT_EMAIL_HTML("{{event}}", "{{detail}}", "{{account}}", "{{when}}"); } },
];
