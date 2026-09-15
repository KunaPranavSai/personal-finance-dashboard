import PDFDocument from "pdfkit";
import { TERMS_INTRO, TERMS_SECTIONS, PRIVACY_INTRO, PRIVACY_SECTIONS, LegalSection } from "../../lib/legalDocuments";

export interface ConsentPdfInput {
  name: string;
  email: string;
  signedName: string;
  termsVersion: string;
  privacyVersion: string;
  acceptedAt: Date;
}

const NAVY = "#1F2A44";
const GRAY = "#555555";
const MARGIN = 50;

function formatTimestamp(d: Date): string {
  return d.toLocaleString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** Generates the downloadable "Signed Consent" PDF package: a cover/signature
 * page followed by the full accepted Terms of Service and Privacy Policy
 * text (see lib/legalDocuments.ts), matching what the user actually agreed
 * to at the recorded version. */
export async function generateConsentPdf(input: ConsentPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGIN, size: "A4", bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - MARGIN * 2;
    let y = MARGIN;

    function ensureSpace(needed: number) {
      if (y + needed > doc.page.height - 70) {
        doc.addPage();
        y = MARGIN;
      }
    }

    function heading(text: string, size = 16) {
      ensureSpace(size + 20);
      doc.fontSize(size).font("Helvetica-Bold").fillColor(NAVY).text(text, MARGIN, y, { width: pageWidth });
      y = doc.y + 8;
    }

    function paragraph(text: string, opts: { size?: number; color?: string; bold?: boolean } = {}) {
      const size = opts.size ?? 10;
      doc.fontSize(size).font(opts.bold ? "Helvetica-Bold" : "Helvetica").fillColor(opts.color ?? "#222");
      const h = doc.heightOfString(text, { width: pageWidth });
      ensureSpace(h + 6);
      doc.text(text, MARGIN, y, { width: pageWidth });
      y = doc.y + 6;
    }

    function section(s: LegalSection) {
      heading(s.heading, 12);
      for (const p of s.paragraphs) paragraph(p, { size: 9.5 });
      y += 6;
    }

    // ── Cover / signature page ────────────────────────────────────────────
    doc.fontSize(24).font("Helvetica-Bold").fillColor(NAVY).text("Penny Pilot", MARGIN, y, { align: "center", width: pageWidth });
    y = doc.y + 6;
    doc.fontSize(14).font("Helvetica").fillColor(GRAY).text("Signed Consent & Electronic Authorization", { align: "center", width: pageWidth });
    y = doc.y + 30;

    doc.moveTo(MARGIN, y).lineTo(MARGIN + pageWidth, y).stroke("#ccc");
    y += 30;

    heading("User Information", 13);
    paragraph(`Account name: ${input.name}`);
    paragraph(`Account email: ${input.email}`);
    y += 10;

    heading("Consent Information", 13);
    paragraph(`Terms of Service version accepted: ${input.termsVersion}`);
    paragraph(`Privacy Policy version acknowledged: ${input.privacyVersion}`);
    paragraph(`Acceptance timestamp: ${formatTimestamp(input.acceptedAt)}`);
    paragraph("Consent status: Terms of Service accepted; Privacy Policy acknowledged.");
    y += 10;

    heading("Electronic Signature", 13);
    doc.fontSize(16).font("Helvetica-Oblique").fillColor(NAVY);
    ensureSpace(24);
    doc.text(input.signedName, MARGIN, y, { width: pageWidth });
    y = doc.y + 4;
    paragraph(`Signed electronically on ${formatTimestamp(input.acceptedAt)}.`, { size: 9, color: GRAY });
    y += 4;
    paragraph(
      "This is a typed electronic signature/authorization, not a cryptographic or qualified digital signature. " +
        "By typing their full name and checking the required consent boxes during account creation, the user " +
        "acknowledged that this name serves as their electronic signature/authorization for the acceptance " +
        "recorded above, and confirmed that they reviewed and agreed to the Terms of Service and acknowledged " +
        "the Privacy Policy referenced below.",
      { size: 9, color: GRAY }
    );
    y += 6;
    paragraph(
      "This document represents the electronic acceptance recorded during account creation on Penny Pilot. " +
        "The full text of the Terms of Service and Privacy Policy as accepted follows on subsequent pages.",
      { size: 9, color: GRAY }
    );

    // ── Terms of Service ───────────────────────────────────────────────────
    doc.addPage();
    y = MARGIN;
    heading(`Terms of Service (version ${input.termsVersion})`, 18);
    for (const p of TERMS_INTRO) paragraph(p, { size: 9.5 });
    y += 6;
    for (const s of TERMS_SECTIONS) section(s);

    // ── Privacy Policy ─────────────────────────────────────────────────────
    doc.addPage();
    y = MARGIN;
    heading(`Privacy Policy (version ${input.privacyVersion})`, 18);
    for (const p of PRIVACY_INTRO) paragraph(p, { size: 9.5 });
    y += 6;
    for (const s of PRIVACY_SECTIONS) section(s);

    // Footer with page numbers on every page. Writing this close to the
    // bottom edge falls just past pdfkit's default bottom margin, which
    // makes pdfkit think the text overflows the page and silently appends a
    // *new* blank page to hold it — doubling the page count with empty
    // footer-only pages and leaving the real pages without a footer at all.
    // Zeroing the bottom margin for this call (restored right after) writes
    // the footer in place instead.
    const range = doc.bufferedPageRange();
    const bottomMargin = doc.page.margins.bottom;
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;
      doc.fontSize(8).fillColor("#999");
      doc.text(`Penny Pilot — Signed Consent — Page ${i + 1} of ${range.count}`, MARGIN, doc.page.height - 40, {
        align: "center",
        width: pageWidth,
        lineBreak: false,
      });
      doc.page.margins.bottom = bottomMargin;
    }

    doc.end();
  });
}
