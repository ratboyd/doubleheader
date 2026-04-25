// netlify/functions/concerts.js
// Proxies Ticketmaster Discovery API v2 for both music AND sports events

export default async (req, context) => {
  const url    = new URL(req.url);
  const artist  = url.searchParams.get("artist");
  const team    = url.searchParams.get("team");
  const genre   = url.searchParams.get("genre");
  const league  = url.searchParams.get("league");
  const city    = url.searchParams.get("city");
  const page    = url.searchParams.get("page") || "0";
  const startDate = url.searchParams.get("startDate");
  const endDate   = url.searchParams.get("endDate");

  if (!artist && !team && !genre && !league && !city) {
    return new Response(JSON.stringify({ error: `Provide at least one search param` }), {
      status: 400, headers: { "Content-Type": "application/json" }
    });
  }

  const TM_KEY = process.env.TICKETMASTER_KEY;
  if (!TM_KEY) {
    return new Response(JSON.stringify({ error: `TICKETMASTER_KEY not configured` }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }

  const GENRE_IDS = {
    "country":"KnvZfZ7vAv6","rock":"KnvZfZ7vAeJ","pop":"KnvZfZ7vAev",
    "edm":"KnvZfZ7vAvF","electronic":"KnvZfZ7vAvF","hiphop":"KnvZfZ7vAv1",
    "hip-hop":"KnvZfZ7vAv1","rnb":"KnvZfZ7vAvv","r&b":"KnvZfZ7vAvv",
    "jazz":"KnvZfZ7vAvE","classical":"KnvZfZ7vAeI","metal":"KnvZfZ7vAv6",
    "folk":"KnvZfZ7vAv6","indie":"KnvZfZ7vAeJ","alternative":"KnvZfZ7vAeJ",
  };

  const LEAGUE_SUBGENRES = {
    "nhl":"KZazBEonSMnZfZ7vFnI",
    "nba":"KZazBEonSMnZfZ7vFlt",
    "nfl":"KZazBEonSMnZfZ7vFnJ",
    "mlb":"KZazBEonSMnZfZ7vF1n",
    "mls":"KZazBEonSMnZfZ7vFIl",
  };

  // Build date window
  const now = new Date();
  const startDT = startDate
    ? new Date(startDate + "T00:00:00").toISOString().split(".")[0] + "Z"
    : now.toISOString().split(".")[0] + "Z";
  const endDT = endDate
    ? new Date(endDate + "T23:59:59").toISOString().split(".")[0] + "Z"
    : (() => { const d = new Date(now); d.setDate(d.getDate() + 90); return d.toISOString().split(".")[0] + "Z"; })();

  const params = new URLSearchParams({
    apikey: TM_KEY,
    countryCode: "US,CA",
    size: "100",
    page,
    sort: "date,asc",
    startDateTime: startDT,
    endDateTime: endDT,
  });

  if (artist) {
    params.set("classificationName", "Music");
    params.set("keyword", artist);
  } else if (team) {
    params.set("classificationName", "Sports");
    params.set("keyword", team);
  } else if (genre) {
    params.set("classificationName", "Music");
    const gid = GENRE_IDS[genre.toLowerCase()];
    if (gid) params.set("genreId", gid);
    else params.set("keyword", genre);
  } else if (league) {
    const sg = LEAGUE_SUBGENRES[league.toLowerCase()];
    if (sg) params.set("subGenreId", sg);
    else { params.set("classificationName","Sports"); params.set("keyword", league.toUpperCase()); }
  }

  if (city && (genre || league)) params.set("city", city);

  const tmUrl = `https://app.ticketmaster.com/discovery/v2/events.json?${params}`;

  try {
    const resp = await fetch(tmUrl);
    if (!resp.ok) throw new Error(`TM ${resp.status}`);
    const data = await resp.json();

    const events = (data._embedded?.events || []).map(ev => {
      const venue = ev._embedded?.venues?.[0];
      const cls   = ev.classifications?.[0];
      return {
        id:       ev.id,
        name:     ev.name,
        date:     ev.dates?.start?.localDate,
        time:     ev.dates?.start?.localTime,
        venue:    venue?.name || "",
        city:     venue?.city?.name || "",
        state:    venue?.state?.stateCode || "",
        country:  venue?.country?.countryCode || "",
        url:      ev.url,
        artist:   ev._embedded?.attractions?.[0]?.name || ev.name,
        type:     cls?.segment?.name === "Sports" ? "team" : "artist",
        genre:    cls?.genre?.name || "",
        subgenre: cls?.subGenre?.name || "",
        broadMatch: !!(genre || league),
      };
    });

    return new Response(JSON.stringify({
      events, total: data.page?.totalElements || 0, pages: data.page?.totalPages || 1,
    }), {
      status: 200,
      headers: { "Content-Type":"application/json","Cache-Control":"public, max-age=3600","Access-Control-Allow-Origin":"*" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, events: [] }), {
      status: 200, headers: { "Content-Type":"application/json","Access-Control-Allow-Origin":"*" }
    });
  }
};

export const config = { path: "/api/concerts" };
