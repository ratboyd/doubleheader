// netlify/functions/sports.js
// Wraps ESPN's public (no-key) sports APIs
// Supports NHL, NBA, NFL, MLB schedules

const LEAGUE_MAP = {
  nhl:  "hockey/nhl",
  nba:  "basketball/nba",
  nfl:  "football/nfl",
  mlb:  "baseball/mlb",
};

// Maps common team names to ESPN team abbreviations
const TEAM_ABBR = {
  // NHL
  "calgary flames":        { league:"nhl", abbr:"CGY" },
  "edmonton oilers":       { league:"nhl", abbr:"EDM" },
  "vancouver canucks":     { league:"nhl", abbr:"VAN" },
  "winnipeg jets":         { league:"nhl", abbr:"WPG" },
  "toronto maple leafs":   { league:"nhl", abbr:"TOR" },
  "ottawa senators":       { league:"nhl", abbr:"OTT" },
  "montreal canadiens":    { league:"nhl", abbr:"MTL" },
  "buffalo sabres":        { league:"nhl", abbr:"BUF" },
  "boston bruins":         { league:"nhl", abbr:"BOS" },
  "detroit red wings":     { league:"nhl", abbr:"DET" },
  "pittsburgh penguins":   { league:"nhl", abbr:"PIT" },
  "philadelphia flyers":   { league:"nhl", abbr:"PHI" },
  "new jersey devils":     { league:"nhl", abbr:"NJD" },
  "new york rangers":      { league:"nhl", abbr:"NYR" },
  "new york islanders":    { league:"nhl", abbr:"NYI" },
  "washington capitals":   { league:"nhl", abbr:"WSH" },
  "carolina hurricanes":   { league:"nhl", abbr:"CAR" },
  "tampa bay lightning":   { league:"nhl", abbr:"TBL" },
  "florida panthers":      { league:"nhl", abbr:"FLA" },
  "nashville predators":   { league:"nhl", abbr:"NSH" },
  "st. louis blues":       { league:"nhl", abbr:"STL" },
  "chicago blackhawks":    { league:"nhl", abbr:"CHI" },
  "minnesota wild":        { league:"nhl", abbr:"MIN" },
  "dallas stars":          { league:"nhl", abbr:"DAL" },
  "colorado avalanche":    { league:"nhl", abbr:"COL" },
  "utah hockey club":      { league:"nhl", abbr:"UTA" },
  "vegas golden knights":  { league:"nhl", abbr:"VGK" },
  "anaheim ducks":         { league:"nhl", abbr:"ANA" },
  "los angeles kings":     { league:"nhl", abbr:"LAK" },
  "seattle kraken":        { league:"nhl", abbr:"SEA" },
  "san jose sharks":       { league:"nhl", abbr:"SJS" },
  "columbus blue jackets": { league:"nhl", abbr:"CBJ" },
  // NBA
  "toronto raptors":       { league:"nba", abbr:"TOR" },
  "boston celtics":        { league:"nba", abbr:"BOS" },
  "philadelphia 76ers":    { league:"nba", abbr:"PHI" },
  "brooklyn nets":         { league:"nba", abbr:"BKN" },
  "new york knicks":       { league:"nba", abbr:"NYK" },
  "miami heat":            { league:"nba", abbr:"MIA" },
  "milwaukee bucks":       { league:"nba", abbr:"MIL" },
  "cleveland cavaliers":   { league:"nba", abbr:"CLE" },
  "indiana pacers":        { league:"nba", abbr:"IND" },
  "chicago bulls":         { league:"nba", abbr:"CHI" },
  "detroit pistons":       { league:"nba", abbr:"DET" },
  "atlanta hawks":         { league:"nba", abbr:"ATL" },
  "charlotte hornets":     { league:"nba", abbr:"CHA" },
  "orlando magic":         { league:"nba", abbr:"ORL" },
  "washington wizards":    { league:"nba", abbr:"WAS" },
  "oklahoma city thunder": { league:"nba", abbr:"OKC" },
  "denver nuggets":        { league:"nba", abbr:"DEN" },
  "minnesota timberwolves":{ league:"nba", abbr:"MIN" },
  "utah jazz":             { league:"nba", abbr:"UTA" },
  "portland trail blazers":{ league:"nba", abbr:"POR" },
  "golden state warriors": { league:"nba", abbr:"GSW" },
  "la clippers":           { league:"nba", abbr:"LAC" },
  "los angeles lakers":    { league:"nba", abbr:"LAL" },
  "phoenix suns":          { league:"nba", abbr:"PHX" },
  "sacramento kings":      { league:"nba", abbr:"SAC" },
  "dallas mavericks":      { league:"nba", abbr:"DAL" },
  "memphis grizzlies":     { league:"nba", abbr:"MEM" },
  "new orleans pelicans":  { league:"nba", abbr:"NOP" },
  "san antonio spurs":     { league:"nba", abbr:"SAS" },
  "houston rockets":       { league:"nba", abbr:"HOU" },
  // NFL
  "kansas city chiefs":    { league:"nfl", abbr:"KC"  },
  "buffalo bills":         { league:"nfl", abbr:"BUF" },
  "new england patriots":  { league:"nfl", abbr:"NE"  },
  "miami dolphins":        { league:"nfl", abbr:"MIA" },
  "new york jets":         { league:"nfl", abbr:"NYJ" },
  "new york giants":       { league:"nfl", abbr:"NYG" },
  "philadelphia eagles":   { league:"nfl", abbr:"PHI" },
  "dallas cowboys":        { league:"nfl", abbr:"DAL" },
  "washington commanders": { league:"nfl", abbr:"WSH" },
  "chicago bears":         { league:"nfl", abbr:"CHI" },
  "detroit lions":         { league:"nfl", abbr:"DET" },
  "green bay packers":     { league:"nfl", abbr:"GB"  },
  "minnesota vikings":     { league:"nfl", abbr:"MIN" },
  "seattle seahawks":      { league:"nfl", abbr:"SEA" },
  "los angeles rams":      { league:"nfl", abbr:"LAR" },
  "san francisco 49ers":   { league:"nfl", abbr:"SF"  },
  "arizona cardinals":     { league:"nfl", abbr:"ARI" },
  "las vegas raiders":     { league:"nfl", abbr:"LV"  },
  "denver broncos":        { league:"nfl", abbr:"DEN" },
  "los angeles chargers":  { league:"nfl", abbr:"LAC" },
  "pittsburgh steelers":   { league:"nfl", abbr:"PIT" },
  "baltimore ravens":      { league:"nfl", abbr:"BAL" },
  "cleveland browns":      { league:"nfl", abbr:"CLE" },
  "cincinnati bengals":    { league:"nfl", abbr:"CIN" },
  "tennessee titans":      { league:"nfl", abbr:"TEN" },
  "indianapolis colts":    { league:"nfl", abbr:"IND" },
  "jacksonville jaguars":  { league:"nfl", abbr:"JAX" },
  "houston texans":        { league:"nfl", abbr:"HOU" },
  "new orleans saints":    { league:"nfl", abbr:"NO"  },
  "atlanta falcons":       { league:"nfl", abbr:"ATL" },
  "carolina panthers":     { league:"nfl", abbr:"CAR" },
  "tampa bay buccaneers":  { league:"nfl", abbr:"TB"  },
  // MLB
  "toronto blue jays":     { league:"mlb", abbr:"TOR" },
  "boston red sox":        { league:"mlb", abbr:"BOS" },
  "new york yankees":      { league:"mlb", abbr:"NYY" },
  "new york mets":         { league:"mlb", abbr:"NYM" },
  "baltimore orioles":     { league:"mlb", abbr:"BAL" },
  "tampa bay rays":        { league:"mlb", abbr:"TB"  },
  "chicago white sox":     { league:"mlb", abbr:"CWS" },
  "chicago cubs":          { league:"mlb", abbr:"CHC" },
  "cleveland guardians":   { league:"mlb", abbr:"CLE" },
  "detroit tigers":        { league:"mlb", abbr:"DET" },
  "kansas city royals":    { league:"mlb", abbr:"KC"  },
  "minnesota twins":       { league:"mlb", abbr:"MIN" },
  "milwaukee brewers":     { league:"mlb", abbr:"MIL" },
  "los angeles dodgers":   { league:"mlb", abbr:"LAD" },
  "san francisco giants":  { league:"mlb", abbr:"SF"  },
  "san diego padres":      { league:"mlb", abbr:"SD"  },
  "colorado rockies":      { league:"mlb", abbr:"COL" },
  "arizona diamondbacks":  { league:"mlb", abbr:"ARI" },
  "seattle mariners":      { league:"mlb", abbr:"SEA" },
  "houston astros":        { league:"mlb", abbr:"HOU" },
  "texas rangers":         { league:"mlb", abbr:"TEX" },
  "los angeles angels":    { league:"mlb", abbr:"LAA" },
  "atlanta braves":        { league:"mlb", abbr:"ATL" },
  "miami marlins":         { league:"mlb", abbr:"MIA" },
  "washington nationals":  { league:"mlb", abbr:"WSH" },
  "philadelphia phillies": { league:"mlb", abbr:"PHI" },
  "st. louis cardinals":   { league:"mlb", abbr:"STL" },
  "pittsburgh pirates":    { league:"mlb", abbr:"PIT" },
  "cincinnati reds":       { league:"mlb", abbr:"CIN" },
  "oakland athletics":     { league:"mlb", abbr:"OAK" },
};

