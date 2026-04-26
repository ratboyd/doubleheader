import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const RESEND_KEY   = process.env.RESEND_API_KEY;
const FROM_EMAIL   = process.env.ALERT_FROM_EMAIL || "alerts@doubleheader.app";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const resend = new Resend(RESEND_KEY);

// Use our own /api/concerts endpoint which already has all filters built in
async function fetchEvents(keyword, type) {
  const param = type === 'team' ? 'team' : 'artist';
  const url = `https://doubleheader.app/api/concerts?${param}=${encodeURIComponent(keyword)}`;
  try {
    const r = await fetch(url);
    const d = await r.json();
    return d.events || [];
  } catch(e) { return []; }
}

function buildDigestHtml(events) {
  const rows = events.map(ev => `
    <tr><td style="padding:14px 0;border-bottom:1px solid #1e1e1e;">
      <div style="font-size:15px;font-weight:700;color:#fff;">${ev.name}</div>
      <div style="font-size:13px;color:#888;margin-top:3px;">${ev.date || 'TBD'} &bull; ${ev.venue}, ${ev.city}</div>
      <a href="${ev.url}" style="display:inline-block;margin-top:8px;padding:6px 16px;background:#d4a843;color:#000;font-size:12px;font-weight:700;border-radius:4px;text-decoration:none;">Get tickets</a>
    </td></tr>`).join('');

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;">
  <div style="margin-bottom:24px;">
    <span style="font-size:24px;font-weight:900;color:#fff;letter-spacing:-1px;">double</span><span style="font-size:24px;font-weight:900;color:#d4a843;letter-spacing:-1px;">header</span>
    <span style="font-size:11px;color:#555;margin-left:10px;letter-spacing:2px;text-transform:uppercase;">New matches</span>
  </div>
  <p style="color:#aaa;font-size:13px;margin:0 0 20px;">New events matching your artists &amp; teams — <a href="https://doubleheader.app" style="color:#d4a843;">view on doubleheader.app</a></p>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #1e1e1e;">${rows}</table>
  <div style="margin-top:28px;font-size:11px;color:#333;line-height:1.6;">
    Sent by <a href="https://doubleheader.app" style="color:#555;">doubleheader.app</a>
  </div>
</div></body></html>`;
}

export default async (req) => {
  const secret = new URL(req.url).searchParams.get('secret');
  if (secret !== 'dh-test-2026') return new Response('nope', { status: 403 });

  const { data: prefs, error } = await supabase
    .from('user_preferences')
    .select('user_id, artists, teams, home_city, travel_cities');

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  if (!prefs?.length) return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'no prefs' }), { status: 200 });

  let totalSent = 0;
  const log = [];

  for (const pref of prefs) {
    const artists = pref.artists || [];
    const teams   = pref.teams   || [];
    if (!artists.length && !teams.length) continue;

    // Get email via admin API
    const { data: userData } = await supabase.auth.admin.getUserById(pref.user_id);
    const userEmail = userData?.user?.email;
    if (!userEmail) { log.push('no email for ' + pref.user_id); continue; }

    // Fetch filtered events via our own API (has tribute/AHL filters built in)
    const allEvents = [];
    for (const artist of artists) allEvents.push(...await fetchEvents(artist, 'artist'));
    for (const team   of teams)   allEvents.push(...await fetchEvents(team,   'team'));

    // Deduplicate by event ID
    const unique = [...new Map(allEvents.map(e => [e.id, e])).values()];
    if (!unique.length) { log.push('no events for ' + userEmail); continue; }

    // Filter to only events in saved cities (home + travel)
    // Build saved city list — extract just the city name (strip ", AB" etc from home)
    const rawCities = [
      ...(pref.travel_cities || []),
      ...(pref.home_city ? [pref.home_city.split(',')[0].trim()] : [])
    ];
    const savedCities = rawCities.map(c => c.toLowerCase().trim());

    const cityFiltered = savedCities.length > 0
      ? unique.filter(ev => {
          const evCity = ev.city.toLowerCase().trim();
          return savedCities.some(sc => evCity === sc);
        })
      : unique;

    if (!cityFiltered.length) { log.push('no city matches for ' + userEmail); continue; }

    // Sort by date
    cityFiltered.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    await resend.emails.send({
      from:    `Doubleheader <${FROM_EMAIL}>`,
      to:      userEmail,
      subject: `${cityFiltered.length} new match${cityFiltered.length > 1 ? 'es' : ''} on Doubleheader`,
      html:    buildDigestHtml(cityFiltered),
    });

    totalSent++;
    log.push('sent ' + cityFiltered.length + ' events to ' + userEmail);
  }

  return new Response(JSON.stringify({ ok: true, sent: totalSent, log }), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
};

export const config = { path: '/api/send-digest' };
