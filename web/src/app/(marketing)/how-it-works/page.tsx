import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How AI Due Diligence Works",
  description:
    "From upload to cited answer: how filings, financial statements and decks are parsed, indexed and analysed with retrieval-augmented generation.",
  alternates: { canonical: "/how-it-works" },
};

const steps = [
  {
    title: "1. Upload your documents",
    body: "Add 10-Ks, 10-Qs, investor presentations, Excel models and market reports to a deal workspace. Files go to private, encrypted storage that only workspace members can reach.",
  },
  {
    title: "2. Structure-aware parsing",
    body: "Each file is read with a parser built for its format. PDF tables are detected and kept as tables, running headers and page numbers are removed, SEC filings are split at their original page breaks, and chart data is extracted from slides.",
  },
  {
    title: "3. Indexing with page references",
    body: "Documents are split into passages that never cross a section heading. Each passage keeps its page range and section, and is indexed for both keyword and semantic search, with context about the company, document and period.",
  },
  {
    title: "4. Retrieval and cited analysis",
    body: "When you ask a question or generate a report, the most relevant passages are retrieved and re-ranked, and the model writes its answer only from them, citing each one. If the documents do not contain the answer, it says so.",
  },
];

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h1>
      <p className="mt-4 text-lg text-fg-muted">
        Due Diligence Copilot uses retrieval-augmented generation (RAG): the AI answers from your
        documents, not from memory, and shows you exactly where each answer came from.
      </p>
      <ol className="mt-12 space-y-8">
        {steps.map((s) => (
          <li key={s.title} className="rounded-lg border border-border p-6">
            <h2 className="text-xl font-semibold">{s.title}</h2>
            <p className="mt-2 text-fg-muted">{s.body}</p>
          </li>
        ))}
      </ol>
      <h2 className="mt-16 text-2xl font-semibold">Supported formats</h2>
      <p className="mt-3 text-fg-muted">
        PDF, HTML and SEC EDGAR filings, Excel (.xlsx), PowerPoint (.pptx), Word (.docx), CSV,
        Markdown and plain text, up to 100 MB per file. Scanned PDFs are read with OCR.
      </p>
      <p className="mt-10">
        New to filings analysis? Start with{" "}
        <Link href="/guides/how-to-read-a-10-k-for-due-diligence" className="text-accent underline">
          how to read a 10-K for due diligence
        </Link>
        .
      </p>
    </div>
  );
}
