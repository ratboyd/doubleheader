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
- NY/LA city matching via metro aliases
- AI narrative blurbs via narrative.js + Netlify function
- PWA manifest + service worker

## Current Bugs to Fix

### 1. Mobile nav bar - Clear and Login buttons not visible on phone
On mobile the top-right nav buttons (Clear, Login/account) are hidden or cut off.
Fix: use relative/percentage sizing instead of fixed pixel widths in the nav CSS.
The nav is .nav in the CSS - check for fixed px widths and convert to relative units.

### 2. By City tab shows no results even when matches exist
The By City tab appears empty even when Best Matches has results.
This is a bug in the tab filtering/rendering logic - needs investigation and fix.

### 3. Doubleheader+ stat shows 0 for everyone
The stats bar shows: matching trips / primary overlaps / doubleheader+ / cities in play.
Nobody ever gets a Doubleheader+ score. Either wire it up properly or remove it to avoid confusion.

## Data Sources
- Primary: Ticketmaster API
- Missing: SeatGeek API (see affiliate section below - HIGH PRIORITY)
- Missing: Bandsintown or Songkick for better artist coverage (future)

## Affiliate Revenue - High Priority

### SeatGeek Affiliate Program
SeatGeek runs affiliates through Impact.com. Example affiliate URL:
https://seatgeek.com/candlelight-coldplay-and-imagine-dragons-tickets/fort-worth-texas-fort-worth-botanic-garden-2026-07-23-8-45-pm/concert/18249741?irclickid=11lS0K1XUxyZWzf3FvzOjUCCUkuRRd1i3WBX2g0&utm_source=impact&utm_medium=affiliate&utm_campaign=Songkick&utm_term=1234554&utm_content=&pid=Songkick&aid=16137&adid=1234554&irgwc=1&afsrc=1

Key insight: This Coldplay/Imagine Dragons candlelight event in Fort Worth TX (Jul 23 2026) is a perfect example of what doubleheader should surface. It is the kind of intimate/independent venue event that Ticketmaster does not carry. A user who follows Coldplay and the Dallas Stars would get a high-scoring Double card from this. SeatGeek covers these events much better than Ticketmaster.

Action needed:
1. Add SeatGeek as a second event data source alongside Ticketmaster
2. Wire affiliate tracking into SeatGeek ticket links once Impact affiliate account is approved
3. Owner has Impact.com account under boyd.pat@gmail.com - marketplace access pending traffic threshold

### Ticketmaster Affiliate
Also runs through Impact - same account. Wire tracking once approved.

## Product Feedback from Technical Advisor
- Sorting logic not obvious to users - consider tooltip on the Best overlap first dropdown
- Data source transparency - users curious where data comes from, consider a small About or FAQ
- PWA install prompt - consider adding Add to Home Screen nudge for mobile users
- Focus on user retention before monetization - get traffic first

## Analytics
- Cloudflare Web Analytics: active, auto-injected via CF proxy (no script tag in HTML)
- Site token: cfdfdc2ea33b47188b0b07844832e126 (needed for CF API integrations only)
- Mode: EU visitor data excluded (privacy-friendly, no cookie banner needed)
- Netlify Analytics: available as $9/mo add-on (not currently enabled)

## Owner Context
Patrick Boyd, Calgary AB. Non-technical founder. Between roles (energy industry).
Contact: hello@doubleheader.app (Cloudflare email routing to boyd.pat@gmail.com)
Impact.com account: boyd.pat@gmail.com (Partner, marketplace pending approval)
