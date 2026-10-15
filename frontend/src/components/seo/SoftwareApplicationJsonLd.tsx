import { SITE_URL } from "@/lib/siteUrl";

/** Structured data for AI/search discovery of Penny Pilot's public entry
 * point. Only genuinely-known facts about the product go here — no
 * fabricated ratings, reviews, or pricing. */
export function SoftwareApplicationJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Penny Pilot",
        url: SITE_URL,
        logo: `${SITE_URL}/icons/icon-512.png`,
      },
      {
        "@type": "SoftwareApplication",
        name: "Penny Pilot",
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web, iOS, Android",
        url: SITE_URL,
        description:
          "Penny Pilot is a personal finance dashboard for tracking income, expenses, budgets, bills, savings, and investments in one secure place.",
        image: `${SITE_URL}/og-image.png`,
        // Only capabilities the app really has (no ratings, reviews or pricing).
        featureList: [
          "Income and expense tracking with categories and wallets",
          "Monthly, quarterly and yearly budgets",
          "Bills and EMI tracking with optional push reminders (Google Drive mode)",
          "Savings goals and investment tracking",
          "Analytics and exportable reports (CSV, Excel, JSON, PDF)",
          "Data stored in your own Google Drive or only on your device",
          "Installable web app that works offline",
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
