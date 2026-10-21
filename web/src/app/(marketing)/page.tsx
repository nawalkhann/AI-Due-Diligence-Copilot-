import type { Metadata } from "next";
import Link from "next/link";
import { guides } from "@/content/guides";
import { absoluteUrl, site } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: `${site.name}: AI Due Diligence With Cited Sources` },
  description: site.description,
  alternates: { canonical: "/" },
};

const outputs = [
  {
    title: "Risk assessment",
    body: "Customer concentration, leverage, going-concern language, litigation, related-party dealings and accounting changes, each tied to the passage that raised it.",
  },
  {
    title: "Growth opportunities",
    body: "Segments, geographies and products that are gaining share, with the revenue lines and management commentary behind them.",
  },
  {
    title: "Executive summary",
    body: "A one-page brief for the investment committee: business model, financial trajectory, key risks and open questions.",
  },
];

const sources = [
  "Annual and quarterly reports (10-K, 10-Q, 20-F)",
  "Other SEC filings: 8-K, S-1, proxy statements",
  "Financial statements and Excel models",
  "Investor presentations, including chart data",
  "Market and industry research reports",
  "Word documents, CSV exports and plain text",
];

const faqs = [
  {
    q: "How is this different from asking a chatbot about a company?",
    a: "A general chatbot answers from its training data, which may be out of date and cannot be checked. Due Diligence Copilot answers only from the documents you upload, and every statement links to the page and passage it came from, so you can verify it in seconds.",
  },
  {
    q: "Which file types can I upload?",
    a: "PDF, HTML (including SEC EDGAR filings), Excel, PowerPoint, Word, CSV, Markdown and plain text, up to 100 MB per file. Tables are kept as tables so numbers stay attached to their row and column labels.",
  },
  {
    q: "Who can see my documents?",
    a: "Only members of the workspace you upload to. Access is enforced in the database itself with row level security, so one workspace can never read another's files, pages or search results.",
  },
  {
    q: "Does it replace analysts?",
    a: "No. It removes the hours spent finding and re-reading passages so analysts can spend that time on judgement. Every output is a starting point to be checked, which is why each claim is cited.",
  },
];

export default function Home() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: site.name,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: site.description,
      url: absoluteUrl("/"),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:pt-24">
        <p className="text-sm font-medium uppercase tracking-wide text-accent">AI due diligence · Early access</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Due diligence in minutes, with a source for every claim
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-fg-muted">
          Upload company filings, financial statements, investor presentations and market
          reports. Get risk assessments, growth opportunities and executive summaries where every
          sentence links back to the exact page it came from.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/login?mode=signup"
            className="rounded-md bg-accent px-5 py-3 font-medium text-accent-fg hover:opacity-90"
          >
            Join early access
          </Link>
          <Link href="/how-it-works" className="rounded-md border border-border px-5 py-3 font-medium hover:bg-bg-muted">
            See how it works
          </Link>
        </div>
      </section>

      <section aria-labelledby="outputs" className="border-y border-border bg-bg-muted">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 id="outputs" className="text-2xl font-semibold sm:text-3xl">What you get</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {outputs.map((o) => (
              <div key={o.title} className="rounded-lg border border-border bg-bg p-6">
                <h3 className="text-lg font-semibold">{o.title}</h3>
                <p className="mt-2 text-fg-muted">{o.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="sources" className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2">
        <div>
          <h2 id="sources" className="text-2xl font-semibold sm:text-3xl">Reads the documents analysts actually use</h2>
          <p className="mt-4 text-fg-muted">
            Filings are long, inconsistent and full of tables. The ingestion pipeline keeps headings,
            page numbers and table structure intact, removes repeated headers and footers, and pulls
            the numbers out of charts in slide decks, so nothing important is lost before analysis
            starts.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {sources.map((s) => (
            <li key={s} className="rounded-md border border-border p-4 text-sm">{s}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="trust" className="mx-auto max-w-6xl px-4 py-8">
        <h2 id="trust" className="text-2xl font-semibold sm:text-3xl">Built to be checked</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div>
            <h3 className="font-semibold">Page-level citations</h3>
            <p className="mt-2 text-fg-muted">Open any claim to see the original passage and its page number.</p>
          </div>
          <div>
            <h3 className="font-semibold">Answers only from your sources</h3>
            <p className="mt-2 text-fg-muted">If the documents do not support an answer, it says so instead of guessing.</p>
          </div>
          <div>
            <h3 className="font-semibold">Isolated workspaces</h3>
            <p className="mt-2 text-fg-muted">Each deal lives in its own workspace with role-based access. <Link href="/security" className="text-accent underline">Read about security</Link>.</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="faq" className="mx-auto max-w-3xl px-4 py-16">
        <h2 id="faq" className="text-2xl font-semibold sm:text-3xl">Frequently asked questions</h2>
        <div className="mt-6 divide-y divide-border border-y border-border">
          {faqs.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="cursor-pointer list-none font-medium">
                {f.q}
              </summary>
              <p className="mt-3 text-fg-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="guides" className="mx-auto max-w-6xl px-4">
        <h2 id="guides" className="text-2xl font-semibold sm:text-3xl">Guides for analysts</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {guides.map((g) => (
            <Link key={g.slug} href={`/guides/${g.slug}`} className="rounded-lg border border-border p-6 hover:bg-bg-muted">
              <h3 className="font-semibold">{g.title}</h3>
              <p className="mt-2 text-sm text-fg-muted">{g.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
