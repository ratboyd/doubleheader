// netlify/functions/track.js
// First-party outbound click logger (ticket / flight / hotel links).
// Cloudflare Web Analytics can't record custom events, so this is the source
// of truth for click-through numbers (e.g. proving traffic to Impact.com).
// Rows land in Supabase outbound_clicks via the service role.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const KINDS = new Set(["ticket", "flight", "hotel"]);

export default async (req) => {
  if (req.method !== "POST") return new Response("", { status: 405 });

  let b;
  try { b = await req.json(); }
  catch (e) { return new Response("", { status: 400 }); }

  const kind = String(b.kind || "").slice(0, 16);
  if (!KINDS.has(kind)) return new Response("", { status: 400 });

  const { error } = await supabase.from("outbound_clicks").insert({
    kind,
    domain: String(b.domain || "").slice(0, 128),
    city:   String(b.city   || "").slice(0, 64),
  });
  if (error) console.error("[track] insert error:", error.message);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { "Content-Type": "application/json" }
  });
};

export const config = { path: "/api/track" };
