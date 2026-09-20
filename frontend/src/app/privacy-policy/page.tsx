import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { PRIVACY_VERSION } from "@/lib/legalVersions";

export const metadata: Metadata = {
  title: "Privacy Policy · Penny Pilot",
  description: "How Penny Pilot collects, stores, and protects your account and financial data, including its use of Google Drive and Google OAuth.",
  alternates: { canonical: "/privacy-policy" },
};

const LAST_UPDATED = "September 19, 2026";
const PLACEHOLDER_EMAIL = "superadminpennypilot@gmail.com";
const PLACEHOLDER_ENTITY = "Pranav Sai Kuna. No physical mailing address provided.";

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell title="Privacy Policy" lastUpdated={LAST_UPDATED} version={PRIVACY_VERSION} active="privacy">
      <p>
        This Privacy Policy explains how Penny Pilot (&quot;Penny Pilot&quot;, &quot;the App&quot;, &quot;we&quot;, &quot;us&quot;) collects, uses,
        stores, and protects information when you use the Penny Pilot personal finance web application. It is written to
        accurately reflect how the application is actually built and operated today.
      </p>
      <p>
        By creating an account and using Penny Pilot, you agree to the collection and use of information as described in
        this policy.
      </p>

      <h2>1. Information We Collect</h2>
      <h3>1.1 Account &amp; Authentication Information</h3>
      <p>
        When you register for Penny Pilot, we collect and store your name, email address, and optionally a phone number,
        together with a securely hashed password (Penny Pilot never stores your password in plain text). If you enable
        two-factor authentication or a passkey, we store the associated security metadata (e.g. a TOTP secret, hashed
        backup codes, or passkey credential data) needed to verify future sign-ins. Your account is active as soon as
        you complete signup; there is no admin-approval step that delays account activation.
      </p>
      <h3>1.2 Financial Data</h3>
      <p>
        Penny Pilot lets you record and manage income, expenses, transactions, budgets, savings, investments, bills/EMIs,
        and financial goals. This financial data is <strong>not stored in Penny Pilot&apos;s own central database</strong>.
        You choose where it is stored instead:
      </p>
      <ul>
        <li><strong>Google Drive mode</strong> (recommended): stored as structured data files inside a &quot;Penny Pilot&quot; folder created in your own Google Drive, under your own Google account — see Section 2 below for details.</li>
        <li><strong>This Device Only mode</strong>: stored only in this browser/device&apos;s local storage (IndexedDB). This data is never transmitted to, or held by, Penny Pilot&apos;s servers, database, or any Google account.</li>
      </ul>
      <h3>1.3 Activity &amp; Security Logs</h3>
      <p>
        We keep a limited activity log tied to your account (e.g. login events, password/2FA changes, Google Drive
        connect/disconnect events) so that you and, where applicable, an administrator can review recent account
        activity for security purposes.
      </p>

      <h2>2. Google OAuth &amp; Google Drive Access</h2>
      <p>
        This section applies only if you choose Google Drive mode. If you choose This Device Only mode instead,
        Penny Pilot does not request Google OAuth access or use Google Drive at all for your financial data.
      </p>
      <p>
        In Google Drive mode, after you register (or later switch modes) you connect a Google account so the App can
        create and manage your financial workspace. Connecting uses Google&apos;s standard OAuth 2.0 sign-in flow, which
        asks you to explicitly grant Penny Pilot permission before any access is given.
      </p>
      <p>The Google OAuth permissions (&quot;scopes&quot;) Penny Pilot requests are:</p>
      <ul>
        <li>
          <strong>drive.file</strong> — a restricted Google Drive scope that only allows Penny Pilot to see, create, and
          modify files and folders that Penny Pilot itself creates in your Drive. Penny Pilot cannot browse, read, or
          modify any other file already in your Google Drive.
        </li>
        <li>
          <strong>userinfo.email</strong> — lets Penny Pilot read the email address of the connected Google account, so
          it can show you which account is connected and detect if you later connect a different one.
        </li>
      </ul>
      <p>
        Using these permissions, Penny Pilot creates a root folder (named &quot;Penny Pilot&quot;, or a similarly named
        folder if you choose to start a fresh workspace) in your Drive and writes your financial data into structured
        JSON files inside it. If you connect a Google account that already has an existing Penny Pilot workspace from a
        prior connection, you are explicitly asked whether to reuse that data or start a new, empty workspace — Penny
        Pilot never silently merges data between Google accounts.
      </p>

      <h2>3. How Your Financial Data Is Stored</h2>
      <p>
        Your financial records (transactions, budgets, investments, bills, goals, accounts, and categories) are written
        to versioned JSON data files inside your own Google Drive folder, which acts as the source of truth for that
        data. When a data file is updated, Google Drive automatically retains prior revisions of that file, which powers
        Penny Pilot&apos;s built-in &quot;restore a previous version&quot; feature — no separate backup copy of your financial
        data is kept by Penny Pilot outside of your own Drive.
      </p>
      <p>
        Because this data lives in your Google Drive, it is subject to your own Google account&apos;s storage quota,
        access controls, and Google&apos;s own data-handling practices for files stored in Drive, in addition to this
        Privacy Policy.
      </p>
      <p>
        In This Device Only mode, your financial records are instead written directly to this browser&apos;s local
        IndexedDB storage, with no equivalent Drive-style automatic version history — you are responsible for
        exporting your own backups using the App&apos;s export feature.
      </p>

      <h2>4. Token &amp; Security Handling</h2>
      <p>
        When you connect Google Drive, Penny Pilot receives an OAuth access token and, where granted, a refresh token
        from Google. These tokens:
      </p>
      <ul>
        <li>Are encrypted at rest (AES-256-GCM) in Penny Pilot&apos;s database before being stored — they are never stored in plain text.</li>
        <li>Are used exclusively on the server to make authenticated Google Drive API calls on your behalf, to read and write your own Penny Pilot data files.</li>
        <li>Are never shared with, or made accessible to, other users of the application.</li>
        <li>Are automatically refreshed by Penny Pilot when they expire, using the stored refresh token, without requiring you to sign in to Google again.</li>
      </ul>
      <p>
        Your Penny Pilot account session itself is maintained using signed, HTTP-only authentication cookies. Passwords
        are hashed before storage and are never stored or logged in plain text. If you enable two-factor authentication,
        sensitive account actions (such as disconnecting Google Drive or restoring an earlier data revision) may require
        you to re-verify your identity.
      </p>

      <h2>5. Data Retention &amp; Deletion</h2>
      <ul>
        <li>
          <strong>Financial data in Google Drive</strong> remains in your own Google Drive for as long as you keep it
          there. You can delete individual files, the entire &quot;Penny Pilot&quot; folder, or revoke Penny Pilot&apos;s
          access at any time directly from Google Drive or your Google Account permissions page — Penny Pilot does not
          control or retain a separate copy of that data.
        </li>
        <li>
          <strong>Financial data in This Device Only mode</strong> remains only in this browser&apos;s local storage
          for as long as you keep it there. Clearing this browser&apos;s site data, uninstalling the browser, or
          resetting the device deletes it permanently — Penny Pilot holds no copy anywhere else.
        </li>
        <li>
          <strong>Account data in Penny Pilot&apos;s database</strong> (your name, email, password hash, security
          settings, and activity log) is retained for as long as your account remains active.
        </li>
        <li>
          <strong>Account deletion</strong>: see the dedicated Account Deletion section (Section 6) below for how to
          request deletion of your account.
        </li>
      </ul>

      <h2>6. Account Deletion</h2>
      <p>
        You can currently request deletion of your Penny Pilot account and its associated account data (name, email,
        password hash, security settings, and activity log) by contacting Penny Pilot support at the email address
        listed in Section 11 (Contact). Self-service account deletion is not yet available within the App itself and
        is planned for a future update.
      </p>
      <p>
        When we receive a deletion request, we will verify the request and process the deletion in accordance with
        applicable data-retention requirements and the data-retention practices described in Section 5 above. We do
        not commit to a fixed deletion timeline.
      </p>
      <p>
        Account deletion removes your Penny Pilot account and account data from our database. It does not delete
        financial data already stored in your own Google Drive, or data kept in This Device Only mode on your
        browser/device — you control that data separately, as described in Sections 3 and 5.
      </p>

      <h2>7. Disconnecting Google Drive</h2>
      <p>
        You can disconnect Google Drive from Penny Pilot at any time from within the App&apos;s Settings. Disconnecting:
      </p>
      <ul>
        <li>Immediately deletes the stored OAuth tokens for that connection from Penny Pilot&apos;s database.</li>
        <li>Does <strong>not</strong> delete, modify, or move any files already saved in your Google Drive — your financial data remains exactly as it was, under your control.</li>
        <li>Means the App can no longer read or write your financial data until you reconnect, since Google Drive is required for that functionality.</li>
      </ul>
      <p>
        You can also revoke Penny Pilot&apos;s access entirely from your Google Account&apos;s third-party app permissions
        page, which has the same effect from Google&apos;s side. If you are in This Device Only mode, none of this
        section applies — there is no Google Drive connection to disconnect.
      </p>

      <h2>8. Third-Party Services</h2>
      <p>Penny Pilot relies on the following third-party services to operate:</p>
      <ul>
        <li><strong>Google (OAuth &amp; Google Drive)</strong> — used to authenticate your Drive connection and to store your financial data, as described above. See Google&apos;s own Privacy Policy for how Google handles data within your Google account.</li>
        <li><strong>Resend</strong> — an email-delivery provider used to send account-related transactional emails (e.g. security notifications), where email sending is configured.</li>
        <li><strong>Hosting providers</strong> — the Penny Pilot backend and frontend are hosted on third-party cloud infrastructure providers, who process data only as needed to run the application (e.g. serving requests, storing the account database).</li>
      </ul>
      <p>
        Penny Pilot does not sell your personal or financial data, and does not use third-party advertising or analytics
        trackers.
      </p>

      <h2>9. Cookies</h2>
      <p>
        Penny Pilot uses strictly necessary, first-party cookies to keep you signed in (signed, HTTP-only session
        cookies) and to remember basic preferences such as your light/dark theme. These cookies are not used for
        advertising or cross-site tracking. See the{" "}
        <a href="/cookie-notice" className="font-medium text-pp-accent underline underline-offset-2 hover:opacity-80">
          Cookie Notice
        </a>{" "}
        for a full list of what&apos;s stored and why, and use the Cookie Preferences link in the footer at any time
        to change your choice for optional (non-essential) storage.
      </p>

      <h2>10. Your Rights</h2>
      <ul>
        <li><strong>Access &amp; export</strong>: you can view your financial data at any time within the App, and export it using the App&apos;s built-in reporting/export features. Your primary financial data also remains directly accessible to you in your own Google Drive.</li>
        <li><strong>Correction</strong>: you can edit or delete individual financial records directly within the App.</li>
        <li><strong>Disconnection</strong>: you can disconnect Google Drive at any time, as described in Section 7.</li>
        <li><strong>Account data requests</strong>: to request access to, correction of, or deletion of the account data Penny Pilot stores about you, contact us using the details in Section 11.</li>
      </ul>

      <h2>11. Contact</h2>
      <p>
        If you have questions about this Privacy Policy or how your data is handled, please contact:
      </p>
      <ul>
        <li>Email: {PLACEHOLDER_EMAIL}</li>
        <li>Entity: {PLACEHOLDER_ENTITY}</li>
      </ul>

      <h2>12. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time as the App evolves. Material changes will be reflected by
        updating the &quot;Last updated&quot; date at the top of this page.
      </p>
    </LegalPageShell>
  );
}
