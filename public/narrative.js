// narrative.js — AI blurb generation with city context injection

// ── CITY CONTEXT SEED ────────────────────────────────────────────────────────
// Hand-authored flavour blocks. Each entry: vibe (1 sentence personality),
// and pairings (2-3 concrete activity suggestions for that city).
// Add new metros here; narrative falls back to generic prompt if city not found.
var CITY_CTX = {
  "New York": {
    vibe: "Electric, never-sleeps energy — Broadway, world-class dining, and legendary jazz clubs within walking distance of every arena.",
    pairings: ["pre-show dinner in Hell's Kitchen", "jazz at Village Vanguard after the game", "Sunday brunch in Brooklyn between shows"]
  },
  "Los Angeles": {
    vibe: "Sprawling creative capital where film, music, and sports culture converge under perpetual sunshine.",
    pairings: ["rooftop bar after Dodger Stadium", "Venice Beach morning before a SoFi show", "taco run on Sunset between events"]
  },
  "Chicago": {
    vibe: "World-class food city with bone-deep sports loyalty — blues bars and steakhouses spill right out of Wrigley.",
    pairings: ["deep dish at Lou Malnati's before the game", "jazz on the Magnificent Mile", "architectural river cruise between events"]
  },
  "Toronto": {
    vibe: "Canada's multicultural capital — Scotiabank Arena steps from the waterfront, with every cuisine imaginable nearby.",
    pairings: ["poutine on King Street after the game", "Distillery District dinner between shows", "dim sum in Chinatown Sunday morning"]
  },
  "Nashville": {
    vibe: "Music City, full stop — honky-tonks on Lower Broadway make every arena night a two-act show.",
    pairings: ["live music on Broadway before the game", "hot chicken at Prince's", "rooftop bar on Second Avenue after the show"]
  },
  "Las Vegas": {
    vibe: "Entertainment capital where residencies and major sports collide nightly in the most concentrated event strip on earth.",
    pairings: ["poolside afternoon before the show", "late-night headliner after the game", "buffet brunch to fuel the day"]
  },
  "Seattle": {
    vibe: "Grunge roots, craft coffee obsession, and a passionate sports fanbase set against stunning Puget Sound views.",
    pairings: ["Pike Place Market morning before the game", "Capitol Hill bars after the show", "ferry ride with waterfront views between events"]
  },
  "Denver": {
    vibe: "Outdoor-adventure city meets live-music town — Red Rocks looms over everything, and the Mile High air hits different.",
    pairings: ["Red Rocks sunrise hike before the show", "RiNo craft brewery crawl after the game", "mountain day trip between events"]
  },
  "Dallas": {
    vibe: "Big sports energy across all four major leagues, with world-class BBQ, a thriving arts scene, and Texas-sized ambition.",
    pairings: ["Pecan Lodge BBQ before the game", "Deep Ellum live music after the show", "Fort Worth Stockyards visit between events"]
  },
  "Boston": {
    vibe: "America's most passionate sports town wrapped in colonial history — Fenway Park is a pilgrimage, TD Garden a fortress.",
    pairings: ["clam chowder on the Waterfront before the game", "Back Bay bar crawl after Fenway", "Freedom Trail walk between shows"]
  },
  "Miami": {
    vibe: "Art Deco glamour, Latin heat, and a nightlife that runs until sunrise — every event here is a full-night production.",
    pairings: ["Wynwood Art District afternoon before the show", "Calle Ocho dinner after the game", "South Beach sunrise between events"]
  },
  "Atlanta": {
    vibe: "Hip-hop and R&B capital with incredible soul food and a city that consistently punches above its cultural weight.",
    pairings: ["soul food at Mary Mac's before the game", "BeltLine walk between shows", "Ponce City Market rooftop after the event"]
  },
  "San Francisco": {
    vibe: "Tech-meets-counterculture with jaw-dropping bay views — Chase Center and Oracle Park anchor a world-class city.",
    pairings: ["Ferry Building market morning before the game", "Mission tacos after the show", "Golden Gate walk between events"]
  },
  "Phoenix": {
    vibe: "Sun-drenched desert city with a surprisingly deep sports culture, rooftop bars, and warm November nights that don't quit.",
    pairings: ["Scottsdale Old Town dinner before the game", "desert sunrise hike between shows", "rooftop pool afternoon after the event"]
  },
  "Minneapolis": {
    vibe: "Underrated arts and food city with one of the fiercest sports fanbases in the Midwest and a legendary music history.",
    pairings: ["First Avenue music history tour before the show", "Uptown brunch between events", "Surly Brewing after the game"]
  },
  "Portland": {
    vibe: "Fiercely independent, food-obsessed, and outdoorsy — Powell's Books and food carts fuel you between shows.",
    pairings: ["food cart pod lunch before the show", "Powell's Books browse between events", "Alberta Arts District bar after the game"]
  },
  "Detroit": {
    vibe: "Gritty, creative, and proud — Motor City's music legacy (Motown, techno) runs as deep as its sports passion.",
    pairings: ["Corktown brunch before the game", "Eastern Market Saturday between shows", "Hamtramck bar crawl after the event"]
  },
  "Vancouver": {
    vibe: "Stunning mountain-meets-ocean backdrop with a passionate Canucks fanbase and one of the best food scenes in North America.",
    pairings: ["Granville Island market morning before the game", "Gastown dinner after the show", "Grouse Mountain gondola between events"]
  },
  "Calgary": {
    vibe: "Cowboy boots and NHL playoffs — Stampede energy all year, Banff a 90-minute drive, and a craft beer scene that won't quit.",
    pairings: ["Inglewood neighbourhood brunch before the game", "17th Ave bar crawl after the show", "Banff day trip between events"]
  }
};

