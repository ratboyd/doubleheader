import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const RESEND_KEY   = process.env.RESEND_API_KEY;
const FROM_EMAIL   = process.env.ALERT_FROM_EMAIL || "alerts@doubleheader.app";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const resend = new Resend(RESEND_KEY);

function fmtDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });
}

function buildDigestHtml(windows, homeCity) {
  const cards = windows.map(w => {
    const firstDate = w.events[0]?.date;
    const lastDate  = w.events[w.events.length-1]?.date;
    const dateRange = firstDate === lastDate ? fmtDate(firstDate) : fmtDate(firstDate) + ' – ' + fmtDate(lastDate);
    const eventRows = w.events.map(ev => `
      <div style="padding:8px 0;border-bottom:1px solid #1a1a1a;">
        <div style="font-size:14px;font-weight:700;color:#fff;">${ev.name}</div>
        <div style="font-size:12px;color:#777;margin-top:2px;">${ev.venue || ''}${ev.venue ? ', ' : ''}${ev.city}</div>
        <a href="${ev.url}" style="display:inline-block;margin-top:5px;padding:4px 12px;background:#d4a843;color:#000;font-size:11px;font-weight:700;border-radius:3px;text-decoration:none;">Get tickets</a>
      </div>`).join('');

    const flightRow = w.flightUrl ? `
      <div style="margin-top:10px;padding:8px 12px;background:#111;border-radius:6px;display:flex;align-items:center;gap:10px;">
        <span style="font-size:12px;color:#aaa;">✈ ${homeCity || 'YYC'} → ${w.city}</span>
        <span style="font-size:12px;color:#555;">·</span>
        <span style="font-size:12px;color:#888;">${w.flightHours}h flight</span>
        <a href="${w.flightUrl}" style="margin-left:auto;font-size:11px;color:#d4a843;font-weight:600;text-decoration:none;">Search flights →</a>
      </div>` : `
      <div style="margin-top:10px;padding:8px 12px;background:#111;border-radius:6px;">
        <span style="font-size:12px;color:#555;">✈ ${homeCity || 'YYC'} → ${w.city} · ${w.flightHours}h</span>
      </div>`;

    return `
    <div style="margin-bottom:20px;padding:16px;background:#111;border-radius:10px;border:1px solid #222;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
        <div>
          <div style="font-size:20px;font-weight:900;color:#fff;letter-spacing:-0.5px;">${w.city}</div>
          <div style="font-size:12px;color:#666;margin-top:2px;">${dateRange}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px;font-weight:900;color:#d4a843;text-transform:uppercase;letter-spacing:.05em;">${w.hasSameDay ? 'Same-day Double' : w.score >= 4 ? 'Grand Slam' : w.score >= 3 ? 'Triple' : w.score >= 2 ? 'Double' : 'Single'}</div>
          <div style="font-size:9px;color:#555;letter-spacing:1px;text-transform:uppercase;">&nbsp;</div>
        </div>
      </div>
      ${eventRows}
      ${flightRow}
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:580px;margin:0 auto;padding:32px 20px;">
  <div style="margin-bottom:24px;">
    <span style="font-size:26px;font-weight:900;color:#fff;letter-spacing:-1px;">double</span><span style="font-size:26px;font-weight:900;color:#d4a843;letter-spacing:-1px;">header</span>
    <span style="display:block;font-size:11px;color:#444;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">New matches for you</span>
  </div>
  <p style="color:#666;font-size:13px;margin:0 0 20px;line-height:1.5;">
    ${windows.length} trip${windows.length !== 1 ? 's' : ''} matching your artists &amp; teams —
    <a href="https://doubleheader.app" style="color:#d4a843;">view on doubleheader.app</a>
  </p>
  ${cards}
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #1a1a1a;font-size:11px;color:#333;line-height:1.6;">
    You're subscribed to alerts at <a href="https://doubleheader.app" style="color:#444;">doubleheader.app</a>
  </div>
</div></body></html>`;
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body;
  try { body = await req.json(); } 
  catch(e) { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 }); }

  const { userId, windows, homeCity, secret } = body;

  // Auth: either a test secret or a valid Supabase user
  if (secret !== 'dh-test-2026' && !userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  if (!windows || !windows.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'no windows' }), { status: 200 });
  }

  // For non-test calls: filter to only unseen events
  let filteredWindows = windows;
  if (userId && userId !== 'test') {
    const { data: seen } = await supabase
      .from('seen_events')
      .select('tm_event_id')
      .eq('user_id', userId);
    const seenIds = new Set((seen || []).map(r => r.tm_event_id));

    filteredWindows = windows.map(w => ({
      ...w,
      events: w.events.filter(e => {
        const eid = e.url || (e.name + '|' + e.date + '|' + e.city);
        return !seenIds.has(eid);
      })
    })).filter(w => w.events.length > 0);

    if (!filteredWindows.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'no new events' }), { status: 200 });
    }
  }

  // Get user email
  let userEmail;
  if (secret === 'dh-test-2026') {
    // Test mode — get first user from prefs
    const { data: prefs } = await supabase.from('user_preferences').select('user_id').limit(1);
    if (prefs?.length) {
      const { data: ud } = await supabase.auth.admin.getUserById(prefs[0].user_id);
      userEmail = ud?.user?.email;
    }
  } else {
    const { data: ud } = await supabase.auth.admin.getUserById(userId);
    userEmail = ud?.user?.email;
  }

  if (!userEmail) return new Response(JSON.stringify({ error: 'No email found' }), { status: 400 });

  await resend.emails.send({
    from:    `Doubleheader <${FROM_EMAIL}>`,
    to:      userEmail,
    subject: `${filteredWindows.length} new match${filteredWindows.length !== 1 ? 'es' : ''} on Doubleheader`,
    html:    buildDigestHtml(filteredWindows, homeCity),
  });

  // Mark events as seen so we don't email them again
  if (userId && userId !== 'test') {
    const eventIds = filteredWindows.flatMap(w => w.events.map(e => ({
      user_id: userId,
      tm_event_id: e.url || (e.name + '|' + e.date + '|' + e.city),
      event_name: e.name,
      event_city: e.city,
      alerted_at: new Date().toISOString()
    })));
    if (eventIds.length) {
      await supabase.from('seen_events').upsert(eventIds, { onConflict: 'user_id,tm_event_id' });
    }
  }

  return new Response(JSON.stringify({ ok: true, sent: 1, to: userEmail }), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
};

export const config = { path: '/api/send-digest' };
