import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security and Data Isolation",
  description:
    "How Due Diligence Copilot protects confidential deal documents: workspace isolation enforced in the database, private storage, roles and integrity checks.",
  alternates: { canonical: "/security" },
};

const items = [
  {
    title: "Workspace isolation in the database",
    body: "Every document, page and search result belongs to one workspace. Access is enforced with Postgres row level security, so even a bug in the application cannot return another workspace's data.",
  },
  {
    title: "Role-based access",
    body: "Owners, admins, analysts and viewers have different permissions. Viewers can read but not upload; only admins can delete; only owners can grant ownership.",
  },
  {
    title: "Private storage",
    body: "Files are stored in a private bucket, encrypted at rest and in transit. Storage access follows the same workspace roles as the database.",
  },
  {
    title: "Integrity checks",
    body: "Each upload is fingerprinted with SHA-256 in your browser. The processing pipeline verifies the fingerprint before reading the file, and duplicate uploads are detected automatically.",
  },
];

export default function Security() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Security and data isolation</h1>
      <p className="mt-4 text-lg text-fg-muted">
        Deal documents are confidential. These are the controls that protect them.
      </p>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {items.map((i) => (
          <section key={i.title} className="rounded-lg border border-border p-6">
            <h2 className="text-lg font-semibold">{i.title}</h2>
            <p className="mt-2 text-fg-muted">{i.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
