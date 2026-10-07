import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PlaceBrowser } from "@/components/browser/PlaceBrowser";
import { loadSharedList } from "@/lib/lists";

export async function generateMetadata({ params }: PageProps<"/s/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const view = await loadSharedList(slug);
  if (!view?.list) return { title: "List not found" };
  const by = view.owner?.display_name ? ` by ${view.owner.display_name}` : "";
  return {
    title: `${view.list.name}${by}`,
    description: `${view.entries.length} places${by}, shared from wheretogo.`,
    robots: view.list.visibility === "public" ? undefined : { index: false },
  };
}

export default function SharedListPage({ params }: PageProps<"/s/[slug]">) {
  return (
    <Suspense fallback={<p className="p-6 text-muted">Loading…</p>}>
      <SharedList params={params} />
    </Suspense>
  );
}

async function SharedList({ params }: { params: PageProps<"/s/[slug]">["params"] }) {
  const { slug } = await params;
  const view = await loadSharedList(slug);
  if (!view?.list) notFound();
  return (
    <PlaceBrowser
      list={view.list}
      entries={view.entries}
      ownerName={view.owner?.display_name ?? null}
      viewerId={null}
      title={view.list.name}
      shared
    />
  );
}
