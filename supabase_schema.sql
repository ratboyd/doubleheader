-- Doubleheader Supabase schema
-- Run once in the Supabase SQL editor

create table if not exists public.user_preferences (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  home_city     text,
  travel_cities text[]  default '{}',
  artists       text[]  default '{}',
  teams         text[]  default '{}',
  genres        text[]  default '{}',
  leagues       text[]  default '{}',
  comedy        boolean default false,
  date_start    date,
  date_end      date,
  updated_at    timestamptz default now(),
  unique(user_id)
);

-- Migration for existing databases (the columns above were added after launch).
-- The frontend's savePreferences() writes comedy/date_start/date_end on every save;
-- if these columns are absent, PostgREST rejects the WHOLE upsert and NOTHING
-- persists — not even home_city/travel_cities. Run once; safe to re-run.
alter table public.user_preferences add column if not exists comedy     boolean default false;
alter table public.user_preferences add column if not exists date_start date;
alter table public.user_preferences add column if not exists date_end   date;

create table if not exists public.seen_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  tm_event_id  text not null,
  event_city   text,
  event_name   text,
  alerted_at   timestamptz default now(),
  unique(user_id, tm_event_id)
);

alter table public.user_preferences enable row level security;
alter table public.seen_events enable row level security;

create policy "Users manage own preferences"
  on public.user_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users read own seen_events"
  on public.seen_events for select
  using (auth.uid() = user_id);

create index if not exists idx_prefs_home_city     on public.user_preferences(home_city);
create index if not exists idx_prefs_travel_cities  on public.user_preferences using gin(travel_cities);
create index if not exists idx_seen_events_user     on public.seen_events(user_id, tm_event_id);

-- Allow service role (used by Netlify functions) to insert seen_events
create policy "Service role manages seen_events"
  on public.seen_events for all
  using (true)
  with check (true);

-- Outbound click tracking (ticket / flight / hotel links) — written by the
-- /api/track Netlify function with the service role. RLS is enabled with NO
-- public policies on purpose: the service role bypasses RLS, and the anon key
-- gets nothing. (Do NOT copy the seen_events using(true) pattern above — that
-- policy applies to every role and exposes the table to the public anon key.)
create table if not exists public.outbound_clicks (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,   -- ticket | flight | hotel
  domain     text,            -- destination hostname (ticketmaster.com, booking.com, ...)
  city       text,            -- trip card city the click came from
  clicked_at timestamptz default now()
);
alter table public.outbound_clicks enable row level security;
create index if not exists idx_outbound_clicks_at on public.outbound_clicks(clicked_at);
