import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const RESEND_KEY   = process.env.RESEND_API_KEY;
const FROM_EMAIL   = process.env.ALERT_FROM_EMAIL || "alerts@doubleheader.app";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TM_KEY       = process.env.TICKETMASTER_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const resend = new Resend(RESEND_KEY);

async function fetchTMEvents(keyword, type) {
  const params = new URLSearchParams({
    apikey: TM_KEY, keyword,
    classificationName: type === 'team' ? 'Sports' : 'Music',
    countryCode: 'US,CA', size: '50', sort: 'date,asc',
    startDateTime: new Date().toISOString().split('.')[0] + 'Z',
  });
  try {
    const r = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
    const d = await r.json();
    return (d._embedded?.events || []).map(ev => ({
      id: ev.id, name: ev.name,
      date: ev.dates?.start?.localDate,
      venue: ev._embedded?.venues?.[0]?.name || '',
      city:  ev._embedded?.venues?.[0]?.city?.name || '',
      url:   ev.url,
    }));
  } catch(e) { return []; }
}

function buildDigestHtml(events) {
  const rows = events.map(ev => `
    <tr><td style="padding:14px 0;border-bottom:1px solid #1e1e1e;">
      <div style="font-size:15px;font-weight:700;color:#fff;">${ev.name}</div>
      <div style="font-size:13px;color:#888;margin-top:3px;">${ev.date || 'TBD'} &bull; ${ev.venue}, ${ev.city}</div>
      <a href="${ev.url}" style="display:inline-block;margin-top:6px;padding:5px 14px;background:#d4a843;color:#000;font-size:12px;font-weight:700;border-radius:4px;text-decoration:none;">Get tickets</a>
    </td></tr>`).join('');
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;">
  <div style="margin-bottom:24px;">
    <span style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-1px;">double</span><span style="font-size:22px;font-weight:900;color:#d4a843;letter-spacing:-1px;">header</span>
    <span style="font-size:12px;color:#555;margin-left:10px;letter-spacing:1px;text-transform:uppercase;">New matches</span>
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #1e1e1e;">${rows}</table>
  <div style="margin-top:24px;font-size:11px;color:#444;line-height:1.6;">
    You're subscribed to alerts at <a href="https://doubleheader.app" style="color:#666;">doubleheader.app</a>
  </div>
</div></body></html>`;
}

export default async (req) => {
  const secret = new URL(req.url).searchParams.get('secret');
  if (secret !== 'dh-test-2026') return new Response('nope', { status: 403 });

  // Get all user preferences using service role
  const { data: prefs, error } = await supabase
    .from('user_preferences')
    .select('user_id, artists, teams');

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  if (!prefs?.length) return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'no prefs' }), { status: 200 });

  let totalSent = 0;
  const log = [];

  for (const pref of prefs) {
    const artists = pref.artists || [];
    const teams   = pref.teams   || [];
    if (!artists.length && !teams.length) continue;

    // Get user email from auth.users via admin API
    const { data: userData } = await supabase.auth.admin.getUserById(pref.user_id);
    const userEmail = userData?.user?.email;
    if (!userEmail) { log.push('no email for ' + pref.user_id); continue; }

    // Fetch all events for their artists and teams
    const allEvents = [];
    for (const artist of artists) allEvents.push(...await fetchTMEvents(artist, 'artist'));
    for (const team   of teams)   allEvents.push(...await fetchTMEvents(team,   'team'));

    // Deduplicate
    const unique = [...new Map(allEvents.map(e => [e.id, e])).values()];
    if (!unique.length) { log.push('no events for ' + userEmail); continue; }

    // Send one digest
    await resend.emails.send({
      from:    `Doubleheader <${FROM_EMAIL}>`,
      to:      userEmail,
      subject: `${unique.length} new match${unique.length > 1 ? 'es' : ''} on Doubleheader`,
      html:    buildDigestHtml(unique),
    });

    totalSent++;
    log.push('sent ' + unique.length + ' events to ' + userEmail);
  }

  return new Response(JSON.stringify({ ok: true, sent: totalSent, log }), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
};

export const config = { path: '/api/send-digest' };
