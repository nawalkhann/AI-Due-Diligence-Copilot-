import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-3 text-fg-muted">The page you are looking for does not exist or has moved.</p>
      <Link href="/" className="mt-6 rounded-md bg-accent px-4 py-2 font-medium text-accent-fg">
        Go to the home page
      </Link>
    </main>
  );
}
