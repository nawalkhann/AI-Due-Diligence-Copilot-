import type { Metadata } from "next";
import Link from "next/link";
import { guides } from "@/content/guides";

export const metadata: Metadata = {
  title: "Due Diligence Guides for Analysts",
  description:
    "Practical guides on reading SEC filings, spotting financial statement red flags, and using AI responsibly in due diligence.",
  alternates: { canonical: "/guides" },
};

export default function GuidesIndex() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Due diligence guides</h1>
      <p className="mt-4 text-lg text-fg-muted">
        Practical, source-backed guides for analysts working through filings and financials.
      </p>
      <ul className="mt-10 space-y-6">
        {guides.map((g) => (
          <li key={g.slug} className="rounded-lg border border-border p-6">
            <h2 className="text-xl font-semibold">
              <Link href={`/guides/${g.slug}`} className="hover:underline">{g.title}</Link>
            </h2>
            <p className="mt-2 text-fg-muted">{g.description}</p>
            <p className="mt-3 text-sm text-fg-muted">{g.readingMinutes} min read</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
