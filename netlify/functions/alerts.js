import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const BASE = 'https://doubleheader.app';

// Same metro aliases as the website — keeps email alerts consistent with UI results
const METRO_ALIASES = {
  "New York":      ["Newark","Wantagh","East Hartford","Uncasville","Elmont","Queens","Flushing","Bronx","East Rutherford"],
  "Los Angeles":   ["Inglewood","Anaheim","Carson","Roseville","Hollywood","Burbank","Chula Vista","Long Beach"],
  "Chicago":       ["Milwaukee","Rosemont","Tinley Park","Hoffman Estates"],
  "San Francisco": ["Oakland","San Jose","Sacramento","Mountain View","Concord"],
  "Washington":    ["Baltimore","Norfolk","Columbia","Bristow","Clarksburg"],
  "Boston":        ["Mansfield","Providence","Foxborough","Lowell","Gilford"],
  "Dallas":        ["Fort Worth","Arlington","Frisco","Irving","Grand Prairie"],
  "Houston":       ["The Woodlands","Sugar Land","Baytown"],
  "Miami":         ["Fort Lauderdale","West Palm Beach","Sunrise"],
  "Philadelphia":  ["Camden","Allentown","Bethlehem","Wilmington","Atlantic City","Chester"],
  "Atlanta":       ["Duluth","Alpharetta","Stone Mountain","Gainesville"],
  "Seattle":       ["Tacoma","Auburn","Renton","Everett","Redmond"],
  "Denver":        ["Morrison","Commerce City","Loveland","Broomfield"],
  "Phoenix":       ["Glendale","Tempe","Scottsdale","Mesa","Peoria"],
  "Minneapolis":   ["Saint Paul","Shakopee","Prior Lake","Eagan"],
  "Toronto":       ["Mississauga","Brampton","Hamilton","Oshawa","Vaughan"],
  "Vancouver":     ["Burnaby","Surrey","Abbotsford","Langley","Coquitlam"],
};

// Approximate flight hours from Calgary — used in email digest display
const FLIGHT_HOURS = {
  'las vegas': 2, 'los angeles': 2.5, 'vancouver': 1, 'seattle': 1.5,
  'portland': 2, 'san francisco': 2.5, 'phoenix': 2.5, 'denver': 2,
  'dallas': 3, 'houston': 3.5, 'chicago': 3, 'minneapolis': 2.5,
  'toronto': 4, 'boston': 5, 'new york': 5, 'miami': 6,
  'atlanta': 5, 'nashville': 4, 'detroit': 4, 'washington': 5,
  'philadelphia': 5,
};

async function fetchEvents(keyword, type) {
  const param = type === 'team' ? 'team'
    : type === 'genre'  ? 'genre'
    : type === 'league' ? 'league'
    : 'artist';
  try {
    const r = await fetch(`${BASE}/api/concerts?${param}=${encodeURIComponent(keyword)}`);
    const d = await r.json();
    return (d.events || []).map(e => ({ ...e, _keyword: keyword, _type: type }));
  } catch(e) { return []; }
}

// Expand each saved city into its metro alias list for matching
function buildCityList(savedCityNames) {
  const list = [];
  for (const name of savedCityNames) {
    list.push({ metro: name, alias: name.toLowerCase() });
    for (const a of (METRO_ALIASES[name] || [])) {
      list.push({ metro: name, alias: a.toLowerCase() });
    }
  }
  return list;
}

