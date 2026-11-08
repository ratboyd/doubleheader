#!/usr/bin/env python3
"""
Daily health check for doubleheader.app — runs from GitHub Actions.

Catches the failure classes that bit us silently in 2026:
  * A league's broad search returning ZERO (stale Ticketmaster subGenreIds).
  * A league's broad search dropping SOME games (bare "v" titles filtered out
    as "non-games": 0 of 32 Avalanche home games, ~half of the Nuggets').
  * Stadium tours / pregame experiences leaking back in as "games".
  * Ticketmaster key / API / functions broken (everything returns nothing).
  * Netlify deploys failing (old code keeps serving, so nothing else changes —
    every deploy failed for ~2 months before anyone noticed).

How a league is judged: for a few teams, compare two independent code paths
for that team's HOME games — the team search (which powers saved teams and has
never broken) vs. the broad league search for the venue city (which broke three
times). Both zero = off-season / tickets not on sale yet -> nothing to compare,
not a failure. League path well below team path -> bug.

Exit code 1 on any failure, so GitHub emails the repo owner.
Run with --selftest to replay the historical bugs through the evaluator.
"""
import json, os, re, subprocess, sys, time, urllib.parse

SITE = "https://doubleheader.app"
NETLIFY_SITE_ID = "a95ffff4-a545-4cdd-8c61-fb72e4c153b7"
BADGE_SUCCESS_FILL = "#BEF9C6"   # Netlify's light-green "success" deploy badge
RATIO_FLOOR = 0.70               # league path must find >= 70% of team-path home games

# (league, team as typed, TM venue city, keyword in game titles)
# Chosen to cover the quirks that have broken before: bare-"v" titles (Avalanche,
# Nuggets, Dolphins), promo prefixes ("Luxury & Suites:"), suburb venue cities
# (Sunrise, East Rutherford, Arlington, Bronx) and Canadian venues.
PROBES = [
    ("nhl", "Colorado Avalanche", "Denver",          "avalanche"),
    ("nhl", "Vancouver Canucks",  "Vancouver",       "canucks"),
    ("nhl", "Florida Panthers",   "Sunrise",         "panthers"),
    ("nba", "Denver Nuggets",     "Denver",          "nuggets"),
    ("nba", "Toronto Raptors",    "Toronto",         "raptors"),
    ("nba", "Los Angeles Lakers", "Los Angeles",     "lakers"),
    ("nfl", "Miami Dolphins",     "Miami",           "dolphins"),
    ("nfl", "New York Giants",    "East Rutherford", "giants"),
    ("nfl", "Dallas Cowboys",     "Arlington",       "cowboys"),
    ("mlb", "New York Yankees",   "Bronx",           "yankees"),
    ("mlb", "Houston Astros",     "Houston",         "astros"),
    ("mlb", "Toronto Blue Jays",  "Toronto",         "blue jays"),
]

JUNK = re.compile(r"\b(stadium tour|ballpark tour|classic tour|pregame|pre-game|glimpse|hands on history|pinstripe pass)\b", re.I)


def http_get(url):
    """curl rather than urllib: some local Pythons ship an outdated CA bundle."""
    out = subprocess.run(["curl", "-s", "--max-time", "60", url],
                         capture_output=True, text=True, encoding="utf-8")
    return out.stdout


def api(params):
    params = dict(params, cb=str(time.time()))   # bypass Netlify's 1h edge cache
    body = http_get(f"{SITE}/api/concerts?{urllib.parse.urlencode(params)}")
    try:
        return json.loads(body)
    except ValueError:
        return {"error": "non-JSON response: " + body[:120], "events": []}


def evaluate(team_home, league_hits):
    """Pure decision rule — shared by the live run and --selftest."""
    if team_home == 0:
        return "SKIP", "no home games listed on either path (off-season / not on sale yet)"
    if team_home <= 2:
        ok = league_hits >= 1
    else:
        ok = league_hits >= RATIO_FLOOR * team_home
    pct = f"{league_hits}/{team_home}"
    return ("PASS", f"league path found {pct}") if ok else \
           ("FAIL", f"league path found only {pct} of the team's home games")


