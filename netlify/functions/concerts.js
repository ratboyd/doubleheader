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
    "jazz":"KnvZfZ7vAvE","classical":"KnvZfZ7vAeI","metal":null,
    "folk":null,"indie":"KnvZfZ7vAeJ","alternative":"KnvZfZ7vAeJ",
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
    : (() => { const d = new Date(now); d.setDate(d.getDate() + 365); return d.toISOString().split(".")[0] + "Z"; })();

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
    params.set("keyword", artist);
  } else if (team) {
    params.set("classificationName", "Sports");
    params.set("keyword", team);
  } else if (genre) {
    params.set("classificationName", "Music");
    const gid = GENRE_IDS[genre.toLowerCase()];
    if (gid) params.set("genreId", gid);
    else { params.set("keyword", genre); params.set("classificationName", "Music"); }
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

    // ── POST-FILTERS ─────────────────────────────────────────────────────────
    // 1. Drop tribute/cover acts for artist searches
    // Classical/orchestral events that TM miscategorizes under Rock/Pop etc.
    const CLASSICAL_WORDS = ['symphony', 'orchestra', 'philharmonic', 'ballet',
      'opera ', 'chamber music', 'concerto', 'symphony orchestra'];
    // Filter these out entirely regardless of search type
    const isClassical = ev => CLASSICAL_WORDS.some(w => ev.name.toLowerCase().includes(w));

    const TRIBUTE_WORDS = [
      'tribute', 'salute to', 'experience', 'vs.', 'presents',
      'a night of', 'the music of', 'performs ', 'legacy', 'orchestral',
      'featuring songs of', 'celebration of', 'dance night',
      'ticket + hotel', 'hotel deal', 'hotel package', 'vip package',
      'allstars', 'all stars', 'all-stars', 'best of the', 'greatest hits of',
    ];
    const filteredEvents = events.filter(ev => {
      if (isClassical(ev)) return false;
      const nameLower = ev.name.toLowerCase();
      const artistLower = (ev.artist || '').toLowerCase();
      // For artist searches: drop if name contains tribute words
      if (artist) {
        // Drop tribute/cover/package words — but only check event name, not attraction
        const ARTIST_TRIBUTE = ['tribute', 'salute to', 'a night of', 'the music of',
          'performs ', 'symphony', 'orchestral', 'featuring songs of', 'celebration of',
          'dance night', 'ticket + hotel', 'hotel deal', 'hotel package', 'vip package',
          'allstars', 'all stars', 'all-stars', 'best of the', 'greatest hits of',
          'punk brunch', 'vs ', 'vs.'];
        if (ARTIST_TRIBUTE.some(w => nameLower.includes(w))) return false;
        // Require artist name match — attraction must start with or equal search term
        // (prevents "The Long Run: Experience the Eagles" matching "Eagles")
        const searchLower = artist.toLowerCase();
        const attractionMatch = artistLower === searchLower ||
          artistLower.startsWith(searchLower) ||
          artistLower.startsWith('the ' + searchLower);
        const nameExact = nameLower.startsWith(searchLower) || nameLower.includes(': ' + searchLower);
        if (!attractionMatch && !nameExact) return false;
        // Also drop if attraction name contains tribute indicators
        const TRIBUTE_ATTRACTION = ['experience', 'tribute', 'salute', 'legacy', 'allstar', 'all star'];
        if (!attractionMatch && TRIBUTE_ATTRACTION.some(w => artistLower.includes(w))) return false;
      }
      // For team searches: use subgenre to filter out wrong-league teams
      // e.g. "Dallas Stars" (NHL) vs "Texas Stars" (AHL)
      if (team) {
        const teamLower = team.toLowerCase();
        const subgenreLower = (ev.subgenre || '').toLowerCase();
        // Known minor/wrong league subgenres to reject for major-league searches
        const MINOR_LEAGUES = ['ahl', 'echl', 'chl', 'ohl', 'whl', 'qmjhl', 'nll',
          'nba g league', 'usl', 'usl championship', 'usl league one', 'nwsl'];
        if (MINOR_LEAGUES.some(ml => subgenreLower.includes(ml))) return false;
        // Also drop if ALL words of the team name don't appear in name or subgenre
        const teamWords = teamLower.split(/\s+/).filter(w => w.length > 3);
        // At least one key word must match (e.g. "Stars" in "Dallas Stars")
        const lastWord = teamWords[teamWords.length - 1];
        if (lastWord && !nameLower.includes(lastWord) && !subgenreLower.includes(lastWord)) return false;
      }
      return true;
    });


    // Deduplicate by artist+date+city: for each group, prefer the canonical show
    // (exact artist name match) over suite reservations, 2-day bundle tickets, etc.
    const BUNDLE_WORDS = ['suite reservation', '2-day ticket', '2day ticket', 'cannot split',
      'hotel package', 'vip package', 'pre-sale', 'meet & greet', 'meet and greet'];
    const dedupMap = new Map();
    for (const ev of filteredEvents) {
      const key = (ev.artist||'').toLowerCase() + '|' + ev.date + '|' + ev.city.toLowerCase();
      const isBundle = BUNDLE_WORDS.some(w => ev.name.toLowerCase().includes(w));
      if (!dedupMap.has(key)) {
        dedupMap.set(key, ev);
      } else {
        const existing = dedupMap.get(key);
        const existingIsBundle = BUNDLE_WORDS.some(w => existing.name.toLowerCase().includes(w));
        // Prefer non-bundle over bundle; prefer TM link over 3rd party
        if (existingIsBundle && !isBundle) dedupMap.set(key, ev);
        else if (!existingIsBundle && !isBundle) {
          // Both non-bundle: prefer ticketmaster.com over gofevo etc
          if (ev.url?.includes('ticketmaster.com') && !existing.url?.includes('ticketmaster.com'))
            dedupMap.set(key, ev);
        }
      }
    }
    const dedupedEvents = Array.from(dedupMap.values());

    return new Response(JSON.stringify({
      events: dedupedEvents, total: dedupedEvents.length, pages: data.page?.totalPages || 1,
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
