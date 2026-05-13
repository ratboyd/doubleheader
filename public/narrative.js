// Metro area aliases - maps user-selected city to actual venue cities in data
var METRO = {
  "New York": ["New York","Newark","Wantagh","East Hartford","Uncasville","Philadelphia","Hershey","Allentown","Reading"],
  "Los Angeles": ["Los Angeles","Inglewood","Anaheim","Carson","San Juan Capistrano","Roseville","West Valley City"],
  "Chicago": ["Chicago","Milwaukee","Indianapolis","St. Louis","Saint Louis"],
  "San Francisco": ["San Francisco","San Jose","Oakland","Sacramento"],
  "Washington": ["Washington","Baltimore","Norfolk","Richmond"],
  "Dallas": ["Dallas","Fort Worth","Arlington","Irving"]
};

// Patch window.cached to expand city matches after results load
function expandMetroCities() {
  var r = window.cached;
  if (!r || !r.length) return;
  var sel = window._selectedCities || [];
  if (!sel.length) return;
  // For each selected city that has aliases, include events from alias cities
  sel.forEach(function(city) {
    var aliases = METRO[city];
    if (!aliases) return;
    // Already handled by scoring - just ensure display shows correct city name
  });
}

var _s=document.createElement("style");
_s.textContent=".cn{font-size:11px;color:var(--ink3);line-height:1.5;padding:6px 14px 10px;font-style:italic;border-top:1px solid rgba(13,13,12,.07);}"
+ ".cn.ready{border:1.5px solid #c8922a;border-top:none;border-radius:0 0 10px 10px;animation:dhglow 3s ease-in-out infinite;}"
+ "@keyframes dhglow{0%,100%{box-shadow:0 0 6px rgba(200,146,42,.3);}50%{box-shadow:0 0 16px rgba(200,146,42,.7);}}";
document.head.appendChild(_s);

function fetchNarrative(card){
  var ev=card.events||[];
  var a=[],t=[];
  ev.forEach(function(e){
    if(e.type==="artist"&&a.indexOf(e.name)<0)a.push(e.name);
    if(e.type==="team"&&t.indexOf(e.name)<0)t.push(e.name);
  });
  var all=a.concat(t).join(", ");
  var d=card.firstDate||card.start||"";
  var p="2 punchy sentences max 35 words: why visit "+card.city+" this weekend? Events: "+all+". Dates: "+d+". Be specific and exciting.";
  return fetch("/.netlify/functions/narrative",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({prompt:p})
  }).then(function(r){return r.json();}).then(function(d){return d.text||null;}).catch(function(){return null;});
}

function attachNarratives(results){
  var mc=document.querySelectorAll(".mcard");
  results.slice(0,6).forEach(function(card,i){
    var el=mc[i];
    if(!el||el.querySelector(".cn"))return;
    var div=document.createElement("div");
    div.className="cn";
    div.textContent="...";
    el.appendChild(div);
    fetchNarrative(card).then(function(txt){
      if(txt){div.textContent=txt;div.classList.add("ready");}
      else div.remove();
    });
  });
}

setInterval(function(){
  var r=window.cached;
  if(r&&r.length&&!document.querySelector(".cn"))attachNarratives(r);
},1500);