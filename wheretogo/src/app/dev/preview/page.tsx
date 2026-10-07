import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PlaceBrowser } from "@/components/browser/PlaceBrowser";
import { SAMPLE_ENTRIES } from "./fixtures";

// Renders the place browser with sample data, so the UI can be worked on
// without a database. Development only.
export default function PreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <Suspense>
      <PlaceBrowser title="Preview (sample data)" list={null} entries={SAMPLE_ENTRIES} ownerName={null} viewerId={null} shared />
    </Suspense>
  );
}
