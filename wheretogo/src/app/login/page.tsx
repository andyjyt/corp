import { Suspense } from "react";
import { supabaseConfigured } from "@/lib/supabase/env";
import { SignInButton } from "./SignInButton";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-20">
      <div className="card p-6">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted">
          Sign in with your Google account to import your Maps reviews and lists and share them.
        </p>
        {supabaseConfigured ? (
          <Suspense>
            <SignInButton />
          </Suspense>
        ) : (
          <p className="mt-5 rounded-lg bg-surface-2 p-3 text-sm">
            Supabase isn&apos;t configured yet. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> — see the README.
          </p>
        )}
      </div>
    </main>
  );
}
