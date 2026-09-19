// Plain-text mirror of the legal content rendered on the frontend's
// /terms and /privacy-policy pages (frontend/src/app/terms/page.tsx and
// frontend/src/app/privacy-policy/page.tsx), used ONLY to embed the actual
// accepted document text into the generated consent PDF.
//
// This is a content mirror, not a rewrite: every paragraph below is copied
// verbatim from the frontend pages (JSX entities resolved to plain text).
// The frontend/backend are separate deployable apps with no shared module
// boundary, so this duplication is a deliberate, documented trade-off — if
// the legal text on the frontend pages changes, this file and the version
// constants in legalVersions.ts must be updated together. See
// USER_SIDE_BUG_FIX_REPORT.md, "Signup Legal Consent & Electronic
// Authorization" section, for this note.

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

const PLACEHOLDER_EMAIL = "superadminpennypilot@gmail.com";
const PLACEHOLDER_ENTITY_TERMS = "Pranav Sai Kuna";
const PLACEHOLDER_ENTITY_PRIVACY = "Pranav Sai Kuna. No physical mailing address provided.";
const GOVERNING_JURISDICTION = "India";

export const TERMS_INTRO: string[] = [
  `These Terms of Service ("Terms") govern your access to and use of Penny Pilot ("Penny Pilot", "the App", "we", "us"), a personal finance web application for managing income, expenses, budgets, savings, investments, bills/EMIs, and financial goals.`,
  `By creating an account or otherwise using Penny Pilot, you agree to be bound by these Terms.`,
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: "1. Eligibility & Accounts",
    paragraphs: [
      "You must provide accurate registration information (name, email, and optionally phone number) when creating an account.",
      "Your account is active as soon as you complete signup — there is no separate admin-approval step required before you can use the App.",
      "You are responsible for maintaining the confidentiality of your password and any two-factor authentication or passkey credentials associated with your account, and for all activity that occurs under your account.",
      "You must notify us promptly of any unauthorized use of your account that you become aware of.",
    ],
  },
  {
    heading: "2. Choice of Storage: Google Drive or This Device Only",
    paragraphs: [
      `Penny Pilot lets you choose how your financial data is stored: in your own Google Drive (recommended), or locally on this device/browser only ("This Device Only" mode). You choose a storage mode when setting up your account and can switch it later from Settings — switching does not automatically move existing data between modes.`,
      "Google Drive mode. After choosing this mode, you are required to connect a Google account via Google OAuth so the App can create and manage a dedicated data workspace inside your Drive, as described in the Privacy Policy.",
      "Core features of the App (recording transactions, budgets, investments, bills, goals, and related data) require an active Google Drive connection in this mode and will not function without one.",
      "You are responsible for maintaining your own Google account in good standing, including sufficient Google Drive storage space. If your Google Drive runs out of storage, is suspended, or access is revoked, Penny Pilot may be unable to read or save your data until the issue is resolved.",
      "If you revoke Penny Pilot's access to your Google account, or disconnect Google Drive from within the App, the App will lose the ability to read or write your financial data until you reconnect.",
      "Penny Pilot depends on the availability and correct functioning of Google's own services (Google Sign-In and Google Drive APIs). We are not responsible for outages, changes, or limitations imposed by Google that affect the App.",
      "This Device Only mode. Your financial data is stored only in this browser/device's local storage and is never sent to or stored by Penny Pilot's servers, database, or any Google account. No Google account connection is used for your financial data in this mode.",
      "You are solely responsible for backing up This Device Only data, using the App's export feature. Penny Pilot keeps no copy of this data anywhere else.",
      "If this browser's site data is cleared, the device is lost, the browser profile is reset, or you switch devices or browsers without first exporting a backup, this data may be permanently and unrecoverably lost.",
      "Penny Pilot is not liable for data loss arising from your choice of This Device Only mode, except to the extent such liability cannot be excluded by applicable law.",
    ],
  },
  {
    heading: "3. Acceptable Use",
    paragraphs: [
      "You agree not to:",
      "Use Penny Pilot for any unlawful purpose or in violation of any applicable law or regulation.",
      "Attempt to gain unauthorized access to another user's account, data, or Google Drive contents.",
      "Interfere with, disrupt, or attempt to bypass the App's security, authentication, or rate-limiting mechanisms.",
      "Use the App to store or transmit malicious code, or to misrepresent your identity.",
      "Reverse-engineer, scrape, or resell access to the App except as expressly permitted by us in writing.",
    ],
  },
  {
    heading: "4. Your Responsibility for Your Data",
    paragraphs: [
      `You are solely responsible for the accuracy of the financial information you enter into Penny Pilot. Penny Pilot is a personal record-keeping and planning tool — it does not provide financial, investment, tax, or legal advice, and any summaries, charts, budgets, or "insights" it generates are derived purely from the data you provide and should not be relied upon as professional advice.`,
      "In Google Drive mode, you are also responsible for the security of your Google account and for any actions you or others take directly within your Google Drive (such as manually editing, moving, or deleting Penny Pilot's data files), which are outside Penny Pilot's control. In This Device Only mode, you are responsible for the security of this device/browser and for maintaining your own backups.",
    ],
  },
  {
    heading: "5. Service Availability",
    paragraphs: [
      `We aim to keep Penny Pilot available and reliable, but the App is provided on an "as available" basis. We do not guarantee uninterrupted or error-free operation, and the App may be temporarily unavailable due to maintenance, updates, or factors outside our control, including outages of third-party services such as Google Drive, our hosting providers, or our email provider.`,
    ],
  },
  {
    heading: "6. Intellectual Property",
    paragraphs: [
      "The Penny Pilot application, including its design, branding, and underlying software (excluding your own data and any third-party services it relies on), is the property of its developer(s) and is protected by applicable intellectual property laws. You are granted a limited, non-exclusive, non-transferable right to use the App for your personal financial management, subject to these Terms. You retain all rights to the financial data you create and store using the App.",
    ],
  },
  {
    heading: "7. Termination",
    paragraphs: [
      "You may stop using Penny Pilot at any time, and may disconnect Google Drive, clear your local browser data, or request account deletion as described in Section 8 below.",
      "We may suspend or terminate your account if we reasonably believe you have violated these Terms, engaged in fraudulent or abusive behavior, or where required by law.",
      "Terminating your Penny Pilot account does not delete data already stored in your own Google Drive — that data remains yours and under your control, separate from your Penny Pilot account. This Device Only data is likewise unaffected by account termination unless you clear it yourself.",
    ],
  },
  {
    heading: "8. Account Deletion",
    paragraphs: [
      "You can currently request deletion of your Penny Pilot account by contacting Penny Pilot support at the email address listed in Section 13 (Contact). Self-service account deletion is not yet available within the App itself and is planned for a future update.",
      "When we receive an account deletion request, we will verify the request and process the deletion in accordance with the data-retention practices described in the Privacy Policy. We do not commit to a fixed deletion timeline. Deleting your Penny Pilot account does not delete data already stored in your own Google Drive, or data you have kept in This Device Only mode — see the Privacy Policy for details on what account deletion does and does not remove.",
    ],
  },
  {
    heading: "9. Disclaimers",
    paragraphs: [
      `THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE APP WILL BE ERROR-FREE, SECURE, OR UNINTERRUPTED, OR THAT ANY FINANCIAL CALCULATIONS, INSIGHTS, OR PROJECTIONS IT GENERATES ARE ACCURATE OR SUITABLE FOR YOUR CIRCUMSTANCES.`,
    ],
  },
  {
    heading: "10. Limitation of Liability",
    paragraphs: [
      "TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, PENNY PILOT AND ITS DEVELOPER(S) SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA, PROFITS, OR REVENUE, ARISING OUT OF OR RELATED TO YOUR USE OF (OR INABILITY TO USE) THE APP, INCLUDING LOSS OF DATA RESULTING FROM ISSUES WITH YOUR GOOGLE ACCOUNT OR GOOGLE DRIVE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.",
    ],
  },
  {
    heading: "11. Governing Law",
    paragraphs: [`These Terms are governed by the laws of ${GOVERNING_JURISDICTION}, without regard to conflict-of-law principles.`],
  },
  {
    heading: "12. Changes to These Terms",
    paragraphs: [
      `We may update these Terms from time to time as the App evolves. Material changes will be reflected by updating the "Last updated" date at the top of this page. Continued use of the App after changes take effect constitutes acceptance of the revised Terms.`,
    ],
  },
  {
    heading: "13. Contact",
    paragraphs: [`Email: ${PLACEHOLDER_EMAIL}`, `Entity: ${PLACEHOLDER_ENTITY_TERMS}`],
  },
];

