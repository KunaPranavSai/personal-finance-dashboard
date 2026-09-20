import type { Metadata } from "next";
import { getManualMarkdown, getManualBody, getManualHeadings, getManualSearchIndex } from "@/lib/manual";
import { SITE_URL } from "@/lib/siteUrl";
import { ManualHeader } from "@/components/manual/ManualHeader";
import { ManualBreadcrumb } from "@/components/manual/ManualBreadcrumb";
import { ManualToc } from "@/components/manual/ManualToc";
import { ManualSearch } from "@/components/manual/ManualSearch";
import { ManualContent } from "@/components/manual/ManualContent";
import { ManualReadingControls } from "@/components/manual/ManualReadingControls";
import { LandingFooter } from "@/components/landing/Footer";

const TITLE = "Penny Pilot User Manual | Smart Money Management";
const DESCRIPTION =
  "The official Penny Pilot user manual: how to track income and expenses, set budgets and savings goals, manage investments, read analytics, choose Google Drive or Local-Only storage, and use account security and recovery.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/manual" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/manual`,
    type: "article",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
};

export default function ManualPage() {
  const body = getManualBody(getManualMarkdown());
  const headings = getManualHeadings(body);
  const searchIndex = getManualSearchIndex(body);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        headline: "Penny Pilot User Manual",
        description: DESCRIPTION,
        url: `${SITE_URL}/manual`,
        inLanguage: "en",
        isPartOf: { "@type": "WebSite", name: "Penny Pilot", url: SITE_URL },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Penny Pilot", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "User Manual", item: `${SITE_URL}/manual` },
        ],
      },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col bg-pp-bg">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ManualHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <ManualBreadcrumb headings={headings} />

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-pp-text sm:text-4xl">Penny Pilot User Manual</h1>
          <p className="mt-2 max-w-2xl text-pp-text-dim">
            Everything Penny Pilot does, explained in plain language: features, calculations, storage, security, and everyday use.
          </p>
          <div className="mt-5 max-w-lg">
            <ManualSearch index={searchIndex} />
          </div>
        </div>

        {/* items stretch (the default) on purpose: the aside's grid cell
            needs to span the full height of the article so the sticky
            Contents panel has room to stay pinned for the whole scroll,
            not just the first screenful. */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
          <ManualToc headings={headings} />
          <article className="min-w-0">
            <ManualContent markdown={body} />
          </article>
        </div>
      </main>

      <ManualReadingControls headings={headings} />
      <LandingFooter />
    </div>
  );
}
