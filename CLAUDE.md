# Doubleheader.app — Claude Code Briefing (Updated)

## Stack
- Frontend: public/index.html (~1400 lines, minified JS inline)
- Hosting: Netlify (stellular-centaur-f0a42b, auto-deploys from GitHub main)
- Repo: https://github.com/ratboyd/doubleheader
- Auth + DB: Supabase (project: govcexcjxbkshsnsrnqf)
- Separate files: public/narrative.js, public/manifest.json, public/sw.js, netlify/functions/narrative.js

## Already Fixed (do not revisit)
- Double/Triple/Grand Slam card labels correct
- Gobbledygook characters on remove buttons and notice banner
- NY/LA city matching via metro aliases (partial — see Metro Clustering bug below)
- AI narrative blurbs via narrative.js + Netlify function
- PWA manifest + service worker
- Mobile nav bar — Clear and Login buttons now visible on mobile
- By City tab — results now rendering correctly
- Doubleheader+ stat — now displaying correct count in stats bar

## Current Bugs to Fix

### 1. MLB classification — non-game events leaking into results (HIGH PRIORITY)
Stadium tours, pregame experiences, and concert events at sports venues are being classified as MLB games and scored accordingly. Live example confirmed: the Bronx/Yankees card shows "Classic Tour at Yankee Stadium", "Yankee Stadium Premium Pregame Tour", and "Pregame Glimpse of Greatness" all labeled as MLB games alongside the actual Yankees-Red Sox game — inflating it to a Double when it should be a Single.

Fix:
- When querying Ticketmaster for sports events, filter by classificationName=Sports and the appropriate subGenreName (e.g. Baseball for MLB, Hockey for NHL)
- Cross-check that the matched attraction is the actual team, not a touring act or stadium experience product
- If the event title does not contain the team name or a known opponent pattern, flag as low-confidence and exclude from scoring
- Do not rely solely on venue name to infer sport type

Test against: Blue Jays, Yankees, Dodgers, Cubs. Confirm only actual scheduled games are returned.

### 2. Metro geo-clustering — Anaheim and other suburbs leaking out (HIGH PRIORITY)
Venues in the same metro area are appearing as separate city cards. Confirmed live: Anaheim is showing as its own card (Angels games at Angel Stadium) separate from Los Angeles, despite being inside the LA metro. The existing LA alias logic is not covering Angel Stadium.

Fix using lat/long + radius approach. Ensure the following metros resolve to a single display label:

- **Los Angeles** — radius ~80km center: 34.0522, -118.2437 (must capture: Pasadena, Anaheim, Long Beach, Inglewood, Carson, Glendale)
- **New York City** — radius ~60km center: 40.7128, -74.0060 (must capture: Newark, East Rutherford, Brooklyn, Queens, Bronx — note current "Bronx" and "Flushing" cards should roll up to NYC)
- **Dallas / Fort Worth** — treat as one metro
- **Minneapolis / St. Paul** — treat as one metro
- **San Francisco / Bay Area** — radius ~70km (captures Oakland, San Jose, Santa Clara)
- **Miami** — radius ~60km (captures Fort Lauderdale, Miami Gardens)
- **Washington DC** — radius ~60km (captures Northern Virginia, Maryland suburbs)
- **Chicago** — radius ~60km (captures Rosemont)

Any venue within a defined metro radius displays under the metro label only. Underlying venue data is preserved — display label only changes.

### 3. Date range picker
Users need control over the search window. Currently fixed forward-looking.

Add:
- Three preset buttons: **Next 2 Weeks**, **Next Month**, **Next 3 Months**
- A dual-handle range slider for custom date selection, with start/end date labels updating live
- Selected range persists to Supabase user preferences
- Range gates all Ticketmaster and sports API queries

Use a lightweight implementation — noUiSlider or simple custom CSS/JS. No heavy dependencies.

### 4. Comedy as a category
Add Comedy as a first-class event category alongside Music and Sports.

- Add Comedy toggle to user preference UI, same style as existing toggles
- Query Ticketmaster using classificationName=Arts & Theatre + subGenreName=Comedy (verify exact classification string against TM API docs)
- Comedy events eligible for Doubleheader pairing with sports and music — treat same as Artist events in scoring logic
- Save Comedy preference to Supabase alongside existing preferences
- Comedy events get a distinct icon/label on the card (not the same as Music)

### 5. AI narrative enrichment with city context
Current narrative blurbs are generic. Elevate by injecting city-specific context into the Anthropic API prompt.

Build a city context seed file (cityContext.js or JSON config) with flavour blocks for key metros. Start with: Los Angeles, New York, Chicago, Toronto. Add others as stubs. Each block includes:
- Neighbourhood/venue personality notes
- What the city is known for culturally
- 2-3 suggested activity pairings relevant to that city

When narrative function fires, detect metro from event data and inject the relevant city context block into the system prompt. Fall back to current generic prompt if no city context exists for that metro.

Do not scrape external sites. All city context hand-authored in seed file.

## Data Sources
- Primary: Ticketmaster API
- Missing: SeatGeek API (see affiliate section below — HIGH PRIORITY)
- Missing: Bandsintown or Songkick for better artist coverage (future)

## Affiliate Revenue — High Priority

### SeatGeek Affiliate Program
SeatGeek runs affiliates through Impact.com. Example affiliate URL:
https://seatgeek.com/candlelight-coldplay-and-imagine-dragons-tickets/fort-worth-texas-fort-worth-botanic-garden-2026-07-23-8-45-pm/concert/18249741?irclickid=11lS0K1XUxyZWzf3FvzOjUCCUkuRRd1i3WBX2g0&utm_source=impact&utm_medium=affiliate&utm_campaign=Songkick&utm_term=1234554&utm_content=&pid=Songkick&aid=16137&adid=1234554&irgwc=1&afsrc=1

Key insight: The Coldplay/Imagine Dragons candlelight event in Fort Worth TX (Jul 23 2026) is exactly the kind of intimate/independent venue event Ticketmaster does not carry. A user following Coldplay and the Dallas Stars would get a high-scoring Double card. SeatGeek covers these events much better than Ticketmaster.

Action needed:
1. Add SeatGeek as a second event data source alongside Ticketmaster
2. Wire affiliate tracking into SeatGeek ticket links once Impact affiliate account is approved
3. Owner has Impact.com account under boyd.pat@gmail.com — marketplace access pending traffic threshold

### Ticketmaster Affiliate
Also runs through Impact — same account. Wire tracking once approved.

## Product Feedback (backlog — do not action this sprint)
- Sorting logic not obvious to users — consider tooltip on the "Best overlap first" dropdown
- Data source transparency — users curious where data comes from, consider a small About or FAQ
- PWA install prompt — consider adding Add to Home Screen nudge for mobile users
- Focus on user retention before monetization — get traffic first
- League browsing / casual fan mode (weight a whole league rather than a specific team) — logged for future sprint, do not implement yet

## Analytics
- Cloudflare Web Analytics: active, auto-injected via CF proxy (no script tag in HTML)
- Site token: cfdfdc2ea33b47188b0b07844832e126 (needed for CF API integrations only)
- Mode: EU visitor data excluded (privacy-friendly, no cookie banner needed)
- Netlify Analytics: available as $9/mo add-on (not currently enabled)

## Owner Context
Patrick Boyd, Calgary AB. Non-technical founder. Between roles (energy industry).
Contact: hello@doubleheader.app (Cloudflare email routing to boyd.pat@gmail.com)
Impact.com account: boyd.pat@gmail.com (Partner, marketplace pending approval)