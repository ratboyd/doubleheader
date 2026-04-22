# Doubleheader

Find weekends where your favourite artists and sports teams are in the same city.

## Project structure

```
doubleheader/
├── public/
│   └── index.html          ← the whole frontend (open this locally to test)
├── netlify/
│   └── functions/
│       ├── concerts.js     ← Ticketmaster API proxy
│       └── sports.js       ← ESPN API proxy (NHL, NBA, NFL, MLB)
├── netlify.toml            ← routing config
├── package.json
└── README.md
```

## Running locally (no API key needed)

Just open `public/index.html` in Chrome. It detects it's running as a
local file and uses the built-in mock dataset. Full autocomplete, matching
engine, and all views work offline.

## Deploying to Netlify (real live data)

### 1. Get a Ticketmaster API key (free)
- Go to https://developer.ticketmaster.com
- Sign up → Create App → copy your **Consumer Key**

### 2. Push to GitHub
```bash
git init
git add .
git commit -m "Doubleheader v1"
gh repo create doubleheader --public --push
```

### 3. Deploy on Netlify
- Go to https://app.netlify.com → "Add new site" → "Import an existing project"
- Connect your GitHub repo
- Build settings are auto-detected from `netlify.toml`
- Click Deploy

### 4. Add your API key
In Netlify Dashboard → Site → Environment variables → Add:
```
TICKETMASTER_KEY = your_consumer_key_here
```

Then trigger a redeploy (Deploys → Trigger deploy).

### 5. Connect a custom domain (optional)
- Buy a domain at Namecheap (~$12/yr)
- Netlify Dashboard → Domain management → Add custom domain
- Follow the DNS instructions (takes ~10 min to propagate)

## How the data works

**Concerts** (`/api/concerts?artist=Bryan+Adams`)
- Calls Ticketmaster Discovery API v2
- Returns all upcoming North American shows for that artist
- Results cached 1hr at the CDN edge

**Sports** (`/api/sports?team=calgary+flames`)
- Calls ESPN's public schedule API (no key required)
- Returns full season schedule for any NHL/NBA/NFL/MLB team
- Includes home AND away games — away games surface when the opponent's
  city matches one of your travel cities

**Local file mode**
- When opened as `file://`, both functions return mock data
- Covers: Bryan Adams, Morgan Wallen, Zach Top, Post Malone + NHL playoff bracket
- Enough to validate the full UX before deploying

## Roadmap

- [ ] Supabase Auth (email + Google login)
- [ ] Save preferences to user account
- [ ] Email alerts when new tour dates match your cities
- [ ] NHL 2026-27 schedule drop notification (fires for all hockey fans simultaneously)
- [ ] Expanded flight routes beyond YYC
- [ ] Mobile app (React Native, same API layer)
