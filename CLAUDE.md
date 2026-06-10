# Doubleheader.app — Claude Code Briefing (Updated)

## Stack
- Frontend: public/index.html (~1400 lines, minified JS inline)
- Hosting: Netlify (stellular-centaur-f0a42b, auto-deploys from GitHub main)
- Repo: https://github.com/ratboyd/doubleheader
- Auth + DB: Supabase (project: govcexcjxbkshsnsrnqf)
- Separate files: public/narrative.js, public/manifest.json, public/sw.js, netlify/functions/narrative.js, netlify/functions/send-digest.js, netlify/functions/alerts.js, netlify/functions/track.js, public/seatgeek.js

## Already Fixed (do not revisit)
- Double/Triple/Grand Slam card labels correct
- Gobbledygook characters on remove buttons and notice banner
- NY/LA city matching via metro aliases (partial — see Metro Clustering task below)
- AI narrative blurbs via narrative.js + Netlify function
- PWA manifest + service worker
- Mobile nav bar — Clear and Login buttons now visible on mobile
- By City tab — results now rendering correctly
- Doubleheader+ stat — now displaying correct count in stats bar
- City preferences not persisting — fixed silent Supabase upsert failure (missing columns); migration in supabase_schema.sql
- Houston MLB game count — fixed home-city truncation bug; now returns full slate of upcoming home games
- Daily emails flagging old games as new — fixed inconsistent dedup key between site and cron paths
- affiliateUrl() helper — single domain-routing helper with AFFIL config; covers TM and SeatGeek; idempotent; hostname regex prevents lookalike tagging
- SeatGeek affiliate hardening — params now merge via URL API; afsrc=1 added; README documents all 10 env vars
- Hotel + flight links — Booking.com hotel links on all non-home-city cards and in email digest; Skyscanner links accept mediaPartnerId; two latent emailMyMatches() crashes fixed
- Outbound click tracking — clicks fire zaraz.track (if Zaraz enabled) and POST to /api/track; stored in outbound_clicks Supabase table; RLS locked down

## Pending Manual Steps (owner action required)
Run both blocks in the Supabase SQL editor before next deploy:

1. user_preferences migration (from bug session):
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS comedy boolean DEFAULT false;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS date_start date;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS date_end date;

2. outbound_clicks table (from affiliate session):
See create table public.outbound_clicks block at bottom of supabase_schema.sql

## Affiliate Activation Checklist (flip when programs approve)
- SeatGeek: set SEATGEEK_AFFILIATE_ID env var in Netlify
- Skyscanner: set AFFIL.skyscannerPartnerId in index.html + SKYSCANNER_PARTNER_ID env var
- Booking.com: set AFFIL.bookingAid in index.html + BOOKING_AFFILIATE_AID env var
- Impact publisher ID: 7318540 (boyd.pat@gmail.com) — marketplace approval gated on traffic threshold

## Session Instructions
You are acting as a senior web developer doing a full audit of doubleheader.app. Read this file and the full codebase before touching anything. Fix and implement everything below in order. Commit after each item with a clear message.

## Current Tasks

### 1. Fix seen_events public RLS hole (HIGH PRIORITY — security)
The seen_events table has a using(true) with check(true) policy under the service role, but confirm there is no public/anon read or write access. The outbound_clicks table from the last session was locked down correctly — seen_events should match that standard. Audit all RLS policies on seen_events and tighten any that allow unauthenticated access.

### 2. Metro geo-clustering — Anaheim and other suburbs leaking out
Venues in the same metro area are appearing as separate city cards. Confirmed live: Anaheim is showing as its own card (Angels games at Angel Stadium) separate from Los Angeles.

Fix using lat/long + radius approach. Ensure the following metros resolve to a single display label:
- Los Angeles — radius ~80km center: 34.0522, -118.2437 (must capture: Pasadena, Anaheim, Long Beach, Inglewood, Carson, Glendale)
- New York City — radius ~60km center: 40.7128, -74.0060 (must capture: Newark, East Rutherford, Brooklyn, Queens, Bronx, Flushing)
- Dallas / Fort Worth — treat as one metro
- Minneapolis / St. Paul — treat as one metro
- San Francisco / Bay Area — radius ~70km (captures Oakland, San Jose, Santa Clara)
- Miami — radius ~60km (captures Fort Lauderdale, Miami Gardens)
- Washington DC — radius ~60km (captures Northern Virginia, Maryland suburbs)
- Chicago — radius ~60km (captures Rosemont)

Any venue within a defined metro radius displays under the metro label only. Underlying venue data preserved — display label only changes.

### 3. MLB classification — non-game events leaking into results
Stadium tours, pregame experiences, and concert events at sports venues are being classified as MLB games. Example: Bronx/Yankees card shows tour products alongside the actual game, inflating the score.

Fix:
- Filter Ticketmaster sports queries by classificationName=Sports and appropriate subGenreName (Baseball, Hockey, etc.)
- Cross-check matched attraction is the actual team, not a stadium experience product
- Exclude events where title does not contain team name or known opponent pattern
- Do not rely solely on venue name to infer sport type

Test against: Blue Jays, Yankees, Dodgers, Cubs.

### 4. Date range picker
Add user control over the search window.

- Three preset buttons: Next 2 Weeks, Next Month, Next 3 Months
- Dual-handle range slider for custom selection, with live date labels
- Persists to Supabase user preferences
- Gates all Ticketmaster and sports API queries

Lightweight implementation only — noUiSlider or custom CSS/JS. No heavy dependencies.

### 5. Comedy as a category
- Add Comedy toggle to preference UI, same style as existing toggles
- Query Ticketmaster using classificationName=Arts & Theatre + subGenreName=Comedy (verify exact string against TM API docs)
- Comedy events pair with sports and music in scoring logic
- Save to Supabase preferences
- Distinct icon/label on card

### 6. AI narrative enrichment with city context
- Build cityContext.js seed file with flavour blocks for: Los Angeles, New York, Chicago, Toronto (stubs for others)
- Each block: venue/neighbourhood personality, cultural notes, 2-3 activity pairings
- Inject relevant block into Anthropic API system prompt when narrative fires
- Fall back to generic prompt if no context exists for that metro
- No external scraping — all content hand-authored

## Data Sources
- Primary: Ticketmaster API
- Secondary: SeatGeek (seatgeek.js — live, affiliate ID pending env var)
- Future: Bandsintown or Songkick for broader artist coverage

## Analytics
- Cloudflare Web Analytics: active, auto-injected via CF proxy (no script tag in HTML)
- Site token: cfdfdc2ea33b47188b0b07844832e126
- outbound_clicks table in Supabase: click-through source of truth for Impact approval
- EU visitor data excluded — no cookie banner needed
- Netlify Analytics: available as $9/mo add-on (not enabled)

## Product Backlog (do not action this sprint)
- Sorting tooltip on Best overlap first dropdown
- About / FAQ page for data source transparency
- PWA Add to Home Screen nudge
- League browsing / casual fan mode
- Expedia/hotel A-B test once click data accumulates
- Paid tier (hold until traffic justifies gating the digest)

## Owner Context
Patrick Boyd, Calgary AB. Non-technical founder. Between roles (energy industry).
Contact: hello@doubleheader.app (Cloudflare email routing to boyd.pat@gmail.com)
Impact.com account: boyd.pat@gmail.com (Partner, marketplace pending approval)