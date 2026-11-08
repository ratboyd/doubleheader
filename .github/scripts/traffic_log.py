#!/usr/bin/env python3
"""
Daily traffic log for doubleheader.app — runs from GitHub Actions.

Cloudflare Web Analytics (free) only shows the last 30 days in its dashboard,
so history before that is invisible. This script pulls daily totals from
Cloudflare's GraphQL Analytics API and appends them to traffic.csv (kept on the
`traffic-data` branch), so a lifetime record builds up from here on.

  usage: traffic_log.py <path/to/traffic.csv>
  env:   CF_API_TOKEN   — Cloudflare API token with "Account Analytics: Read"
         CF_ACCOUNT_ID  — optional; defaults to the doubleheader account

First run (empty CSV) asks for history back to SITE_START and keeps whatever
Cloudflare still retains. Later runs re-fetch the last 7 days (late-arriving
data gets corrected) and add yesterday. Today is never written — it's partial.

Counts exclude bots (same as the dashboard's "Exclude bots: Yes"). The account
has a single Web Analytics site (doubleheader.app), so account-level totals are
the site's totals.
"""
import csv, datetime as dt, json, os, subprocess, sys

ACCOUNT = os.environ.get("CF_ACCOUNT_ID", "790775c182e1b089a83bd5fa192f0fc9")
TOKEN = os.environ.get("CF_API_TOKEN", "")
SITE_START = dt.date(2026, 4, 1)
API = "https://api.cloudflare.com/client/v4/graphql"

QUERY = """
query ($acct: string!, $start: Date!, $end: Date!) {
  viewer { accounts(filter: {accountTag: $acct}) {
    rumPageloadEventsAdaptiveGroups(
      limit: 10000, orderBy: [date_ASC],
      filter: { date_geq: $start, date_leq: $end, bot: 0 }
    ) {
      count
      sum { visits }
      dimensions { date }
    }
  } }
}
"""


def gql(start, end):
    body = json.dumps({"query": QUERY, "variables": {"acct": ACCOUNT, "start": str(start), "end": str(end)}})
    out = subprocess.run(
        ["curl", "-s", "--max-time", "60", API,
         "-H", "Authorization: Bearer " + TOKEN, "-H", "Content-Type: application/json",
         "--data-binary", "@-"],
        input=body, capture_output=True, text=True, encoding="utf-8")
    try:
        j = json.loads(out.stdout)
    except ValueError:
        return None, "non-JSON response: " + out.stdout[:200]
    if j.get("errors"):
        return None, "; ".join(e.get("message", str(e)) for e in j["errors"])[:400]
    try:
        rows = j["data"]["viewer"]["accounts"][0]["rumPageloadEventsAdaptiveGroups"]
    except (KeyError, IndexError, TypeError):
        return None, "unexpected response shape: " + out.stdout[:200]
    return {r["dimensions"]["date"]: (int(r["sum"]["visits"]), int(r["count"])) for r in rows}, None


def load(path):
    if not os.path.exists(path):
        return {}
    with open(path, newline="", encoding="utf-8") as f:
        return {r["date"]: (int(r["visits"]), int(r["pageviews"])) for r in csv.DictReader(f)}


def save(path, data):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["date", "visits", "pageviews"])
        for d in sorted(data):
            w.writerow([d, *data[d]])


def summary(data):
    days = sorted(data)
    if not days:
        return "No traffic data yet."
    def tot(n):
        cutoff = str(dt.date.fromisoformat(days[-1]) - dt.timedelta(days=n - 1))
        return sum(data[d][0] for d in days if d >= cutoff), sum(data[d][1] for d in days if d >= cutoff)
    v7, p7 = tot(7); v30, p30 = tot(30)
    vl, pl = sum(v for v, _ in data.values()), sum(p for _, p in data.values())
    return ("| Window | Visits | Page views |\n|---|---|---|\n"
            f"| Yesterday ({days[-1]}) | {data[days[-1]][0]} | {data[days[-1]][1]} |\n"
            f"| Last 7 days | {v7} | {p7} |\n| Last 30 days | {v30} | {p30} |\n"
            f"| Since {days[0]} | {vl} | {pl} |\n")


def main(path):
    if not TOKEN:
        print("::error::CF_API_TOKEN is not set"); return 1
    data = load(path)
    end = dt.date.today() - dt.timedelta(days=1)            # yesterday (UTC); today is partial
    start = (dt.date.fromisoformat(max(data)) - dt.timedelta(days=6)) if data else SITE_START

    fetched, err = gql(start, end)
    if err and not data:
        # Long first-run window rejected? Fall back to the 30 days the dashboard shows.
        print(f"::warning::history back to {start} not available ({err}); retrying last 30 days")
        start = end - dt.timedelta(days=29)
        fetched, err = gql(start, end)
    if err:
        print(f"::error::Cloudflare analytics query failed: {err}"); return 1

    # Days with no visits come back as no row — record them as zero, but only from
    # the first day Cloudflare actually has data (earlier = unknown, not zero).
    first = min(fetched) if fetched else None
    if data:
        first = str(start)
    if first:
        d = dt.date.fromisoformat(first)
        while d <= end:
            data[str(d)] = fetched.get(str(d), (0, 0))
            d += dt.timedelta(days=1)
    save(path, data)

    text = summary(data)
    print(text)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write("## doubleheader.app traffic (bots excluded)\n\n" + text +
                    "\nFull history: `traffic.csv` on the `traffic-data` branch.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "traffic.csv"))
