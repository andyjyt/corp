import Link from "next/link";

const FEATURES = [
  {
    title: "Your reviews, by area",
    body: "Bring in every rating and review you've left on Google Maps, then narrow to a city or neighborhood in one tap.",
  },
  {
    title: "Want to Go, at a glance",
    body: "See cuisine, Google rating, price, open-now and your notes for every saved place in one sortable table, next to a map.",
  },
  {
    title: "How far is it, really?",
    body: "Filter to places within 15 minutes on foot, or 20 by car or transit, from where you are or any point on the map.",
  },
  {
    title: "Share a link, not a screenshot",
    body: "Every list, or any filtered view of it (\"my favorite spots in the West Village\"), is one link anyone can open.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16 sm:py-24">
      <p className="text-sm font-medium text-accent">For people who are always asked “where should I eat?”</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
        Your Google Maps recommendations, finally easy to share.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-muted">
        Import your reviews and saved lists, add your own notes, filter by neighborhood or travel time, and send
        friends a link to exactly the places that matter.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/login" className="btn btn-primary px-5 py-2.5 text-base">
          Sign in with Google
        </Link>
        <Link href="/lists" className="btn px-5 py-2.5 text-base">
          Go to my lists
        </Link>
      </div>

      <div className="mt-16 grid gap-4 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="card p-5">
            <h2 className="font-semibold">{f.title}</h2>
            <p className="mt-1.5 text-sm text-muted">{f.body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
