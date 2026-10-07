-- wheretogo schema
--
-- places      shared catalog of real-world places (written only by the server
--             with the secret key, after looking them up in the Places API)
-- lists       a person's lists: their reviews, Google saved lists, custom lists
-- list_items  which places are in which list, with a per-list note
-- user_places a person's own take on a place: rating, review, extra notes

create extension if not exists pgcrypto with schema extensions;

create type public.list_kind as enum ('reviews', 'saved', 'custom');
create type public.visibility as enum ('private', 'unlisted', 'public');

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Profiles ------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Places --------------------------------------------------------------------

create table public.places (
  id uuid primary key default gen_random_uuid(),
  google_place_id text unique,
  cid text unique,
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  country text,
  country_code text,
  region text,
  city text,
  neighborhood text,
  primary_type text,
  category text,
  cuisine text,
  types text[] not null default '{}',
  google_rating numeric(2, 1),
  google_rating_count integer,
  price_level smallint,
  website text,
  phone text,
  maps_url text,
  opening_hours jsonb,
  utc_offset_minutes integer,
  enriched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger places_touch before update on public.places
  for each row execute function public.touch_updated_at();

-- Lists ---------------------------------------------------------------------

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  kind public.list_kind not null default 'custom',
  visibility public.visibility not null default 'private',
  -- Unguessable id used in share links (/s/<slug>).
  share_slug text not null unique
    default translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_'),
  -- Where the list came from, e.g. 'takeout:reviews', so re-imports update it.
  source_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, source_key)
);

create index lists_owner_idx on public.lists (owner_id);
create trigger lists_touch before update on public.lists
  for each row execute function public.touch_updated_at();

create table public.list_items (
  list_id uuid not null references public.lists on delete cascade,
  place_id uuid not null references public.places on delete cascade,
  note text,
  added_at timestamptz not null default now(),
  primary key (list_id, place_id)
);

create index list_items_place_idx on public.list_items (place_id);

create table public.user_places (
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  place_id uuid not null references public.places on delete cascade,
  rating smallint check (rating between 1 and 5),
  review_text text,
  reviewed_at timestamptz,
  notes text,
  updated_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create index user_places_place_idx on public.user_places (place_id);
create trigger user_places_touch before update on public.user_places
  for each row execute function public.touch_updated_at();

-- Row level security ---------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.places enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
alter table public.user_places enable row level security;

create policy "profiles are public" on public.profiles for select using (true);
create policy "update own profile" on public.profiles for update
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "places are public" on public.places for select using (true);

create policy "own lists" on public.lists for all
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "public lists" on public.lists for select using (visibility = 'public');

create policy "items of own lists" on public.list_items for all
  using (exists (select 1 from public.lists l where l.id = list_id and l.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.lists l where l.id = list_id and l.owner_id = (select auth.uid())));

create policy "own place notes" on public.user_places for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select on public.profiles, public.places to anon, authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
grant select, insert, update, delete on public.lists, public.list_items, public.user_places to authenticated;
grant all on all tables in schema public to service_role;

-- Read functions --------------------------------------------------------------
-- These return one jsonb document so large lists aren't cut off by the API's
-- row limit, and so share links can read a list without exposing the tables.

create or replace function public.entry_json(p public.places, up public.user_places, note text, added_at timestamptz)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'place', to_jsonb(p) - 'created_at' - 'updated_at',
    'list_note', note,
    'added_at', added_at,
    'rating', up.rating,
    'review_text', up.review_text,
    'reviewed_at', up.reviewed_at,
    'notes', up.notes
  )
$$;

-- A list with its entries, if the caller owns it, it's public, or they have
-- the share link of a non-private list. Returns null otherwise.
create or replace function public.get_list(p_list_id uuid default null, p_slug text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  l public.lists;
  result jsonb;
begin
  if p_slug is not null then
    select * into l from public.lists where share_slug = p_slug and visibility <> 'private';
  else
    select * into l from public.lists
    where id = p_list_id and (owner_id = auth.uid() or visibility = 'public');
  end if;
  if l.id is null then
    return null;
  end if;

  select jsonb_build_object(
    'list', to_jsonb(l),
    'owner', (select jsonb_build_object('id', pr.id, 'display_name', pr.display_name, 'avatar_url', pr.avatar_url)
              from public.profiles pr where pr.id = l.owner_id),
    'is_owner', coalesce(l.owner_id = auth.uid(), false),
    'entries', coalesce((
      select jsonb_agg(public.entry_json(p, up, li.note, li.added_at) order by p.name)
      from public.list_items li
      join public.places p on p.id = li.place_id
      left join public.user_places up on up.user_id = l.owner_id and up.place_id = li.place_id
      where li.list_id = l.id
    ), '[]'::jsonb)
  ) into result;
  return result;
end $$;

-- Every place across the caller's lists, once each, with the lists it's in.
create or replace function public.my_places()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(e order by e -> 'place' ->> 'name'), '[]'::jsonb)
  from (
    select public.entry_json(p, up, null, min(li.added_at))
      || jsonb_build_object('lists', jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name) order by l.name)) as e
    from public.lists l
    join public.list_items li on li.list_id = l.id
    join public.places p on p.id = li.place_id
    left join public.user_places up on up.user_id = l.owner_id and up.place_id = p.id
    where l.owner_id = auth.uid()
    group by p.id, up.user_id, up.place_id
  ) s
$$;

revoke execute on function public.get_list(uuid, text) from public;
grant execute on function public.get_list(uuid, text) to anon, authenticated;
revoke execute on function public.my_places() from public, anon;
grant execute on function public.my_places() to authenticated;