def check_leagues():
    rows, statuses = [], []
    for league, team, city, kw in PROBES:
        t = api({"team": team})
        time.sleep(1)
        l = api({"league": league, "city": city})
        time.sleep(1)

        errs = [d["error"] for d in (t, l) if d.get("error")]
        if errs:
            status, note = "FAIL", "API error: " + "; ".join(errs)[:140]
        else:
            team_home = sum(1 for e in t.get("events", []) if (e.get("city") or "").lower() == city.lower())
            league_evs = l.get("events", [])
            league_hits = sum(1 for e in league_evs if kw in (e.get("name") or "").lower())
            junk = [e["name"] for e in league_evs if JUNK.search(e.get("name") or "")]
            status, note = evaluate(team_home, league_hits)
            if junk:
                status, note = "FAIL", f"non-game listings leaking in, e.g. {junk[0][:60]!r}"
        statuses.append(status)
        rows.append((status, league.upper(), team, city, note))

    if statuses and all(s == "SKIP" for s in statuses):
        rows.append(("FAIL", "ALL", "-", "-",
                     "every probe returned zero games — Ticketmaster key, API or functions likely broken"))
    return rows


def badge_fill():
    svg = http_get(f"https://api.netlify.com/api/v1/badges/{NETLIFY_SITE_ID}/deploy-status")
    # Status segment = the second filled rect: <path fill="#XXXXXX" d="M63 0h55v20...">
    m = re.findall(r'<path fill="(#[0-9A-Fa-f]{6})" d="M(\d+) 0h', svg)
    segs = [fill for fill, x in m if x != "0"]
    return segs[0].upper() if segs else None


def check_deploy():
    fill = badge_fill()
    if fill == BADGE_SUCCESS_FILL:
        return [("PASS", "DEPLOY", "Netlify", "-", "latest deploy succeeded")]
    # Could just be mid-build when the check runs — give it a few minutes.
    time.sleep(180)
    fill = badge_fill()
    if fill == BADGE_SUCCESS_FILL:
        return [("PASS", "DEPLOY", "Netlify", "-", "latest deploy succeeded (after a wait)")]
    return [("FAIL", "DEPLOY", "Netlify", "-",
             f"deploy badge is not green ({fill}) — check Netlify → Deploys; the live site "
             "is serving OLD code. (If deploys look fine, Netlify may have restyled the badge.)")]


def report(rows):
    lines = ["| Result | League | Team | Venue city | Detail |", "|---|---|---|---|---|"]
    icon = {"PASS": "✅", "SKIP": "⏸️", "FAIL": "❌"}
    for status, lg, team, city, note in rows:
        lines.append(f"| {icon[status]} {status} | {lg} | {team} | {city} | {note} |")
    text = "\n".join(lines)
    print(text)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write("## doubleheader.app daily health check\n\n" + text + "\n")


def selftest():
    """Replay the real 2026 incidents through the decision rule."""
    cases = [
        ("Stale subGenreId (Sep 2026): league search empty",   32,  0, "FAIL"),
        ("Bare-'v' filter (Nov 2026): Avalanche home games",    32,  0, "FAIL"),
        ("Bare-'v' filter (Nov 2026): Nuggets lost ~half",      72, 35, "FAIL"),
        ("Dolphins: few home games left, all dropped",           2,  0, "FAIL"),
        ("Healthy (today's numbers)",                           32, 32, "PASS"),
        ("Small dedup difference between paths",                36, 34, "PASS"),
        ("Off-season: Blue Jays before tickets go on sale",      0,  0, "SKIP"),
    ]
    bad = 0
    for name, team_home, league_hits, expect in cases:
        got, note = evaluate(team_home, league_hits)
        ok = got == expect
        bad += not ok
        print(f"{'ok ' if ok else 'XX '} {got:4}  {name}  ({note})")
    print("\nSELFTEST", "PASSED" if not bad else f"FAILED ({bad})")
    return 0 if not bad else 1


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        sys.exit(selftest())
    rows = check_leagues() + check_deploy()
    report(rows)
    sys.exit(1 if any(r[0] == "FAIL" for r in rows) else 0)
