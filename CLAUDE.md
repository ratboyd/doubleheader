# Doubleheader.app — Claude Code Briefing

## What is this?
doubleheader.app is a travel + events matching web app. Users enter a home city, cities they'd travel to, artists they follow, and sports teams — then hit "Find Matches" to get weekend trip recommendations where multiple events overlap (e.g. Bryan Adams + an MLB game in the same city on the same weekend).

Cards are scored and labelled: Single (1 event), Double (2), Triple (3), Grand Slam (4+).

## Stack
- Frontend: Single HTML file — public/index.html (~1400 lines, minified JS inline)
- Hosting: Netlify (site: stellular-centaur-f0a42b, auto-deploys from GitHub main)
- Repo: https://github.com/ratboyd/doubleheader
- Auth + DB: Supabase (project: govcexcjxbkshsnsrnqf)
- Separate files: public/narrative.js, public/manifest.json, public/sw.js, netlify/functions/narrative.js

## Known bugs to fix (priority order)

### 1. Gobbledygook characters
Several characters render incorrectly:
- The x (times/close) symbol on pill remove buttons renders as corrupt characters
- The warning emoji in the "No matches in: X" banner is broken
- Various dashes and arrows scattered in the page are corrupted

Root cause: Multiple API patch commits corrupted UTF-8 multi-byte sequences inside JS string literals.
Fix: Read the file, find all non-ASCII characters in JS string contexts, replace with HTML entities or Unicode escapes.

### 2. New York / Los Angeles return no results
When user adds "New York" or "Los Angeles" as travel cities, zero results come back.

Root cause: Ticketmaster data uses venue cities like "Newark", "Wantagh", "East Hartford" for NY-area shows, and "Inglewood", "Anaheim" for LA-area shows. The city name "New York" never appears in the event data.

The cityList construction is around line 850 in index.html. Look for cityList=cities.concat(...) followed by a for loop that calls the concerts API per city.

Fix: Before the for loop, expand cityList with metro aliases:
var METRO_ALIASES = {
  "New York": ["Newark", "Wantagh", "East Hartford", "Uncasville"],
  "Los Angeles": ["Inglewood", "Anaheim", "Carson", "Roseville"],
  "Chicago": ["Milwaukee", "Rosemont"],
  "San Francisco": ["Oakland", "San Jose", "Sacramento"],
  "Washington": ["Baltimore", "Norfolk"]
};
Also ensure the for loop limit is at least 20.

### 3. AI narrative not auto-firing reliably
narrative.js loads and functions exist but the setInterval polling approach is unreliable.
Better approach: hook into wherever results are written to window.cached.

### 4. MLS data not showing
Adding MLS as a league returns no results. Check what sports data sources are configured.

## What NOT to do
- Do not rewrite index.html from scratch
- Do not use btoa/TextEncoder to patch files via GitHub API — that caused the encoding corruption
- Edit files directly on disk

## Owner context
Patrick Boyd, Calgary AB. Non-technical founder. Be direct, fix things properly, test before committing.