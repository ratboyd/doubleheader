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
    // MLS: subGenreId unreliable; classificationName=MLS works better
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
    if (sg) {
      params.set("classificationName", "Sports");
      params.set("subGenreId", sg);
    } else {
      // classificationName matches across all TM classification levels (segment/genre/subgenre)
      // e.g. "MLS" matches the MLS subgenre without needing the exact subGenreId
      params.set("classificationName", league.toUpperCase());
    }
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

    // Ã¢ÂÂÃ¢ÂÂ POST-FILTERS Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
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
    let filteredEvents = events.filter(ev => {
      if (isClassical(ev)) return false;
      // For genre keyword searches (null genreId), validate the returned event
      // actually matches the genre Ã¢ÂÂ prevents Blake Shelton showing up for "metal"
      if (genre && !GENRE_IDS[genre.toLowerCase()]) {
        const evGenre = (ev.genre + " " + ev.subgenre).toLowerCase();
        const searchGenre = genre.toLowerCase();
        const GENRE_SYNONYMS = {
          metal: ["metal", "hard rock", "heavy metal", "punk", "alternative"],
          folk: ["folk", "acoustic", "americana", "bluegrass", "country folk"],
        };
        const validTerms = GENRE_SYNONYMS[searchGenre] || [searchGenre];
        if (!validTerms.some(t => evGenre.includes(t))) return false;
      }
      const nameLower = ev.name.toLowerCase();
      const artistLower = (ev.artist || '').toLowerCase();
      // For artist searches: drop if name contains tribute words
      if (artist) {
        // Drop tribute/cover/package words Ã¢ÂÂ but only check event name, not attraction
        const ARTIST_TRIBUTE = ['tribute', 'salute to', 'a night of', 'the music of',
          'performs ', 'symphony', 'orchestral', 'featuring songs of', 'celebration of',
          'dance night', 'ticket + hotel', 'hotel deal', 'hotel package', 'vip package',
          'allstars', 'all stars', 'all-stars', 'best of the', 'greatest hits of',
          'punk brunch', 'vs ', 'vs.'];
        if (ARTIST_TRIBUTE.some(w => nameLower.includes(w))) return false;
        // Require artist name match Ã¢ÂÂ attraction must start with or equal search term
        // (prevents "The Long Run: Experience the Eagles" matching "Eagles")
        const searchLower = artist.toLowerCase();
        // Check ALL attractions, not just the first — catches co-headliner and support
        // act events where the searched artist isn't billed first (e.g. "Three Days Grace
        // & Seether", "Nickelback with Seether").
        const allAttractions = (ev._embedded?.attractions || []).map(a => (a.name || '').toLowerCase());
        const attractionMatch = allAttractions.some(al =>
          al === searchLower || al.startsWith(searchLower) || al.startsWith('the ' + searchLower)
        );
        // Also accept if event name contains the artist name in common multi-act formats
        const nameExact = nameLower.startsWith(searchLower) ||
          nameLower.includes(': ' + searchLower) ||
          nameLower.includes('& ' + searchLower) ||
          nameLower.includes('and ' + searchLower) ||
          nameLower.includes('with ' + searchLower);
        if (!attractionMatch && !nameExact) return false;
        // Drop if the first attraction contains tribute indicators and no direct match
        const TRIBUTE_ATTRACTION = ['experience', 'tribute', 'salute', 'legacy', 'allstar', 'all star'];
        if (!attractionMatch && TRIBUTE_ATTRACTION.some(w => artistLower.includes(w))) return false;
      }
      // For team searches: use subgenre to filter out wrong-league teams
      // e.g. "Dallas Stars" (NHL) vs "Texas Stars" (AHL)
      if (team) {
        const teamLower = team.toLowerCase();
        const subgenreLower = (ev.subgenre || '').toLowerCase();

        // Drop minor/wrong league subgenres
        const MINOR_LEAGUES = ['ahl', 'echl', 'chl', 'ohl', 'whl', 'qmjhl', 'nll',
          'nba g league', 'usl', 'usl championship', 'usl league one', 'nwsl'];
        if (MINOR_LEAGUES.some(ml => subgenreLower.includes(ml))) return false;

        // Drop non-game products: stadium tours, pregame experiences, VIP packages
        // that TM classifies as Sports but are not actual scheduled games
        const NON_GAME = [
          'stadium tour', 'ballpark tour', 'arena tour', 'field tour', 'park tour',
          'pregame', 'pre-game', 'glimpse', 'behind the scenes', 'behind-the-scenes',
          'fan experience', 'fan fest', 'fanfest', 'batting practice',
          'classic tour', 'premium experience', 'vip experience',
          'hospitality package', 'club access', 'guided tour',
        ];
        if (NON_GAME.some(w => nameLower.includes(w))) return false;

        // Require ALL significant words of the team name in the event title.
        // Use length > 2 (not > 3) so 3-char words like "Sox", "Red", "Bay" are
        // included — otherwise "Red Sox" produces an empty array and the check
        // is skipped entirely, letting every Sports event through.
        const teamWords = teamLower.split(/\s+/).filter(w => w.length > 2);
        if (teamWords.length > 0 && !teamWords.every(w => nameLower.includes(w))) return false;
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
