import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const BASE = 'https://doubleheader.app';

async function fetchEvents(keyword, type) {
  const param = type === 'team' ? 'team' : 'artist';
  try {
    const r = await fetch(`${BASE}/api/concerts?${param}=${encodeURIComponent(keyword)}`);
    const d = await r.json();
    return (d.events || []).map(e => ({ ...e, _keyword: keyword, _type: type }));
  } catch(e) { return []; }
}

function groupIntoWindows(events, cities, homeCity) {
  const cityNames = cities.map(c => c.name.toLowerCase());

  // Filter to saved cities
  const matched = events.filter(e => {
    if (!e.date) return false;
    const evCity = e.city.toLowerCase().trim();
    return cityNames.some(c => c === evCity || evCity.includes(c) || c.includes(evCity));
  });

  // Sort by city then date, then group into 3-day trip windows (same logic as website)
  matched.sort((a, b) => {
    const cc = a.city.localeCompare(b.city);
    return cc !== 0 ? cc : a.date.localeCompare(b.date);
  });

  const byWin = {};
  matched.forEach(function(e) {
    const d = new Date(e.date + 'T12:00:00');
    // Find open window in same city within 3 days
    let bestKey = null, bestGap = Infinity;
    for (const k in byWin) {
      const w2 = byWin[k];
      if (w2.city !== e.city) continue;
      const gap = (d - new Date(w2.lastDate + 'T12:00:00')) / 86400000;
      if (gap >= 0 && gap <= 3 && gap < bestGap) { bestGap = gap; bestKey = k; }
    }
    if (!bestKey) {
      bestKey = e.city + '|' + e.date;
      byWin[bestKey] = { city: e.city, start: e.date, lastDate: e.date, events: [], nameSeen: {}, score: 0, flightUrl: null };
    }
    const w = byWin[bestKey];
    if (e.date > w.lastDate) w.lastDate = e.date;
    const nk = (e.artist || e.name || '').toLowerCase() + '|' + e.date;
    if (!w.nameSeen[nk]) {
      w.nameSeen[nk] = true;
      w.events.push({ name: e.name, date: e.date, venue: e.venue || '', city: e.city, url: e.url });
      w.score += e.broadMatch ? 10 : 30;
    }
  });

  // Build Skyscanner URL
  const IATA = {
    'calgary':'YYC','las vegas':'LAS','vancouver':'YVR','toronto':'YYZ','boston':'BOS',
    'dallas':'DFW','seattle':'SEA','detroit':'DTW','denver':'DEN','chicago':'ORD',
    'new york':'JFK','los angeles':'LAX','miami':'MIA','nashville':'BNA',
    'atlanta':'ATL','houston':'IAH','phoenix':'PHX','portland':'PDX',
    'minneapolis':'MSP','san francisco':'SFO'
  };
  const homeIATA = IATA[(homeCity||'Calgary').toLowerCase()] || 'YYC';

  const windows = Object.values(byWin).sort((a,b) => b.score - a.score || a.start - b.start);
  windows.forEach(w => {
    w.events.sort((a,b) => a.date.localeCompare(b.date));
    const destIATA = IATA[w.city.toLowerCase()];
    const firstDate = w.events[0]?.date;
    const lastDate  = w.events[w.events.length-1]?.date;
    const inbound   = firstDate ? new Date(new Date(firstDate+'T12:00:00').getTime() - 86400000).toISOString().split('T')[0].replace(/-/g,'') : '';
    const outbound  = lastDate  ? new Date(new Date(lastDate +'T12:00:00').getTime() + 86400000).toISOString().split('T')[0].replace(/-/g,'') : '';
    if (destIATA && inbound && outbound) {
      w.flightUrl = `https://www.skyscanner.net/g/referrals/v1/flights/day-view/${homeIATA}/${destIATA}/?outboundaltsenabled=false&inboundaltsenabled=false&adults=1&currency=CAD&outboundDate=${inbound.substring(0,4)+'-'+inbound.substring(4,6)+'-'+inbound.substring(6,8)}&inboundDate=${outbound.substring(0,4)+'-'+outbound.substring(4,6)+'-'+outbound.substring(6,8)}`;
    }
  });
  return windows;
}

export const handler = async () => {
  const { data: prefs } = await supabase.from('user_preferences').select('*');
  if (!prefs?.length) return { sent: 0 };

  let sent = 0;
  for (const pref of prefs) {
    const artists = pref.artists || [];
    const teams   = pref.teams   || [];
    if (!artists.length && !teams.length) continue;

    const { data: ud } = await supabase.auth.admin.getUserById(pref.user_id);
    const userEmail = ud?.user?.email;
    if (!userEmail) continue;

    // Build city list from saved preferences
    const cities = (pref.travel_cities || []).map(name => ({ name }));
    const homeCity = pref.home_city ? pref.home_city.split(',')[0].trim() : 'Calgary';

    // Fetch all events
    const allEvents = [];
    for (const artist of artists) allEvents.push(...await fetchEvents(artist, 'artist'));
    for (const team   of teams)   allEvents.push(...await fetchEvents(team,   'team'));

    // Group into windows exactly like the website
    const windows = groupIntoWindows(allEvents, cities, homeCity);
    if (!windows.length) continue;

    // Send via send-digest endpoint
    const r = await fetch(`${BASE}/api/send-digest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: pref.user_id, windows, homeCity })
    });
    const result = await r.json();
    if (result.ok) sent++;
  }
  return { sent };
};
