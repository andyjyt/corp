# wheretogo

Share your Google Maps recommendations by area, and sift through your Want to Go places without clicking them one at a time.

- **Import** your Google Maps reviews, starred places and saved lists (Want to go, Favorites, custom lists).
- **Enrich** every place with cuisine/type, Google rating, price, opening hours and neighborhood.
- **Browse** in a sortable table next to a map; filter by country/city/neighborhood, cuisine, rating, price, open now, the map viewport, or **travel time** (walk/drive/transit/bike).
- **Add your own notes** and ratings, and add places manually via Google search.
- **Share** any list, or any *filtered view* of it, as a link that anyone can open without signing in.

## How data gets in

Google has no API that lets an app read your Maps reviews or saved lists. The Data Portability API can do it, but only for accounts in the EU/UK. So the import uses **Google Takeout**:

1. At [takeout.google.com](https://takeout.google.com/), deselect all, then select **Maps (your places)** (reviews + starred places) and **Saved** (your lists).
2. Upload the zip(s) on the app's Import page. Files are parsed **in the browser**; only the place records are sent to the server, in batches of 25.
3. The server looks up each place with the Places API, matching on the place id embedded in the Takeout URL (the "CID"), and stores the details.

Re-importing updates the same lists (keyed by list name) and never overwrites your own notes. Places already in the catalog aren't looked up again.

Quirks handled (all seen in real exports):

- **Saved CSVs** only have a name and a URL. Places are matched by the CID inside the URL.
- **Some starred places and reviews** come with "No location information": just a `?q=<address>` or only a CID. Address-only entries are searched by address. CID-only reviews are kept as "Unknown place" so the rating isn't lost; the list shows them under **⚠ unmatched**, and you fix each one by searching for it.
- **The Saved export also contains non-places** (web pages, books, films). Anything that isn't a Google Maps link is skipped, and lists that end up empty aren't created.

## Stack

- **Next.js 16** (App Router, Cache Components) + Tailwind v4
- **Supabase**: Postgres, Google sign-in, row-level security
- **Google Maps Platform**: Places API (New) for lookups and search, Routes API for travel times, Maps JavaScript API for the map

```
src/
  app/
    api/import          batch import of Takeout records → resolve places → upsert lists
    api/places/*        search (autocomplete), add to list, fix a mismatched place
    api/travel-times    route matrix from an origin to catalog places
    lists/, lists/[id]  your lists; "all" = every place across lists
    s/[slug]            public/unlisted share page (no sign-in)
    import/             Takeout upload wizard
    dev/preview         the browser UI with sample data (development only)
  components/browser/   table + map + filters (PlaceBrowser and friends)
  lib/
    takeout/            Takeout parsing (pure, tested)
    google/             Places/Routes client, matching, field derivation
    filters.ts          filter/sort/facets + URL (de)serialization (pure, tested)
supabase/migrations/    schema, RLS, read functions
```

### Data model

| table         | what                                                                 | who can write                         |
| ------------- | -------------------------------------------------------------------- | ------------------------------------- |
| `places`      | shared catalog, one row per real place (Google id, CID, area, cuisine, rating, hours…) | server only, using the secret key |
| `lists`       | a person's lists, with `visibility` (private / unlisted / public) and an unguessable `share_slug` | owner |
| `list_items`  | place ↔ list, with a per-list note                                   | list owner                            |
| `user_places` | a person's take on a place: rating, Google review text, own notes    | that person                           |

`get_list(id | slug)` and `my_places()` return a whole list as one JSON document. They do the access checks, so share links don't need table-level read access.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema: `npx supabase link --project-ref <ref>`, then `npx supabase db push`. Alternatively, paste `supabase/migrations/*.sql` into the SQL editor.
3. Under **Authentication → URL Configuration**, set the Site URL (e.g. `https://wheretogo.vercel.app`) and add `https://<your-domain>/auth/callback` plus `http://localhost:3000/auth/callback` to the redirect URLs.

### 2. Google Cloud

1. Create a project and enable **Places API (New)**, **Routes API** and **Maps JavaScript API**. Billing must be enabled.
2. **Sign-in:** under APIs & Services → Credentials, create an *OAuth client ID* (Web). Add `https://<project-ref>.supabase.co/auth/v1/callback` as an authorized redirect URI. Paste the client id and secret into Supabase → Authentication → Providers → Google.
3. **Keys:**
   - Server key (`GOOGLE_MAPS_API_KEY`): restricted to Places API (New) + Routes API.
   - Browser key (`NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`): restricted to Maps JavaScript API and to your site's HTTP referrers.
   - Optionally create a Map ID (Map Management) for `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`.
4. Set **quotas** on the server key's APIs (e.g. a requests/day cap). The travel-time endpoint is open to share-link viewers.

### 3. Run it

```bash
cp .env.example .env.local   # fill in
npm install
npm run dev                  # http://localhost:3000
npm test                     # unit tests
npm run typecheck && npm run lint
```

To develop against a local Supabase instead (requires Docker): `npx supabase start`, put the printed URL and keys in `.env.local`, and put Google OAuth credentials in `supabase/.env` as `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`.

To work on the UI without any backend, open `/dev/preview`, which uses sample data.

### 4. Deploy

Import the repo into Vercel, set the root directory to this folder, and add the env vars from `.env.example`.

## Costs

Each place lookup is one **Text Search (Enterprise)** request. Rating, price and hours are Enterprise fields. As of this writing ([pricing](https://developers.google.com/maps/billing-and-pricing/pricing)), the first **1,000/month are free**, then **$35 per 1,000**. A first import of ~2,000 places therefore costs roughly $35 once. You can also import a few lists per month to stay within the free tier. Re-imports reuse the catalog and cost almost nothing.

Other usage is small:

- **Autocomplete** for adding places is billed per session.
- **Route Matrix** for travel times is billed per destination, up to 300 per request; results are reused while the origin stays the same.
- **Map loads** have a monthly free allowance.

Google's terms limit how long most Places content may be cached (place ids may be kept indefinitely). A periodic refresh of `places` rows older than 30 days is on the roadmap below.

## Roadmap

Core (this version): import, enrich, browse/filter, travel time, notes, manual add, fix matches, share links.

Next:

- Refresh stale place details (enriched more than 30 days ago) in the background; show photos.
- Keep the extra review details Takeout includes (food/service/atmosphere sub-ratings, meal type, price per person).
- Public profile pages (`/u/<handle>`) listing public lists, then follows and a feed (the `public` visibility already exists for this).
- Copy a place or a whole list from someone's share link into your own lists.
- Itineraries: an ordered list of places with day/time slots, built from a filtered view, with route times between stops.
- Marker clustering for very large lists; offline/PWA install.