export default async (req, context) => {
  const url = new URL(req.url);
  const team = url.searchParams.get("team")?.toLowerCase();

  if (!team) {
    return new Response(JSON.stringify({ error: "Provide team param" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const info = TEAM_ABBR[team];
  if (!info) {
    return new Response(JSON.stringify({ error: `Unknown team: ${team}`, events: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  const { league, abbr } = info;
  const sport = LEAGUE_MAP[league];

  // ESPN scoreboard endpoint — gives current season schedule
  // Use the team schedule endpoint for full season
  const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/${sport}/teams/${abbr}/schedule`;

  try {
    const resp = await fetch(espnUrl, {
      headers: { "User-Agent": "Doubleheader/1.0" }
    });
    if (!resp.ok) throw new Error(`ESPN returned ${resp.status}`);
    const data = await resp.json();

    const today = new Date().toISOString().split("T")[0];
    const events = (data.events || [])
      .filter(ev => {
        const d = ev.date?.split("T")[0];
        return d && d >= today;
      })
      .map(ev => {
        const competition = ev.competitions?.[0];
        const home = competition?.competitors?.find(c => c.homeAway === "home");
        const away = competition?.competitors?.find(c => c.homeAway === "away");
        const venue = competition?.venue;
        const homeTeam = home?.team?.displayName || "";
        const awayTeam = away?.team?.displayName || "";
        const isHome = homeTeam.toLowerCase().includes(abbr.toLowerCase()) ||
                       home?.team?.abbreviation === abbr;
        return {
          id:       ev.id,
          date:     ev.date?.split("T")[0],
          name:     team.split(" ").map(w => w[0].toUpperCase()+w.slice(1)).join(" "),
          opponent: isHome ? awayTeam : homeTeam,
          isHome,
          venue:    venue?.fullName || (isHome ? "Home" : "Away"),
          city:     venue?.address?.city || "",
          state:    venue?.address?.state || "",
          league:   league.toUpperCase(),
          note:     `${league.toUpperCase()} ${isHome ? "vs" : "@"} ${isHome ? awayTeam : homeTeam}`,
        };
      });

    return new Response(JSON.stringify({ events, league: league.toUpperCase() }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, events: [] }), {
      status: 200, // return 200 so frontend can degrade gracefully
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
};

export const config = { path: "/api/sports" };
