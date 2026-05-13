var s=document.createElement("style");
s.textContent=".cn.loaded{border-top:none;border-radius:0 0 10px 10px;border:1.5px solid #c8922a;animation:dhglow 3s ease-in-out infinite;}
@keyframes dhglow{0%,100%{box-shadow:0 0 6px rgba(200,146,42,.3);}50%{box-shadow:0 0 16px rgba(200,146,42,.7);}}";
document.head.appendChild(s);
function fetchNarrative(card){
  var events=card.events||[];var artists=[];var teams=[];
  events.forEach(function(e){if(e.type==="artist"&&artists.indexOf(e.name)<0)artists.push(e.name);if(e.type==="team"&&teams.indexOf(e.name)<0)teams.push(e.name);});
  var all=artists.concat(teams).join(", ");
  var prompt="2 punchy sentences max 35 words: why visit "+card.city+" this weekend? Events: "+all+". Dates: "+(card.firstDate||card.start)+". Be specific and exciting.";
  return fetch("/.netlify/functions/narrative",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:prompt})})
    .then(function(r){return r.json();}).then(function(d){return d.text||null;}).catch(function(){return null;});
}
function attachNarratives(results){
  var mcards=document.querySelectorAll(".mcard");
  results.slice(0,6).forEach(function(card,i){
    var el=mcards[i];if(!el||el.querySelector(".cn"))return;
    var div=document.createElement("div");div.className="cn";
    div.style.cssText="font-size:11px;color:var(--ink2);line-height:1.5;padding:6px 14px 10px;font-style:italic;";
    div.textContent="...";el.appendChild(div);
    fetchNarrative(card).then(function(t){if(t){div.textContent=t;div.classList.add("loaded");}else div.remove();});
  });
}
setInterval(function(){var r=window.cached;if(r&&r.length&&!document.querySelector(".cn"))attachNarratives(r);},1500);