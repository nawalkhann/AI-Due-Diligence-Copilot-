import type { Metadata } from "next";
import { Logo } from "@/components/site-chrome";
import { supabaseConfigured } from "@/lib/supabase/env";
import { AuthForm } from "./auth-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const mode = params.mode === "signup" ? "signup" : "signin";
  const next = typeof params.next === "string" ? params.next : "/app";
  const error =
    params.error === "config" || !supabaseConfigured
      ? "Sign-in is not configured yet. Set the Supabase environment variables."
      : params.error === "link"
        ? "That sign-in link is invalid or has expired."
        : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-muted px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-border bg-bg p-8 shadow-sm">
        <Logo />
        <h1 className="mt-6 text-2xl font-semibold">
          {mode === "signup" ? "Create your account" : "Sign in"}
        </h1>
        <AuthForm mode={mode} next={next} initialError={error} />
      </div>
    </main>
  );
}
