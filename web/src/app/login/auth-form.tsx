"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp, type AuthState } from "./actions";

export function AuthForm({
  mode,
  next,
  initialError,
}: {
  mode: "signin" | "signup";
  next: string;
  initialError?: string;
}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    mode === "signup" ? signUp : signIn,
    { error: initialError },
  );

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="text-sm font-medium">Work email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Password</span>
        <input
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={10}
          required
          className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2"
        />
      </label>
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state.message && <p role="status" className="text-sm text-ok">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent px-4 py-2 font-medium text-accent-fg disabled:opacity-60"
      >
        {pending ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
      </button>
      <p className="text-center text-sm text-fg-muted">
        {mode === "signup" ? (
          <>Already have an account? <Link href="/login" className="text-accent underline">Sign in</Link></>
        ) : (
          <>New here? <Link href="/login?mode=signup" className="text-accent underline">Create an account</Link></>
        )}
      </p>
    </form>
  );
}
