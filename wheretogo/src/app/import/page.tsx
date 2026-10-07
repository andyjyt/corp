import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getUser } from "@/lib/supabase/server";
import { ImportWizard } from "./ImportWizard";

export const metadata = { title: "Import from Google" };

export default function ImportPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Import from Google Maps</h1>
      <p className="mt-1 text-muted">
        Google doesn&apos;t let apps read your reviews or saved lists directly, so the import goes through Google
        Takeout, Google&apos;s official export tool. You can re-import any time; it updates what&apos;s here and
        keeps your notes.
      </p>
      <Suspense fallback={null}>
        <RequireUser />
      </Suspense>
    </main>
  );
}

async function RequireUser() {
  const { user } = await getUser();
  if (!user) redirect("/login?next=/import");
  return <ImportWizard />;
}