function groupIntoWindows(events, cities, homeCity) {
  const cityList = buildCityList(cities.map(c => c.name));

  // Filter to saved cities (metro-aware)
  const matched = events.filter(e => {
    if (!e.date) return false;
    const evCity = (e.city || '').toLowerCase().trim();
    return cityList.some(c =>
      c.alias === evCity || evCity.includes(c.alias) || c.alias.includes(evCity)
    );
  });

  matched.sort((a, b) => {
    const cc = a.city.localeCompare(b.city);
    return cc !== 0 ? cc : a.date.localeCompare(b.date);
  });

  const byWin = {};
  for (const e of matched) {
    const d = new Date(e.date + 'T12:00:00');
    const evCity = (e.city || '').toLowerCase().trim();

    // Resolve to metro name so Inglewood events group under "Los Angeles"
    const cityEntry = cityList.find(c =>
      c.alias === evCity || evCity.includes(c.alias) || c.alias.includes(evCity)
    );
    const metroName = cityEntry ? cityEntry.metro : e.city;

    // Find open window in same metro within 3 days
    let bestKey = null, bestGap = Infinity;
    for (const k in byWin) {
      const w2 = byWin[k];
      if (w2.metro !== metroName) continue;
      const gap = (d - new Date(w2.lastDate + 'T12:00:00')) / 86400000;
      if (gap >= 0 && gap <= 3 && gap < bestGap) { bestGap = gap; bestKey = k; }
    }
    if (!bestKey) {
      bestKey = metroName + '|' + e.date;
      byWin[bestKey] = {
        city: metroName, metro: metroName,
        start: e.date, lastDate: e.date,
        events: [], nameSeen: {},
        score: 0, hasSameDay: false,
        flightUrl: null, flightHours: null,
      };
    }
    const w = byWin[bestKey];
    if (e.date > w.lastDate) w.lastDate = e.date;
    const nk = (e.artist || e.name || '').toLowerCase() + '|' + e.date;
    if (!w.nameSeen[nk]) {
      w.nameSeen[nk] = true;
      // Flag same-day doubles
      if (w.events.some(ev => ev.date === e.date)) w.hasSameDay = true;
      w.events.push({ id: e.id, name: e.name, date: e.date, venue: e.venue || '', city: e.city, url: e.url });
      w.score += 1; // act-count scoring (same as frontend)
    }
  }

  const IATA = {
    'calgary':'YYC','las vegas':'LAS','vancouver':'YVR','toronto':'YYZ','boston':'BOS',
    'dallas':'DFW','seattle':'SEA','detroit':'DTW','denver':'DEN','chicago':'ORD',
    'new york':'JFK','los angeles':'LAX','miami':'MIA','nashville':'BNA',
    'atlanta':'ATL','houston':'IAH','phoenix':'PHX','portland':'PDX',
    'minneapolis':'MSP','san francisco':'SFO','washington':'DCA','philadelphia':'PHL',
  };
  const homeIATA = IATA[(homeCity || 'Calgary').toLowerCase()] || 'YYC';

  const windows = Object.values(byWin).sort((a, b) => b.score - a.score || a.start.localeCompare(b.start));
  // Affiliate ids — both optional; links render untagged until the programs approve
  const SKY_PARTNER  = process.env.SKYSCANNER_PARTNER_ID;
  const BOOKING_AID  = process.env.BOOKING_AFFILIATE_AID;
  for (const w of windows) {
    w.events.sort((a, b) => a.date.localeCompare(b.date));
    const destIATA = IATA[w.city.toLowerCase()];
    const firstDate = w.events[0]?.date;
    const lastDate  = w.events[w.events.length - 1]?.date;
    if (firstDate && lastDate) {
      const d1 = new Date(new Date(firstDate + 'T12:00:00').getTime() - 86400000).toISOString().split('T')[0];
      const d2 = new Date(new Date(lastDate  + 'T12:00:00').getTime() + 86400000).toISOString().split('T')[0];
      if (destIATA) {
        w.flightUrl = `https://www.skyscanner.net/g/referrals/v1/flights/day-view/${homeIATA}/${destIATA}/?outboundaltsenabled=false&inboundaltsenabled=false&adults=1&currency=CAD&outboundDate=${d1}&inboundDate=${d2}`
          + (SKY_PARTNER ? `&mediaPartnerId=${encodeURIComponent(SKY_PARTNER)}` : '');
      }
      // Hotel link: check in the day before the first event, out the day after the last
      w.hotelUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(w.city)}&checkin=${d1}&checkout=${d2}&group_adults=1&no_rooms=1`
        + (BOOKING_AID ? `&aid=${encodeURIComponent(BOOKING_AID)}` : '');
    }
    w.flightHours = FLIGHT_HOURS[w.city.toLowerCase()] || null;
  }
  return windows;
}

export const handler = async () => {
  const { data: prefs } = await supabase.from('user_preferences').select('*');
  if (!prefs?.length) return { sent: 0 };

  let sent = 0;
  for (const pref of prefs) {
    const artists = pref.artists  || [];
    const teams   = pref.teams    || [];
    const genres  = pref.genres   || [];
    const leagues = pref.leagues  || [];
    if (!artists.length && !teams.length && !genres.length && !leagues.length) continue;

    const { data: ud } = await supabase.auth.admin.getUserById(pref.user_id);
    const userEmail = ud?.user?.email;
    if (!userEmail) continue;

    const cities   = (pref.travel_cities || []).map(name => ({ name }));
    const homeCity = pref.home_city ? pref.home_city.split(',')[0].trim() : 'Calgary';

    // Fetch events for every saved artist, team, genre, and league
    const allEvents = [];
    for (const artist of artists) allEvents.push(...await fetchEvents(artist, 'artist'));
    for (const team   of teams)   allEvents.push(...await fetchEvents(team,   'team'));
    for (const genre  of genres)  allEvents.push(...await fetchEvents(genre,  'genre'));
    for (const league of leagues) allEvents.push(...await fetchEvents(league, 'league'));

    const windows = groupIntoWindows(allEvents, cities, homeCity);
    if (!windows.length) continue;

    const r = await fetch(`${BASE}/api/send-digest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: pref.user_id, windows, homeCity }),
    });
    const result = await r.json();
    if (result.ok) sent++;
  }
  return { sent };
};
