import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { CookiePreferencesLink } from "@/components/consent/CookiePreferencesLink";
import { getSupportEmail } from "@/lib/publicSettings";

export const metadata: Metadata = {
  title: "Cookie Notice · Penny Pilot",
  description: "What cookies and local storage Penny Pilot actually uses, why, and how to change your preferences.",
  alternates: { canonical: "/cookie-notice" },
};

const LAST_UPDATED = "September 20, 2026";

export default async function CookieNoticePage() {
  const supportEmail = await getSupportEmail();

  return (
    <LegalPageShell title="Cookie Notice" lastUpdated={LAST_UPDATED} active="cookies">
      <p>
        This Cookie Notice explains the cookies and similar browser storage Penny Pilot (&quot;Penny Pilot&quot;,
        &quot;the App&quot;, &quot;we&quot;, &quot;us&quot;) actually uses, why, and how you can change your choice at any
        time. It only describes real, current behavior — nothing here is aspirational or hypothetical.
      </p>

      <h2>1. What &quot;cookies&quot; means here</h2>
      <p>
        A cookie is a small piece of data a website asks your browser to store and send back on later requests.
        Penny Pilot also uses a small amount of browser <code>localStorage</code> for the same kind of purpose
        (remembering a preference on this device) — this notice covers both, since the practical effect for you is
        the same: something is remembered on this device/browser until it expires or you clear it.
      </p>

      <h2>2. Essential cookies and storage</h2>
      <p>These are required for Penny Pilot to function and cannot be turned off:</p>
      <ul>
        <li>
          <strong><code>access_token</code> and <code>refresh_token</code></strong> — signed, HTTP-only session
          cookies set by the Penny Pilot backend when you sign in. They keep you authenticated and are not readable
          by page scripts. <code>access_token</code> lasts up to 1 hour; <code>refresh_token</code> lasts up to 7
          days (both expire sooner if you sign out or your session times out from inactivity).
        </li>
        <li>
          <strong><code>pp_consent</code></strong> — a first-party cookie recording the cookie preference you make
          on this page or the notice/preference center, so we don&apos;t ask again every visit. Kept for up to 12
          months, or until you clear your browser storage.
        </li>
        <li>
          <strong>Storage-mode and app-state <code>localStorage</code></strong> — remembers whether you&apos;ve chosen
          Google Drive or This Device Only storage, your passkey/biometric sign-in preference, and similar
          application state needed for the App to work correctly across page loads. In This Device Only mode, this
          is also where your financial data itself is stored, entirely on this device — see the{" "}
          <a href="#local-only" className="font-medium text-pp-accent underline underline-offset-2 hover:opacity-80">
            note below
          </a>
          .
        </li>
        <li>
          <strong>Progressive Web App (service worker) caching</strong> — if you install Penny Pilot as an app or
          use it offline, a service worker caches app files and a small amount of reference data (e.g. your
          category list) so the App still loads and works with a poor or offline connection. This is standard PWA
          application caching, not analytics or tracking, and holds no advertising identifiers.
        </li>
      </ul>

      <h2>3. Functional (optional)</h2>
      <p>
        Penny Pilot remembers two small, non-essential preferences if you allow it in the Privacy Preference
        Center:
      </p>
      <ul>
        <li>Your light/dark theme choice, so it doesn&apos;t reset to the system default every visit.</li>
        <li>A remembered sign-in email, if you check &quot;Remember me&quot; on the login page.</li>
      </ul>
      <p>
        If you don&apos;t allow this category, Penny Pilot still works fully — these two details simply won&apos;t be
        remembered the next time you visit.
      </p>

      <h2>4. Performance/analytics and marketing/advertising</h2>
      <p>
        Penny Pilot does not currently use any analytics, performance-tracking, marketing, or advertising cookies,
        pixels, or third-party trackers. It does not sell your personal or financial data. If this ever changes,
        this notice and the Privacy Preference Center will be updated to describe the real purpose and provider
        before anything is activated — no new tracking category will appear here that isn&apos;t genuinely in use.
      </p>

      <h2 id="local-only">5. A note on This Device Only mode</h2>
      <p>
        If you use This Device Only storage, your transactions, budgets, and other financial records are kept only
        in this browser&apos;s local storage, not sent to Penny Pilot&apos;s servers. This is application data storage,
        not a tracking mechanism — it exists solely so the App can display your own data back to you, and clearing
        your browser&apos;s site data for Penny Pilot will permanently delete it (see the Privacy Policy and Terms of
        Service for details).
      </p>

      <h2>6. Changing your choice</h2>
      <p>
        You can open the Privacy Preference Center at any time from the{" "}
        <CookiePreferencesLink className="font-medium text-pp-accent underline underline-offset-2 hover:opacity-80" /> link
        in the footer of the landing page, or on this page. Changing your choice takes effect immediately and does
        not require signing out, and never affects your ability to sign in, use two-factor authentication or
        passkeys, connect or use Google Drive, use This Device Only mode, or manage your financial data.
      </p>

      <h2>7. Contact</h2>
      <p>
        Questions about this Cookie Notice or how Penny Pilot handles cookies and storage:{" "}
        {supportEmail ? (
          <a href={`mailto:${supportEmail}`} className="font-medium text-pp-accent underline underline-offset-2 hover:opacity-80">
            {supportEmail}
          </a>
        ) : (
          <span>see the Contact Support link in the footer</span>
        )}
        . See also the{" "}
        <a href="/privacy-policy" className="font-medium text-pp-accent underline underline-offset-2 hover:opacity-80">
          Privacy Policy
        </a>{" "}
        for how your account and financial data are handled more broadly.
      </p>
    </LegalPageShell>
  );
}
