import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const TM_KEY     = process.env.TICKETMASTER_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.ALERT_FROM_EMAIL || "alerts@doubleheader.app";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const resend = new Resend(RESEND_KEY);

const TM_BASE = "https://app.ticketmaster.com/discovery/v2";

function extractCity(cityStr) {
  return (cityStr || "").split(",")[0].trim();
}

function dateWindow() {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 90);
  const fmt = (d) => d.toISOString().split(".")[0] + "Z";
  return { startDateTime: fmt(now), endDateTime: fmt(end) };
}

async function fetchCityEvents(city) {
  const { startDateTime, endDateTime } = dateWindow();
  const params = new URLSearchParams({
    apikey: TM_KEY,
    city,
    countryCode: "CA,US",
    classificationName: "music,sports",
    startDateTime,
    endDateTime,
    size: 50,
    sort: "date,asc",
  });
  const res = await fetch(`${TM_BASE}/events.json?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data._embedded?.events || [];
}

const CITY_IATA = {
  calgary:"YYC",vancouver:"YVR",toronto:"YYZ",edmonton:"YEG",
  montreal:"YUL",ottawa:"YOW",winnipeg:"YWG","las vegas":"LAS",
  denver:"DEN",chicago:"ORD","new york":"JFK",boston:"BOS",
  seattle:"SEA",atlanta:"ATL",nashville:"BNA","los angeles":"LAX",
  "san francisco":"SFO",miami:"MIA",dallas:"DFW",phoenix:"PHX",
  minneapolis:"MSP",detroit:"DTW",portland:"PDX",houston:"IAH",
  "new orleans":"MSY","salt lake city":"SLC","san diego":"SAN",
  pittsburgh:"PIT",cleveland:"CLE",columbus:"CMH",raleigh:"RDU",
  charlotte:"CLT",tampa:"TPA",orlando:"MCO","kansas city":"MCI",
  "st. louis":"STL",indianapolis:"IND",buffalo:"BUF",
};

const SKYSCANNER_ID = "YOUR_AFFILIATE_ID";

function buildSkyscannerUrl(homeCity, destCity, eventDate) {
  const origin = CITY_IATA[(homeCity||"").toLowerCase()];
  const dest   = CITY_IATA[(destCity||"").toLowerCase()];
  if (!origin || !dest || origin === dest || !eventDate) return null;
  const d = new Date(eventDate);
  const pad = n => String(n).padStart(2,"0");
  const date = String(d.getFullYear()).slice(2) + pad(d.getMonth()+1) + pad(d.getDate());
  return `https://www.skyscanner.net/transport/flights/${origin}/${dest}/${date}/?adults=1&ref=${SKYSCANNER_ID}`;
}

function buildEmailHtml({ eventName, venueName, city, date, tmUrl, skyscannerUrl, homeCity }) {
  const dateStr = date
    ? new Date(date).toLocaleDateString("en-CA", { weekday:"long", year:"numeric", month:"long", day:"numeric" })
    : "Date TBD";
  const flightBlock = skyscannerUrl
    ? `<p style="margin:16px 0 0"><a href="${skyscannerUrl}" style="color:#c49a2a;text-decoration:none;font-weight:500">Find flights from ${homeCity} &rarr;</a></p>`
    : "";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:system-ui,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;max-width:600px">
<tr><td style="background:#0d0d0c;padding:24px 32px">
  <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.5px">doubleheader</span>
  <span style="color:#666;font-size:13px;margin-left:12px">new date alert</span>
</td></tr>
<tr><td style="padding:32px">
  <p style="margin:0 0 8px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.06em">New show in ${city}</p>
  <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0d0d0c;line-height:1.3">${eventName}</h1>
  <p style="margin:0 0 4px;font-size:15px;color:#333">${dateStr}</p>
  <p style="margin:0 0 24px;font-size:14px;color:#888">${venueName || city}</p>
  <a href="${tmUrl}" style="display:inline-block;background:#c49a2a;color:#0d0d0c;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Get tickets</a>
  ${flightBlock}
</td></tr>
<tr><td style="padding:16px 32px 24px;border-top:1px solid #f0f0f0">
  <p style="margin:0;font-size:11px;color:#aaa">You're getting this because you track ${city} on Doubleheader.</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

export const handler = async () => {
  try {
    const { data: prefs, error: prefsErr } = await supabase
      .from("user_preferences")
      .select("user_id, home_city, travel_cities");
    if (prefsErr) throw prefsErr;
    if (!prefs?.length) return { statusCode: 200, body: "No users" };

    const cityUserMap = {};
    for (const pref of prefs) {
      const cities = [...(pref.home_city ? [pref.home_city] : []), ...(pref.travel_cities || [])];
      for (const city of cities) {
        const key = city.toLowerCase().trim();
        if (!cityUserMap[key]) cityUserMap[key] = [];
        cityUserMap[key].push({ userId: pref.user_id, homeCity: pref.home_city, rawCity: city });
      }
    }

    let totalAlerts = 0;
    for (const cityKey of Object.keys(cityUserMap)) {
      const cityName = extractCity(cityUserMap[cityKey][0].rawCity);
      let events;
      try { events = await fetchCityEvents(cityName); } catch(e) { continue; }
      if (!events.length) continue;

      for (const user of cityUserMap[cityKey]) {
        const eventIds = events.map(e => e.id);
        const { data: seenRows } = await supabase
          .from("seen_events").select("tm_event_id")
          .eq("user_id", user.userId).in("tm_event_id", eventIds);
        const seenSet = new Set((seenRows||[]).map(r => r.tm_event_id));
        const newEvents = events.filter(e => !seenSet.has(e.id));
        if (!newEvents.length) continue;

        const { data: userData } = await supabase.auth.admin.getUserById(user.userId);
        const userEmail = userData?.user?.email;
        if (!userEmail) continue;

        for (const event of newEvents) {
          const city    = event._embedded?.venues?.[0]?.city?.name || cityName;
          const date    = event.dates?.start?.localDate;
          const html    = buildEmailHtml({
            eventName: event.name,
            venueName: event._embedded?.venues?.[0]?.name || "",
            city, date, tmUrl: event.url,
            skyscannerUrl: buildSkyscannerUrl(user.homeCity, user.rawCity, date),
            homeCity: extractCity(user.homeCity || ""),
          });
          try {
            await resend.emails.send({ from: FROM_EMAIL, to: userEmail, subject: `${event.name} just added a ${city} date`, html });
            totalAlerts++;
          } catch(e) { console.error("resend:", e.message); }
          await supabase.from("seen_events").upsert({ user_id: user.userId, tm_event_id: event.id, event_city: city, event_name: event.name }, { onConflict: "user_id,tm_event_id" });
        }
      }
      await new Promise(r => setTimeout(r, 250));
    }
    return { statusCode: 200, body: `${totalAlerts} alerts sent` };
  } catch(err) {
    console.error("[alerts]", err);
    return { statusCode: 500, body: err.message };
  }
};