export const PRIVACY_INTRO: string[] = [
  `This Privacy Policy explains how Penny Pilot ("Penny Pilot", "the App", "we", "us") collects, uses, stores, and protects information when you use the Penny Pilot personal finance web application. It is written to accurately reflect how the application is actually built and operated today.`,
  "By creating an account and using Penny Pilot, you agree to the collection and use of information as described in this policy.",
];

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: "1. Information We Collect",
    paragraphs: [
      "1.1 Account & Authentication Information",
      "When you register for Penny Pilot, we collect and store your name, email address, and optionally a phone number, together with a securely hashed password (Penny Pilot never stores your password in plain text). If you enable two-factor authentication or a passkey, we store the associated security metadata (e.g. a TOTP secret, hashed backup codes, or passkey credential data) needed to verify future sign-ins. Your account is active as soon as you complete signup; there is no admin-approval step that delays account activation.",
      "1.2 Financial Data",
      `Penny Pilot lets you record and manage income, expenses, transactions, budgets, savings, investments, bills/EMIs, and financial goals. This financial data is not stored in Penny Pilot's own central database. You choose where it is stored instead: Google Drive mode (recommended) stores it as structured data files inside a "Penny Pilot" folder created in your own Google Drive, under your own Google account — see Section 2 below for details. This Device Only mode stores it only in this browser/device's local storage (IndexedDB), never transmitted to or held by Penny Pilot's servers, database, or any Google account.`,
      "1.3 Activity & Security Logs",
      "We keep a limited activity log tied to your account (e.g. login events, password/2FA changes, Google Drive connect/disconnect events) so that you and, where applicable, an administrator can review recent account activity for security purposes.",
    ],
  },
  {
    heading: "2. Google OAuth & Google Drive Access",
    paragraphs: [
      "This section applies only if you choose Google Drive mode. If you choose This Device Only mode instead, Penny Pilot does not request Google OAuth access or use Google Drive at all for your financial data.",
      `In Google Drive mode, after you register (or later switch modes) you connect a Google account so the App can create and manage your financial workspace. Connecting uses Google's standard OAuth 2.0 sign-in flow, which asks you to explicitly grant Penny Pilot permission before any access is given.`,
      `The Google OAuth permissions ("scopes") Penny Pilot requests are:`,
      "drive.file — a restricted Google Drive scope that only allows Penny Pilot to see, create, and modify files and folders that Penny Pilot itself creates in your Drive. Penny Pilot cannot browse, read, or modify any other file already in your Google Drive.",
      "userinfo.email — lets Penny Pilot read the email address of the connected Google account, so it can show you which account is connected and detect if you later connect a different one.",
      `Using these permissions, Penny Pilot creates a root folder (named "Penny Pilot", or a similarly named folder if you choose to start a fresh workspace) in your Drive and writes your financial data into structured JSON files inside it. If you connect a Google account that already has an existing Penny Pilot workspace from a prior connection, you are explicitly asked whether to reuse that data or start a new, empty workspace — Penny Pilot never silently merges data between Google accounts.`,
    ],
  },
  {
    heading: "3. How Your Financial Data Is Stored",
    paragraphs: [
      `Your financial records (transactions, budgets, investments, bills, goals, accounts, and categories) are written to versioned JSON data files inside your own Google Drive folder, which acts as the source of truth for that data. When a data file is updated, Google Drive automatically retains prior revisions of that file, which powers Penny Pilot's built-in "restore a previous version" feature — no separate backup copy of your financial data is kept by Penny Pilot outside of your own Drive.`,
      "Because this data lives in your Google Drive, it is subject to your own Google account's storage quota, access controls, and Google's own data-handling practices for files stored in Drive, in addition to this Privacy Policy.",
      "In This Device Only mode, your financial records are instead written directly to this browser's local IndexedDB storage, with no equivalent Drive-style automatic version history — you are responsible for exporting your own backups using the App's export feature.",
    ],
  },
  {
    heading: "4. Token & Security Handling",
    paragraphs: [
      "When you connect Google Drive, Penny Pilot receives an OAuth access token and, where granted, a refresh token from Google. These tokens:",
      "Are encrypted at rest (AES-256-GCM) in Penny Pilot's database before being stored — they are never stored in plain text.",
      "Are used exclusively on the server to make authenticated Google Drive API calls on your behalf, to read and write your own Penny Pilot data files.",
      "Are never shared with, or made accessible to, other users of the application.",
      "Are automatically refreshed by Penny Pilot when they expire, using the stored refresh token, without requiring you to sign in to Google again.",
      "Your Penny Pilot account session itself is maintained using signed, HTTP-only authentication cookies. Passwords are hashed before storage and are never stored or logged in plain text. If you enable two-factor authentication, sensitive account actions (such as disconnecting Google Drive or restoring an earlier data revision) may require you to re-verify your identity.",
    ],
  },
  {
    heading: "5. Data Retention & Deletion",
    paragraphs: [
      "Financial data in Google Drive remains in your own Google Drive for as long as you keep it there. You can delete individual files, the entire \"Penny Pilot\" folder, or revoke Penny Pilot's access at any time directly from Google Drive or your Google Account permissions page — Penny Pilot does not control or retain a separate copy of that data.",
      "Financial data in This Device Only mode remains only in this browser's local storage for as long as you keep it there. Clearing this browser's site data, uninstalling the browser, or resetting the device deletes it permanently — Penny Pilot holds no copy anywhere else.",
      "Account data in Penny Pilot's database (your name, email, password hash, security settings, and activity log) is retained for as long as your account remains active.",
      "Account deletion: see the dedicated Account Deletion section (Section 6) below for how to request deletion of your account.",
    ],
  },
  {
    heading: "6. Account Deletion",
    paragraphs: [
      `You can currently request deletion of your Penny Pilot account and its associated account data (name, email, password hash, security settings, and activity log) by contacting Penny Pilot support at the email address listed in Section 11 (Contact). Self-service account deletion is not yet available within the App itself and is planned for a future update.`,
      "When we receive a deletion request, we will verify the request and process the deletion in accordance with applicable data-retention requirements and the data-retention practices described in Section 5 above. We do not commit to a fixed deletion timeline.",
      "Account deletion removes your Penny Pilot account and account data from our database. It does not delete financial data already stored in your own Google Drive, or data kept in This Device Only mode on your browser/device — you control that data separately, as described in Sections 3 and 5.",
    ],
  },
  {
    heading: "7. Disconnecting Google Drive",
    paragraphs: [
      "You can disconnect Google Drive from Penny Pilot at any time from within the App's Settings. Disconnecting:",
      "Immediately deletes the stored OAuth tokens for that connection from Penny Pilot's database.",
      "Does not delete, modify, or move any files already saved in your Google Drive — your financial data remains exactly as it was, under your control.",
      "Means the App can no longer read or write your financial data until you reconnect, since Google Drive is required for that functionality.",
      "You can also revoke Penny Pilot's access entirely from your Google Account's third-party app permissions page, which has the same effect from Google's side. If you are in This Device Only mode, none of this section applies — there is no Google Drive connection to disconnect.",
    ],
  },
  {
    heading: "8. Third-Party Services",
    paragraphs: [
      "Penny Pilot relies on the following third-party services to operate:",
      "Google (OAuth & Google Drive) — used to authenticate your Drive connection and to store your financial data, as described above. See Google's own Privacy Policy for how Google handles data within your Google account.",
      "Resend — an email-delivery provider used to send account-related transactional emails (e.g. security notifications), where email sending is configured.",
      "Hosting providers — the Penny Pilot backend and frontend are hosted on third-party cloud infrastructure providers, who process data only as needed to run the application (e.g. serving requests, storing the account database).",
      "Penny Pilot does not sell your personal or financial data, and does not use third-party advertising or analytics trackers.",
    ],
  },
  {
    heading: "9. Cookies",
    paragraphs: [
      "Penny Pilot uses strictly necessary, first-party cookies to keep you signed in (signed, HTTP-only session cookies) and to remember basic preferences such as your light/dark theme. These cookies are not used for advertising or cross-site tracking.",
    ],
  },
  {
    heading: "10. Your Rights",
    paragraphs: [
      "Access & export: you can view your financial data at any time within the App, and export it using the App's built-in reporting/export features. Your primary financial data also remains directly accessible to you in your own Google Drive.",
      "Correction: you can edit or delete individual financial records directly within the App.",
      "Disconnection: you can disconnect Google Drive at any time, as described in Section 7.",
      "Account data requests: to request access to, correction of, or deletion of the account data Penny Pilot stores about you, contact us using the details in Section 11.",
    ],
  },
  {
    heading: "11. Contact",
    paragraphs: [
      "If you have questions about this Privacy Policy or how your data is handled, please contact:",
      `Email: ${PLACEHOLDER_EMAIL}`,
      `Entity: ${PLACEHOLDER_ENTITY_PRIVACY}`,
    ],
  },
  {
    heading: "12. Changes to This Policy",
    paragraphs: [
      `We may update this Privacy Policy from time to time as the App evolves. Material changes will be reflected by updating the "Last updated" date at the top of this page.`,
    ],
  },
];
