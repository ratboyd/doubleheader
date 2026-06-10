// netlify/functions/seatgeek.js
// Proxies SeatGeek API for concert and sports event discovery
// Env vars required: SEATGEEK_CLIENT_ID
// Optional: SEATGEEK_AFFILIATE_ID (Impact.com aid — add once account is approved)

export default async (req, context) => {
  const url    = new URL(req.url);
  const artist  = url.searchParams.get("artist");
  const team    = url.searchParams.get("team");
  const startDate = url.searchParams.get("startDate");
  const endDate   = url.searchParams.get("endDate");

  if (!artist && !team) {
    return new Response(JSON.stringify({ error: "Provide artist or team param" }), {
      status: 400, headers: { "Content-Type": "application/json" }
    });
  }

  const SG_CLIENT_ID = process.env.SEATGEEK_CLIENT_ID;
  if (!SG_CLIENT_ID) {
    // Not yet configured — fail silently so it doesn't break search
    return new Response(JSON.stringify({ events: [], total: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  const now = new Date();
  const startDT = startDate
    ? startDate + "T00:00:00"
    : now.toISOString().split(".")[0];
  const endDT = endDate
    ? endDate + "T23:59:59"
    : (() => { const d = new Date(now); d.setDate(d.getDate() + 365); return d.toISOString().split(".")[0]; })();

  const params = new URLSearchParams({
    client_id: SG_CLIENT_ID,
    per_page:  "100",
    sort:      "datetime_utc.asc",
    "datetime_utc.gte": startDT,
    "datetime_utc.lte": endDT,
  });

  if (artist) {
    // performers.q does a fuzzy match on performer names and picks up tribute/candlelight
    // style events where the artist is a tagged performer (not just in the title)
    params.set("performers.q", artist);
    params.set("taxonomies.name", "concert");
  } else if (team) {
    params.set("performers.q", team);
    params.set("taxonomies.name", "sports");
  }

  const sgUrl = `https://api.seatgeek.com/2/events?${params}`;

  try {
    const resp = await fetch(sgUrl);
    if (!resp.ok) throw new Error(`SG ${resp.status}: ${await resp.text()}`);
    const data = await resp.json();

    // Tag event URLs with Impact.com affiliate params once the account is approved
    // (set SEATGEEK_AFFILIATE_ID in Netlify env). Uses the URL API so links that
    // already carry a query string (?lat=… etc.) are merged, not corrupted.
    const SG_AID = process.env.SEATGEEK_AFFILIATE_ID;
    const sgAffiliateUrl = (raw) => {
      if (!raw || !SG_AID) return raw || "";
      try {
        const u = new URL(raw);
        u.searchParams.set("aid", SG_AID);
        u.searchParams.set("utm_source", "impact");
        u.searchParams.set("utm_medium", "affiliate");
        u.searchParams.set("utm_campaign", "doubleheader");
        u.searchParams.set("irgwc", "1");
        u.searchParams.set("afsrc", "1");
        return u.toString();
      } catch (e) { return raw; }
    };

    const events = (data.events || []).map(ev => {
      const venue     = ev.venue || {};
      const performer = ev.performers?.[0];
      const [localDate, localTime] = (ev.datetime_local || "").split("T");

      return {
        id:         "sg-" + ev.id,
        name:       ev.title || performer?.name || "",   // full event title (e.g. "Candlelight: Coldplay and Imagine Dragons")
        date:       localDate || null,
        time:       localTime || null,
        venue:      venue.name || "",
        city:       venue.city || "",
        state:      venue.state || "",
        country:    venue.country || "US",
        url:        sgAffiliateUrl(ev.url),
        artist:     performer?.name || (artist || team || ""),  // performer name for dedup
        type:       team ? "team" : "artist",
        genre:      ev.taxonomies?.[0]?.name || "",
        subgenre:   ev.taxonomies?.[1]?.name || "",
        broadMatch: false,
        source:     "seatgeek",
      };
    });

    return new Response(JSON.stringify({
      events,
      total: events.length,
      pages: Math.ceil((data.meta?.total || events.length) / 100),
    }), {
      status: 200,
      headers: {
        "Content-Type":                "application/json",
        "Cache-Control":               "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, events: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
};

export const config = { path: "/api/seatgeek" };