// Resolve a card city to a context entry (exact or partial match)
function getCityCtx(city) {
  if (!city) return null;
  if (CITY_CTX[city]) return CITY_CTX[city];
  var cl = city.toLowerCase();
  var key = Object.keys(CITY_CTX).find(function(k) {
    return cl.includes(k.toLowerCase()) || k.toLowerCase().includes(cl);
  });
  return key ? CITY_CTX[key] : null;
}

// Build system + user prompt, injecting city context when available
function buildNarrativePrompt(card, all, dateStr) {
  var ctx = getCityCtx(card.city);

  var system = "You write punchy, specific travel teaser copy for doubleheader.app — a site that surfaces trips combining sports and music (and comedy) events. Voice: enthusiastic but not cheesy, max 2 sentences, 35 words total. Never use the word 'unforgettable'.";
  if (ctx) {
    system += " City context for " + card.city + ": " + ctx.vibe;
    if (ctx.pairings && ctx.pairings.length) {
      system += " Suggested local pairings: " + ctx.pairings.slice(0, 2).join('; ') + ".";
    }
  }

  var prompt = "Why make the trip to " + card.city + "? Events: " + all + ". Date(s): " + dateStr + ". Write the teaser.";
  return { system: system, prompt: prompt };
}

// ── STYLES ───────────────────────────────────────────────────────────────────
var _s = document.createElement("style");
_s.textContent = ".cn{font-size:11px;color:var(--ink3);line-height:1.5;padding:6px 14px 10px;font-style:italic;border-top:1px solid rgba(13,13,12,.07);}"
  + ".cn.ready{border:1.5px solid #c8922a;border-top:none;border-radius:0 0 10px 10px;animation:dhglow 3s ease-in-out infinite;}"
  + "@keyframes dhglow{0%,100%{box-shadow:0 0 6px rgba(200,146,42,.3);}50%{box-shadow:0 0 16px rgba(200,146,42,.7);}}";
document.head.appendChild(_s);

// ── FETCH ─────────────────────────────────────────────────────────────────────
function fetchNarrative(card) {
  var ev = card.events || [];
  var a = [], t = [], c = [];
  ev.forEach(function(e) {
    if (e.type === "artist"  && a.indexOf(e.name) < 0) a.push(e.name);
    if (e.type === "team"    && t.indexOf(e.name) < 0) t.push(e.name);
    if (e.type === "comedy"  && c.indexOf(e.name) < 0) c.push(e.name);
  });
  var parts = [];
  if (a.length) parts.push(a.join(", "));
  if (t.length) parts.push(t.join(", ") + " (sports)");
  if (c.length) parts.push(c.join(", ") + " (comedy)");
  var all = parts.join(" + ") || "various events";
  var d = card.firstDate || card.start || "";

  var nb = buildNarrativePrompt(card, all, d);

  return fetch("/.netlify/functions/narrative", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: nb.prompt, system: nb.system })
  }).then(function(r) { return r.json(); })
    .then(function(d) { return d.text || null; })
    .catch(function() { return null; });
}

// ── ATTACH ────────────────────────────────────────────────────────────────────
function attachNarratives(results) {
  // Clear narratives from previous search
  document.querySelectorAll(".cn").forEach(function(el) { el.remove(); });
  var mc = document.querySelectorAll(".mcard");
  results.slice(0, 6).forEach(function(card, i) {
    var el = mc[i];
    if (!el) return;
    var div = document.createElement("div");
    div.className = "cn";
    div.textContent = "...";
    el.appendChild(div);
    fetchNarrative(card).then(function(txt) {
      if (txt) { div.textContent = txt; div.classList.add("ready"); }
      else div.remove();
    });
  });
}
