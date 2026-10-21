import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuide, guides } from "@/content/guides";
import { absoluteUrl, site } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return guides.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  return {
    title: { absolute: guide.seoTitle ?? guide.title },
    description: guide.description,
    keywords: guide.keywords,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: {
      type: "article",
      title: guide.title,
      description: guide.description,
      url: `/guides/${guide.slug}`,
      publishedTime: guide.published,
      modifiedTime: guide.updated,
    },
  };
}

export default async function GuidePage({ params }: PageProps<"/guides/[slug]">) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    datePublished: guide.published,
    dateModified: guide.updated,
    mainEntityOfPage: absoluteUrl(`/guides/${guide.slug}`),
    author: { "@type": "Organization", name: site.name, url: absoluteUrl("/") },
    publisher: { "@type": "Organization", name: site.name, url: absoluteUrl("/") },
  };
  const others = guides.filter((g) => g.slug !== guide.slug);

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <nav aria-label="Breadcrumb" className="text-sm text-fg-muted">
        <Link href="/guides" className="hover:underline">Guides</Link>
      </nav>
      <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{guide.title}</h1>
      <p className="mt-4 text-lg text-fg-muted">{guide.description}</p>
      <p className="mt-3 text-sm text-fg-muted">
        Updated <time dateTime={guide.updated}>{new Date(guide.updated).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}</time>
        {" · "}{guide.readingMinutes} min read
      </p>
      <div className="prose-article mt-10">{guide.body()}</div>

      <aside className="mt-16 rounded-lg border border-border bg-bg-muted p-6">
        <h2 className="text-lg font-semibold">Analyse filings with cited answers</h2>
        <p className="mt-2 text-fg-muted">
          Upload filings and decks, then ask questions and get answers linked to the exact page.
        </p>
        <Link href="/login?mode=signup" className="mt-4 inline-block rounded-md bg-accent px-4 py-2 font-medium text-accent-fg hover:opacity-90">
          Join early access
        </Link>
      </aside>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">More guides</h2>
        <ul className="mt-3 space-y-2">
          {others.map((g) => (
            <li key={g.slug}>
              <Link href={`/guides/${g.slug}`} className="text-accent hover:underline">{g.title}</Link>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
