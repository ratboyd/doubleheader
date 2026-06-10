# Doubleheader.app — Claude Code Briefing (Updated)

## Stack
- Frontend: public/index.html (~1400 lines, minified JS inline)
- Hosting: Netlify (stellular-centaur-f0a42b, auto-deploys from GitHub main)
- Repo: https://github.com/ratboyd/doubleheader
- Auth + DB: Supabase (project: govcexcjxbkshsnsrnqf)
- Separate files: public/narrative.js, public/manifest.json, public/sw.js, netlify/functions/narrative.js, netlify/functions/send-digest.js, netlify/functions/alerts.js, public/seatgeek.js

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
- Daily emails flagging old games as new — fixed inconsistent dedup key between site and cron paths; seen_events now keyed consistently by event ID

## Session Instructions
You are acting as a senior web developer doing a full bug audit and revenue plumbing pass on doubleheader.app. Read this file and the full codebase before touching anything. Fix and implement everything below in order. Commit after each item with a clear message.

## Current Tasks

### 1. Wire affiliate tracking into on-site ticket links (HIGH PRIORITY — revenue)
The send-digest.js email function already appends impactid=7318540 to Ticketmaster URLs, but the result cards on the website link out raw. This is leaking the highest-volume affiliate opportunity — on-site clicks are far more frequent than email clicks.

Fix:
- Create a single affiliateUrl(url) helper function used everywhere outbound links are generated
- Apply it to every ticket link on result cards in the UI (Ticketmaster and SeatGeek)
- Apply it in email paths too if not already consistent
- Impact publisher ID: 7318540
- Do not hardcode the affiliate ID in multiple places — one helper, one source of truth

Test: click a ticket link from a result card and confirm the URL contains the Impact affiliate parameter.

### 2. Add SeatGeek affiliate ID (HIGH PRIORITY — revenue)
seatgeek.js is already coded to append the Impact affiliate suffix but needs the env var wired up.

- The env var name is SEATGEEK_AFFILIATE_ID — confirm this is set in Netlify env (owner can add it once Impact marketplace access is approved)
- Ensure seatgeek.js reads from this env var and applies it to all outbound SeatGeek links consistently via the same affiliateUrl() helper from task 1
- Note: Impact marketplace access is pending traffic threshold — placeholder the ID cleanly so it activates the moment the var is set

### 3. Add hotel and flight affiliate links to trip cards
The email digest already generates Skyscanner flight links per trip. Travel affiliates (Skyscanner, Booking.com, Expedia) pay more per conversion than ticket affiliates and are a natural fit for the trip-planning use case.

- Add a hotel affiliate link alongside the flight link on each trip card, both in the email digest and on the site
- Use Booking.com or Expedia affiliate links (owner to confirm which program; placeholder cleanly)
- Keep the UI clean — one flight link, one hotel link per card, not a wall of links

### 4. Instrument outbound click tracking
Cloudflare Web Analytics is already injected. Before chasing volume, instrument click events so Impact can see real outbound traffic (which gates marketplace approval) and so we can learn which categories convert.

- Fire a custom CF analytics event on every outbound ticket, flight, and hotel click
- Event should include: type (ticket/flight/hotel), source (ticketmaster/seatgeek/skyscanner/booking), city, and event category (sport/music/comedy)
- This data is what unlocks affiliate approval and informs everything after

### 5. Metro geo-clustering — Anaheim and other suburbs leaking out
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

Any venue within a defined metro radius displays under the metro label only. Underlying venue data is preserved — display label only changes.

### 6. MLB classification — non-game events leaking into results
Stadium tours, pregame experiences, and concert events at sports venues are being classified as MLB games. Example: Bronx/Yankees card shows tour products alongside the actual Yankees-Red Sox game, inflating the score.

Fix:
- Filter Ticketmaster sports queries by classificationName=Sports and appropriate subGenreName (Baseball, Hockey, etc.)
- Cross-check matched attraction is the actual team, not a stadium experience product
- Exclude events where title does not contain team name or known opponent pattern
- Do not rely solely on venue name to infer sport type

Test against: Blue Jays, Yankees, Dodgers, Cubs.

### 7. Date range picker
Add user control over the search window.

- Three preset buttons: Next 2 Weeks, Next Month, Next 3 Months
- Dual-handle range slider for custom selection, with live date labels
- Persists to Supabase user preferences
- Gates all Ticketmaster and sports API queries

Lightweight implementation only — noUiSlider or custom CSS/JS. No heavy dependencies.

### 8. Comedy as a category
- Add Comedy toggle to preference UI, same style as existing toggles
- Query Ticketmaster using classificationName=Arts & Theatre + subGenreName=Comedy (verify exact string against TM API docs)
- Comedy events pair with sports and music in scoring logic
- Save to Supabase preferences
- Distinct icon/label on card

### 9. AI narrative enrichment with city context
- Build cityContext.js seed file with flavour blocks for: Los Angeles, New York, Chicago, Toronto (stubs for others)
- Each block: venue/neighbourhood personality, cultural notes, 2-3 activity pairings
- Inject relevant block into Anthropic API system prompt when narrative fires
- Fall back to generic prompt if no context exists for that metro
- No external scraping — all content hand-authored

## Pending Manual Step (owner action required)
Run the following in the Supabase SQL editor before next deploy (adds columns needed for city/comedy/date preferences to persist):

ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS comedy boolean DEFAULT false;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS date_start date;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS date_end date;

## Data Sources
- Primary: Ticketmaster API
- Secondary: SeatGeek (seatgeek.js — live, affiliate ID pending)
- Future: Bandsintown or Songkick for broader artist coverage

## Affiliate Revenue Status
- Impact publisher ID: 7318540 (boyd.pat@gmail.com)
- Ticketmaster affiliate: Impact — pending marketplace approval
- SeatGeek affiliate: Impact — pending marketplace approval (SEATGEEK_AFFILIATE_ID env var ready to set)
- Travel affiliates: Skyscanner links in digest — formal affiliate program not yet enrolled
- Marketplace approval gated on traffic threshold — click instrumentation (task 4) is what unlocks this

## Analytics
- Cloudflare Web Analytics: active, auto-injected via CF proxy (no script tag in HTML)
- Site token: cfdfdc2ea33b47188b0b07844832e126
- EU visitor data excluded — no cookie banner needed
- Netlify Analytics: available as $9/mo add-on (not enabled)

## Product Backlog (do not action this sprint)
- Sorting tooltip on Best overlap first dropdown
- About / FAQ page for data source transparency
- PWA Add to Home Screen nudge
- League browsing / casual fan mode
- Paid tier (hold until traffic justifies gating the digest)

## Owner Context
Patrick Boyd, Calgary AB. Non-technical founder. Between roles (energy industry).
Contact: hello@doubleheader.app (Cloudflare email routing to boyd.pat@gmail.com)
Impact.com account: boyd.pat@gmail.com (Partner, marketplace pending approval)