"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignInButton() {
  const params = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(params.get("error") ? "Sign-in didn't complete. Try again." : null);

  async function signIn() {
    setPending(true);
    setError(null);
    const next = params.get("next") ?? "/lists";
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setError(error.message);
      setPending(false);
    }
  }

  return (
    <>
      <button className="btn btn-primary mt-5 w-full py-2.5" onClick={signIn} disabled={pending}>
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
          <path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 3.7 14.55 2.75 12 2.75 6.9 2.75 2.75 6.9 2.75 12S6.9 21.25 12 21.25c5.34 0 8.88-3.75 8.88-9.04 0-.6-.07-1.06-.15-1.51Z" />
        </svg>
        {pending ? "Redirecting…" : "Continue with Google"}
      </button>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
    </>
  );
}
