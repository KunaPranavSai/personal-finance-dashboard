import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { TERMS_VERSION } from "@/lib/legalVersions";

export const metadata: Metadata = {
  title: "Terms of Service · Penny Pilot",
  description: "The terms governing your use of the Penny Pilot personal finance web application.",
  alternates: { canonical: "/terms" },
};

const LAST_UPDATED = "September 15, 2026";
const PLACEHOLDER_EMAIL = "superadminpennypilot@gmail.com";
const PLACEHOLDER_ENTITY = "Pranav Sai Kuna";
const GOVERNING_JURISDICTION = "India";

export default function TermsOfServicePage() {
  return (
    <LegalPageShell title="Terms of Service" lastUpdated={LAST_UPDATED} version={TERMS_VERSION} active="terms">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of Penny Pilot (&quot;Penny Pilot&quot;,
        &quot;the App&quot;, &quot;we&quot;, &quot;us&quot;), a personal finance web application for managing income, expenses,
        budgets, savings, investments, bills/EMIs, and financial goals. Placeholders below marked in{" "}
        <strong>brackets</strong> must be filled in by the application owner before these Terms are relied upon for a
        live, public deployment.
      </p>
      <p>By creating an account or otherwise using Penny Pilot, you agree to be bound by these Terms.</p>

      <h2>1. Eligibility &amp; Accounts</h2>
      <ul>
        <li>You must provide accurate registration information (name, email, and optionally phone number) when creating an account.</li>
        <li>New accounts may require approval before becoming active, at Penny Pilot&apos;s discretion.</li>
        <li>You are responsible for maintaining the confidentiality of your password and any two-factor authentication or passkey credentials associated with your account, and for all activity that occurs under your account.</li>
        <li>You must notify us promptly of any unauthorized use of your account that you become aware of.</li>
      </ul>

      <h2>2. Choice of Storage: Google Drive or This Device Only</h2>
      <p>
        Penny Pilot lets you choose how your financial data is stored: in your own Google Drive (recommended), or
        locally on this device/browser only (&quot;This Device Only&quot; mode). You choose a storage mode when setting up
        your account and can switch it later from Settings — switching does not automatically move existing data
        between modes.
      </p>
      <p><strong>Google Drive mode.</strong> After choosing this mode, you are required to connect a Google account via
        Google OAuth so the App can create and manage a dedicated data workspace inside your Drive, as described in
        the Privacy Policy.</p>
      <ul>
        <li>Core features of the App (recording transactions, budgets, investments, bills, goals, and related data) require an active Google Drive connection in this mode and will not function without one.</li>
        <li>You are responsible for maintaining your own Google account in good standing, including sufficient Google Drive storage space. If your Google Drive runs out of storage, is suspended, or access is revoked, Penny Pilot may be unable to read or save your data until the issue is resolved.</li>
        <li>If you revoke Penny Pilot&apos;s access to your Google account, or disconnect Google Drive from within the App, the App will lose the ability to read or write your financial data until you reconnect.</li>
        <li>Penny Pilot depends on the availability and correct functioning of Google&apos;s own services (Google Sign-In and Google Drive APIs). We are not responsible for outages, changes, or limitations imposed by Google that affect the App.</li>
      </ul>
      <p><strong>This Device Only mode.</strong> Your financial data is stored only in this browser/device&apos;s local
        storage and is never sent to or stored by Penny Pilot&apos;s servers, database, or any Google account. No Google
        account connection is used for your financial data in this mode.</p>
      <ul>
        <li>You are solely responsible for backing up This Device Only data, using the App&apos;s export feature. Penny Pilot keeps no copy of this data anywhere else.</li>
        <li>If this browser&apos;s site data is cleared, the device is lost, the browser profile is reset, or you switch devices or browsers without first exporting a backup, this data may be permanently and unrecoverably lost.</li>
        <li>Penny Pilot is not liable for data loss arising from your choice of This Device Only mode, except to the extent such liability cannot be excluded by applicable law.</li>
      </ul>

      <h2>3. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use Penny Pilot for any unlawful purpose or in violation of any applicable law or regulation.</li>
        <li>Attempt to gain unauthorized access to another user&apos;s account, data, or Google Drive contents.</li>
        <li>Interfere with, disrupt, or attempt to bypass the App&apos;s security, authentication, or rate-limiting mechanisms.</li>
        <li>Use the App to store or transmit malicious code, or to misrepresent your identity.</li>
        <li>Reverse-engineer, scrape, or resell access to the App except as expressly permitted by us in writing.</li>
      </ul>

      <h2>4. Your Responsibility for Your Data</h2>
      <p>
        You are solely responsible for the accuracy of the financial information you enter into Penny Pilot. Penny
        Pilot is a personal record-keeping and planning tool — it does not provide financial, investment, tax, or legal
        advice, and any summaries, charts, budgets, or &quot;insights&quot; it generates are derived purely from the data you
        provide and should not be relied upon as professional advice.
      </p>
      <p>
        In Google Drive mode, you are also responsible for the security of your Google account and for any actions
        you or others take directly within your Google Drive (such as manually editing, moving, or deleting Penny
        Pilot&apos;s data files), which are outside Penny Pilot&apos;s control. In This Device Only mode, you are
        responsible for the security of this device/browser and for maintaining your own backups.
      </p>

      <h2>5. Service Availability</h2>
      <p>
        We aim to keep Penny Pilot available and reliable, but the App is provided on an &quot;as available&quot; basis. We
        do not guarantee uninterrupted or error-free operation, and the App may be temporarily unavailable due to
        maintenance, updates, or factors outside our control, including outages of third-party services such as
        Google Drive, our hosting providers, or our email provider.
      </p>

      <h2>6. Intellectual Property</h2>
      <p>
        The Penny Pilot application, including its design, branding, and underlying software (excluding your own data
        and any third-party services it relies on), is the property of its developer(s) and is protected by
        applicable intellectual property laws. You are granted a limited, non-exclusive, non-transferable right to
        use the App for your personal financial management, subject to these Terms. You retain all rights to the
        financial data you create and store using the App.
      </p>

      <h2>7. Termination</h2>
      <ul>
        <li>You may stop using Penny Pilot at any time, and may disconnect Google Drive, clear your local browser data, or request account deletion as described in the Privacy Policy.</li>
        <li>We may suspend or terminate your account if we reasonably believe you have violated these Terms, engaged in fraudulent or abusive behavior, or where required by law.</li>
        <li>Terminating your Penny Pilot account does not delete data already stored in your own Google Drive — that data remains yours and under your control, separate from your Penny Pilot account. This Device Only data is likewise unaffected by account termination unless you clear it yourself.</li>
      </ul>

      <h2>8. Disclaimers</h2>
      <p>
        THE APP IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;, WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR
        IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
        AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE APP WILL BE ERROR-FREE, SECURE, OR UNINTERRUPTED, OR THAT
        ANY FINANCIAL CALCULATIONS, INSIGHTS, OR PROJECTIONS IT GENERATES ARE ACCURATE OR SUITABLE FOR YOUR
        CIRCUMSTANCES.
      </p>

      <h2>9. Limitation of Liability</h2>
      <p>
        TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, PENNY PILOT AND ITS DEVELOPER(S) SHALL NOT BE LIABLE FOR
        ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA, PROFITS, OR
        REVENUE, ARISING OUT OF OR RELATED TO YOUR USE OF (OR INABILITY TO USE) THE APP, INCLUDING LOSS OF DATA
        RESULTING FROM ISSUES WITH YOUR GOOGLE ACCOUNT OR GOOGLE DRIVE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
        DAMAGES.
      </p>

      <h2>10. Governing Law</h2>
      <p>These Terms are governed by the laws of {GOVERNING_JURISDICTION}, without regard to conflict-of-law principles.</p>

      <h2>11. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time as the App evolves. Material changes will be reflected by updating
        the &quot;Last updated&quot; date at the top of this page. Continued use of the App after changes take effect
        constitutes acceptance of the revised Terms.
      </p>

      <h2>12. Contact</h2>
      <ul>
        <li>Email: {PLACEHOLDER_EMAIL}</li>
        <li>Entity: {PLACEHOLDER_ENTITY}</li>
      </ul>
    </LegalPageShell>
  );
}
