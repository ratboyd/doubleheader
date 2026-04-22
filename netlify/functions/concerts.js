// netlify/functions/concerts.js
// Proxies Ticketmaster Discovery API v2
// Set TICKETMASTER_KEY in Netlify environment variables (Dashboard > Site > Environment Variables)

export default async (req, context) => {
  const url = new URL(req.url);
  const artist = url.searchParams.get("artist");
  const city   = url.searchParams.get("city");
  const page   = url.searchParams.get("page") || "0";

  if (!artist && !city) {
    return new Response(JSON.stringify({ error: "Provide artist or city param" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const TM_KEY = process.env.TICKETMASTER_KEY;
  if (!TM_KEY) {
    return new Response(JSON.stringify({ error: "TICKETMASTER_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Build Ticketmaster query
  const params = new URLSearchParams({
    apikey: TM_KEY,
    classificationName: "Music",
    countryCode: "US,CA",
    size: "50",
    page,
    sort: "date,asc",
    // Only future events
    startDateTime: new Date().toISOString().split(".")[0] + "Z",
  });

  if (artist) params.set("keyword", artist);
  if (city)   params.set("city", city);

  const tmUrl = `https://app.ticketmaster.com/discovery/v2/events.json?${params}`;

  try {
    const resp = await fetch(tmUrl);
    if (!resp.ok) throw new Error(`TM returned ${resp.status}`);
    const data = await resp.json();

    const events = (data._embedded?.events || []).map(ev => {
      const venue = ev._embedded?.venues?.[0];
      return {
        id:     ev.id,
        name:   ev.name,
        date:   ev.dates?.start?.localDate,
        time:   ev.dates?.start?.localTime,
        venue:  venue?.name || "",
        city:   venue?.city?.name || "",
        state:  venue?.state?.stateCode || "",
        country: venue?.country?.countryCode || "",
        url:    ev.url,
        image:  ev.images?.find(i => i.ratio === "16_9" && i.width > 500)?.url || "",
        // Extract headliner from attractions
        artist: ev._embedded?.attractions?.[0]?.name || ev.name,
      };
    });

    return new Response(JSON.stringify({
      events,
      total: data.page?.totalElements || 0,
      pages: data.page?.totalPages || 1,
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600", // cache 1hr
        "Access-Control-Allow-Origin": "*",
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const config = { path: "/api/concerts" };
