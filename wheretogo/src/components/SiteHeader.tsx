import Link from "next/link";
import { Suspense } from "react";
import { getUser } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-accent text-accent-ink">
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
              <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
            </svg>
          </span>
          wheretogo
        </Link>
        <nav className="ml-auto flex items-center gap-2 text-sm">
          <Suspense fallback={<span className="h-8 w-24" />}>
            <UserNav />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}

async function UserNav() {
  if (!supabaseConfigured) return null;
  const { user } = await getUser();
  if (!user) {
    return (
      <Link href="/login" className="btn btn-primary">
        Sign in
      </Link>
    );
  }
  const name = (user.user_metadata.full_name as string | undefined) ?? user.email;
  const avatar = user.user_metadata.avatar_url as string | undefined;
  return (
    <>
      <Link href="/lists" className="btn border-transparent bg-transparent">
        My lists
      </Link>
      <Link href="/import" className="btn border-transparent bg-transparent">
        Import
      </Link>
      <form action="/auth/signout" method="post">
        <button className="btn border-transparent bg-transparent" title={`Signed in as ${name}`}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="size-6 rounded-full" referrerPolicy="no-referrer" />
          ) : null}
          Sign out
        </button>
      </form>
    </>
  );
}
