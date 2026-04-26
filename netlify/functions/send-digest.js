import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const RESEND_KEY   = process.env.RESEND_API_KEY;
const FROM_EMAIL   = process.env.ALERT_FROM_EMAIL || "alerts@doubleheader.app";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TM_KEY       = process.env.TICKETMASTER_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const resend   = new Resend(RESEND_KEY);

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
      city: ev._embedded?.venues?.[0]?.city?.name || '',
      url: ev.url,
      artist: ev._embedded?.attractions?.[0]?.name || ev.name,
    }));
  } catch(e) { return []; }
}

function buildDigestHtml(newEvents) {
  const rows = newEvents.map(ev => `
    <tr><td style="padding:12px 0;border-bottom:1px solid #222;">
      <div style="font-size:15px;font-weight:700;color:#fff;">${ev.name}</div>
      <div style="font-size:13px;color:#aaa;margin-top:2px;">${ev.date} &bull; ${ev.venue}, ${ev.city}</div>
      <a href="${ev.url}" style="display:inline-block;margin-top:6px;font-size:12px;color:#d4a843;font-weight:600;">Get tickets &rarr;</a>
    </td></tr>`).join('');
  return `<!DOCTYPE html><html><body style="background:#0a0a0a;font-family:sans-serif;padding:32px;">
  <div style="max-width:560px;margin:0 auto;">
    <div style="font-size:22px;font-weight:800;color:#fff;margin-bottom:4px;">double<span style="color:#d4a843;">header</span></div>
    <div style="font-size:13px;color:#aaa;margin-bottom:24px;">New events matching your artists &amp; teams</div>
    <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    <div style="margin-top:24px;font-size:11px;color:#555;">You're receiving this because you subscribed at <a href="https://doubleheader.app" style="color:#555;">doubleheader.app</a>.</div>
  </div></body></html>`;
}

export default async (req) => {
  const secret = new URL(req.url).searchParams.get('secret');
  if (secret !== 'dh-test-2026') return new Response('nope', { status: 403 });

  const { data: prefs } = await supabase.from('user_preferences').select('*');
  if (!prefs?.length) return new Response(JSON.stringify({ok:true,sent:0,reason:'no prefs'}), {status:200});

  let totalSent = 0;
  for (const user of prefs) {
    const userEmail = user.user_id;
    if (!userEmail?.includes('@')) continue;
    const artists = user.artists || [];
    const teams   = user.teams   || [];
    if (!artists.length && !teams.length) continue;

    const allEvents = [];
    for (const artist of artists) {
      const evs = await fetchTMEvents(artist, 'artist');
      allEvents.push(...evs);
    }
    for (const team of teams) {
      const evs = await fetchTMEvents(team, 'team');
      allEvents.push(...evs);
    }
    const unique = [...new Map(allEvents.map(e=>[e.id,e])).values()];
    if (!unique.length) continue;

    await resend.emails.send({
      from: `Doubleheader <${FROM_EMAIL}>`,
      to: userEmail,
      subject: `${unique.length} match${unique.length>1?'es':''} on Doubleheader this week`,
      html: buildDigestHtml(unique),
    });
    totalSent++;
  }
  return new Response(JSON.stringify({ok:true,sent:totalSent}), {
    status:200, headers:{'Content-Type':'application/json'}
  });
};

export const config = { path: '/api/send-digest' };
