import Link from "next/link";
import { site } from "@/lib/site";

const nav = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/security", label: "Security" },
  { href: "/guides", label: "Guides" },
];

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.svg" alt="" width={28} height={28} />
      <span>{site.name}</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4">
        <Logo />
        <nav aria-label="Main" className="order-3 flex w-full gap-5 text-sm text-fg-muted sm:order-none sm:w-auto">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-fg">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/login" className="hover:underline">
            Sign in
          </Link>
          <Link
            href="/login?mode=signup"
            className="rounded-md bg-accent px-3 py-2 font-medium text-accent-fg hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-bg-muted">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-fg-muted sm:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs">{site.tagline}.</p>
        </div>
        <nav aria-label="Product" className="flex flex-col gap-2">
          <span className="font-medium text-fg">Product</span>
          <Link href="/how-it-works" className="hover:text-fg">How it works</Link>
          <Link href="/security" className="hover:text-fg">Security</Link>
          <Link href="/login?mode=signup" className="hover:text-fg">Get started</Link>
        </nav>
        <nav aria-label="Resources" className="flex flex-col gap-2">
          <span className="font-medium text-fg">Resources</span>
          <Link href="/guides" className="hover:text-fg">All guides</Link>
          <Link href="/guides/how-to-read-a-10-k-for-due-diligence" className="hover:text-fg">Reading a 10-K</Link>
          <Link href="/guides/financial-statement-red-flags" className="hover:text-fg">Financial red flags</Link>
          <Link href="/guides/ai-for-due-diligence" className="hover:text-fg">AI for due diligence</Link>
        </nav>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-fg-muted">
        © {new Date().getFullYear()} {site.name}. Outputs are research aids and not investment advice.
      </p>
    </footer>
  );
}
