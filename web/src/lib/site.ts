// Public site settings used for metadata, the sitemap and structured data.
// NEXT_PUBLIC_SITE_URL must be the canonical production URL (with https://).
export const site = {
  name: "Due Diligence Copilot",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  tagline: "AI due diligence with a source for every claim",
  description:
    "AI due diligence that reads filings, financials and investor decks, then delivers risk assessments and executive summaries cited to the exact page.",
  keywords: [
    "AI due diligence",
    "due diligence software",
    "financial due diligence",
    "10-K analysis",
    "SEC filing analysis",
    "investment research AI",
    "risk assessment",
    "private equity due diligence",
    "M&A due diligence",
    "RAG for finance",
  ],
};

export function absoluteUrl(path = "/") {
  return `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
}
