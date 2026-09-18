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
