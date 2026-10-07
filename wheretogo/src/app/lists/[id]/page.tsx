import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PlaceBrowser } from "@/components/browser/PlaceBrowser";
import { loadList } from "@/lib/lists";

export default function ListPage({ params }: PageProps<"/lists/[id]">) {
  return (
    <Suspense fallback={<p className="p-6 text-muted">Loading…</p>}>
      <ListContent params={params} />
    </Suspense>
  );
}

async function ListContent({ params }: { params: PageProps<"/lists/[id]">["params"] }) {
  const { id } = await params;
  const view = await loadList(id);
  if (view === "signin") redirect(`/login?next=/lists/${id}`);
  if (!view) notFound();
  return (
    <PlaceBrowser
      list={view.list}
      entries={view.entries}
      ownerName={view.owner?.display_name ?? null}
      viewerId={view.viewerId}
      title={view.list?.name ?? "All my places"}
    />
  );
}
