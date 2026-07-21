const APP_URL = process.env.APP_URL ?? "https://personal-finance-dashboard-three-topaz.vercel.app";

export const WELCOME_EMAIL_HTML = (name: string, uid: string, tempPassword: string) => `
  <h2>Welcome to Penny Pilot</h2>
  <p>Hi ${name},</p>
  <p>Your account has been approved.</p>
  <p><strong>User ID:</strong> ${uid}<br/>
  <strong>Temporary Password:</strong> ${tempPassword}<br/>
  <strong>Login URL:</strong> <a href="${APP_URL}/login">${APP_URL}/login</a></p>
  <p><strong>Instructions:</strong></p>
  <ol>
    <li>Login using the temporary password.</li>
    <li>You will be required to change your password.</li>
    <li>Enable Two-Factor Authentication.</li>
    <li>Complete your profile.</li>
    <li>Read the Penny Pilot User Guide (in-app, under Notifications).</li>
  </ol>
  <p>Thank you.</p>
`;

export const REJECTION_EMAIL_HTML = (name: string, reason?: string) => `
  <h2>Penny Pilot Registration Update</h2>
  <p>Hi ${name},</p>
  <p>We're sorry, but your registration request was not approved${reason ? `: ${reason}` : "."}</p>
  <p>If you believe this is a mistake, please contact support.</p>
`;

export const PASSWORD_RESET_BY_ADMIN_EMAIL_HTML = (name: string, uid: string, tempPassword: string) => `
  <h2>Your Penny Pilot password was reset</h2>
  <p>Hi ${name},</p>
  <p>An administrator has reset your account password.</p>
  <p><strong>User ID:</strong> ${uid}<br/>
  <strong>Temporary Password:</strong> ${tempPassword}<br/>
  <strong>Login URL:</strong> <a href="${APP_URL}/login">${APP_URL}/login</a></p>
  <p>You will be required to set a new password the next time you log in.</p>
  <p>If you didn't expect this change, contact your administrator immediately.</p>
`;

export const UID_RESET_BY_ADMIN_EMAIL_HTML = (name: string, uid: string) => `
  <h2>Your Penny Pilot User ID was changed</h2>
  <p>Hi ${name},</p>
  <p>An administrator has changed your sign-in User ID.</p>
  <p><strong>New User ID:</strong> ${uid}<br/>
  <strong>Login URL:</strong> <a href="${APP_URL}/login">${APP_URL}/login</a></p>
  <p>If you didn't expect this change, contact your administrator immediately.</p>
`;

export const ACCOUNT_UPDATED_BY_ADMIN_EMAIL_HTML = (name: string, changes: string[]) => `
  <h2>Your Penny Pilot account was updated</h2>
  <p>Hi ${name},</p>
  <p>An administrator made the following changes to your account:</p>
  <ul>${changes.map((c) => `<li>${c}</li>`).join("")}</ul>
  <p>If you didn't expect this change, contact your administrator immediately.</p>
`;

export const EMAIL_TEMPLATES = [
  { id: "welcome", name: "Welcome / Approval Email", html: WELCOME_EMAIL_HTML("Sample User", "sample.user", "TempPass123") },
  { id: "rejection", name: "Rejection Email", html: REJECTION_EMAIL_HTML("Sample User", "Incomplete information") },
  { id: "password_reset_by_admin", name: "Password Reset by Admin", html: PASSWORD_RESET_BY_ADMIN_EMAIL_HTML("Sample User", "sample.user", "TempPass123") },
  { id: "uid_reset_by_admin", name: "UID Reset by Admin", html: UID_RESET_BY_ADMIN_EMAIL_HTML("Sample User", "new.uid") },
  { id: "account_updated", name: "Account Updated by Admin", html: ACCOUNT_UPDATED_BY_ADMIN_EMAIL_HTML("Sample User", ["Email changed to sample@example.com", "Role changed to ADMIN"]) },
] as const;
