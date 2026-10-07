import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getUser } from "@/lib/supabase/server";
import type { List } from "@/lib/types";
import { NewListButton } from "./NewListButton";

export const metadata = { title: "My lists" };

export default function ListsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <Suspense fallback={<p className="text-muted">Loading your lists…</p>}>
        <Lists />
      </Suspense>
    </main>
  );
}

const KIND_LABEL = { reviews: "Your reviews", saved: "Google list", custom: "List" } as const;
const VISIBILITY_LABEL = { private: "Private", unlisted: "Anyone with the link", public: "Public" } as const;

async function Lists() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login?next=/lists");

  const { data, error } = await supabase
    .from("lists")
    .select("*, list_items(count)")
    .eq("owner_id", user.id)
    .order("kind")
    .order("name");
  if (error) throw error;
  const lists = (data as (List & { list_items: { count: number }[] })[]).map((l) => ({
    ...l,
    item_count: l.list_items[0]?.count ?? 0,
  }));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My lists</h1>
          <p className="mt-1 text-sm text-muted">Your reviews and saved lists from Google Maps, plus your own.</p>
        </div>
        <div className="flex gap-2">
          <NewListButton />
          <Link href="/import" className="btn btn-primary">
            Import from Google
          </Link>
        </div>
      </div>

      {lists.length === 0 ? (
        <div className="card mt-8 p-8 text-center">
          <h2 className="text-lg font-semibold">Nothing here yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Import your Google Maps reviews and saved lists (Want to go, Favorites, and any you&apos;ve made) from a
            Google Takeout export. It takes a few minutes.
          </p>
          <Link href="/import" className="btn btn-primary mt-5">
            Start import
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/lists/all" className="card group p-5 transition-colors hover:border-accent">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Everything</p>
            <h2 className="mt-1 font-semibold group-hover:text-accent">All my places</h2>
            <p className="mt-3 text-sm text-muted">Every place across all your lists</p>
          </Link>
          {lists.map((l) => (
            <Link key={l.id} href={`/lists/${l.id}`} className="card group p-5 transition-colors hover:border-accent">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{KIND_LABEL[l.kind]}</p>
              <h2 className="mt-1 font-semibold group-hover:text-accent">{l.name}</h2>
              <p className="mt-3 flex items-center justify-between text-sm text-muted">
                <span>
                  {l.item_count} place{l.item_count === 1 ? "" : "s"}
                </span>
                <span className={l.visibility === "private" ? "" : "text-accent"}>{VISIBILITY_LABEL[l.visibility]}</span>
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
