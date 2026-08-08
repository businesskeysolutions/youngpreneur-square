/* ============================================================================
   THE SQUARE PASS — on-device engagement game (Phase 1)
   Collect stamps (daily check-in + streak, visit a storefront, find the hidden
   symbol, vote, explore) → your skyline lights up → weekly prize-drawing entries.
   Works standalone via localStorage; syncs to Supabase RPCs when available.
   Self-contained: injects its own styles, so it runs on every page.
   ========================================================================== */
(function () {
  if (window.__squarePass) return; window.__squarePass = true;

  var LS = 'yps_squarepass_v1';
  var GOAL = 40; // skyline windows

  function iso(d){ return d.toISOString().slice(0,10); }
  function today(){ return iso(new Date()); }
  function yesterday(){ var d=new Date(); d.setDate(d.getDate()-1); return iso(d); }
  function weekStart(){ var d=new Date(); var wd=(d.getDay()+6)%7; d.setDate(d.getDate()-wd); return iso(d); }
  function load(){ try { return JSON.parse(localStorage.getItem(LS)); } catch(e){ return null; } }
  function persist(){ try { localStorage.setItem(LS, JSON.stringify(pass)); } catch(e){} }

  var pass = load() || { email:'', stamps:[], streak:0, last:'' };
  if(!pass.stamps) pass.stamps = [];

  var STAMP_LABEL = {
    checkin:'Daily check-in', visit:'Visited a storefront', hunt:'Found the Square token',
    vote:'Cast a vote', explore:'Explored the Square'
  };

  function hasStamp(k, ref){ return pass.stamps.some(function(s){ return s.k===k && s.ref===ref; }); }
  function weekCount(){ var ws=weekStart(); return pass.stamps.filter(function(s){ return (s.ts||'').slice(0,10) >= ws; }).length; }
  function kindThisWeek(k){ var ws=weekStart(); return pass.stamps.some(function(s){ return s.k===k && (s.ts||'').slice(0,10)>=ws; }); }

  function syncStamp(k, ref){
    try {
      if (window.SQ_DB && pass.email) {
        window.SQ_DB.rpc('passport_stamp', { p_email: pass.email, p_kind: k, p_ref: String(ref||'') }).then(function(){}, function(){});
      }
    } catch(e){}
  }

  // Award a stamp (idempotent by kind+ref). Returns true if newly earned.
  function stamp(k, ref, silent){
    ref = String(ref==null ? '' : ref);
    if (hasStamp(k, ref)) return false;
    pass.stamps.push({ k:k, ref:ref, ts:new Date().toISOString() });
    persist(); syncStamp(k, ref);
    if (!silent) toast('★ Stamp earned — ' + (STAMP_LABEL[k]||k) + '  ·  +1 entry');
    render();
    return true;
  }

  // ---- daily check-in + streak ----
  function checkin(){
    var t = today();
    if (pass.last !== t){
      pass.streak = (pass.last === yesterday()) ? (pass.streak||0)+1 : 1;
      pass.last = t; persist();
      stamp('checkin', t, true);
      try { if (window.SQ_DB && pass.email) window.SQ_DB.rpc('passport_checkin', { p_email: pass.email }).then(function(){},function(){}); } catch(e){}
    }
  }

  /* ---------------- styles ---------------- */
  var CSS = `
  .sqp-fab{position:fixed;right:18px;bottom:18px;z-index:9000;display:flex;align-items:center;gap:9px;
    font-family:"Work Sans",system-ui,sans-serif;font-weight:700;font-size:12.5px;letter-spacing:.06em;text-transform:uppercase;
    color:#14231A;background:linear-gradient(180deg,#F1DEA2,#C9A84A);border:none;border-radius:30px;padding:11px 16px;cursor:pointer;
    box-shadow:0 8px 26px rgba(0,0,0,.4),0 0 0 1px rgba(201,168,74,.5)}
  .sqp-fab:hover{transform:translateY(-2px)}
  .sqp-fab .sqp-star{font-size:15px;line-height:1}
  .sqp-fab .sqp-badge{background:#0A0D0B;color:#E9CF8A;border-radius:20px;font-size:11px;padding:2px 8px;min-width:20px;text-align:center}
  .sqp-scrim{position:fixed;inset:0;z-index:9001;background:rgba(4,7,5,.62);backdrop-filter:blur(3px);display:none;align-items:flex-end;justify-content:center}
  .sqp-scrim.open{display:flex}
  .sqp-panel{width:100%;max-width:440px;background:#0C120E;border:1px solid rgba(201,168,74,.3);border-radius:16px 16px 0 0;
    box-shadow:0 -18px 60px rgba(0,0,0,.6);padding:16px 16px 22px;color:#F5F1E6;font-family:"Work Sans",system-ui,sans-serif;
    max-height:92vh;overflow:auto}
  @media(min-width:560px){.sqp-scrim{align-items:center}.sqp-panel{border-radius:16px}}
  .sqp-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  .sqp-head h3{font-family:"Playfair Display",Georgia,serif;font-weight:800;font-size:18px;text-transform:uppercase;letter-spacing:.02em;margin:0}
  .sqp-x{background:none;border:none;color:#9AA79A;font-size:20px;cursor:pointer;line-height:1}
  .sqp-card{position:relative;border-radius:12px;padding:16px 16px 14px;overflow:hidden;
    background:linear-gradient(135deg,#E9CF8A,#C9A84A 60%,#A9863A);color:#14231A;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}
  .sqp-card .sqp-swipe{position:absolute;top:0;bottom:0;right:34px;width:16px;background:linear-gradient(180deg,#3a2f14,#171208)}
  .sqp-card .sqp-brand{font-family:"Alfa Slab One",Georgia,serif;font-size:15px;letter-spacing:.02em;text-transform:uppercase}
  .sqp-card .sqp-sub{font-weight:600;font-size:10px;letter-spacing:.22em;text-transform:uppercase;opacity:.75;margin-top:1px}
  .sqp-card .sqp-holder{margin-top:16px;font-weight:700;font-size:13px;letter-spacing:.04em}
  .sqp-card .sqp-meta{display:flex;gap:16px;margin-top:8px;font-weight:600;font-size:11px;letter-spacing:.04em}
  .sqp-card .sqp-meta b{font-size:16px;font-family:"Playfair Display",Georgia,serif}
  .sqp-sky{display:flex;align-items:flex-end;gap:3px;height:70px;margin:14px 0 6px;padding:0 2px}
  .sqp-bldg{flex:1;background:#0a1410;border:1px solid rgba(201,168,74,.16);border-bottom:none;border-radius:2px 2px 0 0;
    display:flex;flex-wrap:wrap;align-content:flex-start;gap:2px;padding:3px}
  .sqp-win{width:4px;height:4px;border-radius:1px;background:rgba(245,241,230,.08)}
  .sqp-win.lit{background:#F1DEA2;box-shadow:0 0 5px rgba(233,207,138,.9)}
  .sqp-sky-cap{font-size:11px;color:#9AA79A;text-align:center;margin-bottom:12px}
  .sqp-sky-cap b{color:#E9CF8A}
  .sqp-tasks{list-style:none;margin:6px 0 0;padding:0}
  .sqp-tasks li{display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid rgba(201,168,74,.12);font-size:14px}
  .sqp-tasks li .tk{width:20px;height:20px;border-radius:50%;border:1.5px solid rgba(201,168,74,.5);display:flex;align-items:center;justify-content:center;font-size:12px;color:#0A0D0B;flex:0 0 auto}
  .sqp-tasks li.done .tk{background:#7AD03A;border-color:#7AD03A}
  .sqp-tasks li .tx{flex:1;color:#EFE9D8}
  .sqp-tasks li.done .tx{color:#9AA79A}
  .sqp-tasks li .hint{font-size:11px;color:#7c8b7a}
  .sqp-email{margin-top:14px;background:rgba(245,241,230,.05);border:1px solid rgba(201,168,74,.2);border-radius:8px;padding:12px}
  .sqp-email p{margin:0 0 8px;font-size:12.5px;color:#B9C3B4;line-height:1.4}
  .sqp-email form{display:flex;gap:8px}
  .sqp-email input{flex:1;min-width:0;background:rgba(10,13,11,.6);border:1px solid rgba(201,168,74,.25);border-radius:6px;padding:9px 11px;color:#F5F1E6;font-size:13px}
  .sqp-email button{background:linear-gradient(180deg,#E9CF8A,#C9A84A);border:none;border-radius:6px;padding:0 14px;font-weight:700;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#14231A;cursor:pointer}
  .sqp-email.saved{border-color:rgba(122,208,58,.4)}
  .sqp-note{font-size:11px;color:#7c8b7a;text-align:center;margin-top:12px;line-height:1.5}
  .sqp-toast{position:fixed;left:50%;bottom:84px;transform:translateX(-50%) translateY(14px);z-index:9002;
    background:#12331A;color:#F5F1E6;border:1px solid rgba(201,168,74,.5);border-radius:24px;padding:10px 18px;font-family:"Work Sans",system-ui,sans-serif;
    font-weight:600;font-size:13px;box-shadow:0 10px 30px rgba(0,0,0,.5);opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;white-space:nowrap}
  .sqp-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
  .sq-hidden{position:fixed;z-index:8500;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;
    font-family:"Alfa Slab One",Georgia,serif;font-size:11px;line-height:1;color:rgba(233,207,138,.34);border:2px solid rgba(233,207,138,.30);
    background:rgba(201,168,74,.05);cursor:pointer;transition:color .2s,border-color .2s,transform .2s,box-shadow .2s;user-select:none}
  .sq-hidden:hover{color:#14231A;background:linear-gradient(180deg,#F1DEA2,#C9A84A);border-color:#E9CF8A;transform:scale(1.25);box-shadow:0 0 14px rgba(233,207,138,.75)}
  `;

  /* ---------------- DOM ---------------- */
  var scrim, fab, toastEl, toastTimer;

  function el(tag, cls, html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }

  function build(){
    var style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);

    fab = el('button','sqp-fab','<span class="sqp-star">★</span> Square Pass <span class="sqp-badge" id="sqpBadge">0</span>');
    fab.addEventListener('click', open);
    document.body.appendChild(fab);

    scrim = el('div','sqp-scrim');
    scrim.addEventListener('click', function(e){ if(e.target===scrim) close(); });
    scrim.appendChild(el('div','sqp-panel'));
    document.body.appendChild(scrim);

    toastEl = el('div','sqp-toast'); document.body.appendChild(toastEl);

    placeHiddenSymbol();
    render();
  }

  function initial(){ return (pass.email ? pass.email[0] : 'Y').toUpperCase(); }

  function render(){
    var badge = document.getElementById('sqpBadge'); if(badge) badge.textContent = weekCount();
    var panel = scrim && scrim.querySelector('.sqp-panel'); if(!panel) return;
    var total = pass.stamps.length, lit = Math.min(total, GOAL);
    // skyline: 6 buildings, GOAL windows total
    var perB = Math.ceil(GOAL/6), sky='';
    for(var b=0;b<6;b++){
      var wins='';
      for(var w=0; w<perB; w++){ var idx=b*perB+w; wins += '<span class="sqp-win'+(idx<lit?' lit':'')+'"></span>'; }
      sky += '<div class="sqp-bldg" style="height:'+(38+((b*13)%46))+'px">'+wins+'</div>';
    }
    var tasks = [
      { k:'checkin', label:'Check in today', done: pass.last===today(), hint:'Streak '+(pass.streak||0)+'🔥' },
      { k:'visit',   label:'Visit a storefront', done: kindThisWeek('visit'), hint:'Open any shop ↗' },
      { k:'hunt',    label:'Find the hidden Square token', done: hasStamp('hunt',today()), hint:'A little gold coin, hidden on the page' },
      { k:'vote',    label:'Vote for Business of the Week', done: kindThisWeek('vote'), hint:'On Ignition Day' },
      { k:'explore', label:'Explore the Square', done: kindThisWeek('explore'), hint:'Enter the walkable Square' }
    ];
    var taskHtml = tasks.map(function(t){
      return '<li class="'+(t.done?'done':'')+'"><span class="tk">'+(t.done?'✓':'')+'</span>'+
             '<span class="tx">'+t.label+'</span><span class="hint">'+(t.done?'':t.hint)+'</span></li>';
    }).join('');
    var emailBlock = pass.email
      ? '<div class="sqp-email saved"><p>✓ Saved to <b>'+pass.email.replace(/</g,'')+'</b>. Your entries are locked in for the weekly drawing.</p></div>'
      : '<div class="sqp-email"><p>Add your email to save your pass across devices and lock in your prize-drawing entries.</p>'+
        '<form id="sqpEmailForm"><input type="email" id="sqpEmail" placeholder="you@email.com" aria-label="Email"><button type="submit">Activate</button></form></div>';

    panel.innerHTML =
      '<div class="sqp-head"><h3>The Square Pass</h3><button class="sqp-x" aria-label="Close">✕</button></div>'+
      '<div class="sqp-card"><div class="sqp-swipe"></div>'+
        '<div class="sqp-brand">The Square Pass</div><div class="sqp-sub">Youngpreneur Square · Swipe in</div>'+
        '<div class="sqp-holder">'+ (pass.email ? pass.email : 'Guest pass') +'</div>'+
        '<div class="sqp-meta"><span>Streak<br><b>'+(pass.streak||0)+'</b></span><span>This week<br><b>'+weekCount()+'</b> entries</span><span>Total stamps<br><b>'+total+'</b></span></div>'+
      '</div>'+
      '<div class="sqp-sky">'+sky+'</div>'+
      '<div class="sqp-sky-cap">Your skyline: <b>'+lit+'</b> / '+GOAL+' lights on</div>'+
      '<ul class="sqp-tasks">'+taskHtml+'</ul>'+
      emailBlock+
      '<div class="sqp-note">Collect stamps to light your skyline. Every stamp is an entry in this week\'s drawing. New week, fresh entries.</div>';

    panel.querySelector('.sqp-x').addEventListener('click', close);
    var ef = panel.querySelector('#sqpEmailForm');
    if(ef) ef.addEventListener('submit', function(e){
      e.preventDefault();
      var v = (panel.querySelector('#sqpEmail').value||'').trim();
      if(v.indexOf('@')<1){ toast('Enter a valid email.'); return; }
      pass.email = v; persist();
      try { if(window.SQ_DB){ window.SQ_DB.rpc('passport_checkin',{p_email:v}).then(function(){},function(){}); pass.stamps.forEach(function(s){ syncStamp(s.k, s.ref); }); } } catch(err){}
      toast('★ Square Pass activated');
      render();
    });
  }

  function open(){ render(); scrim.classList.add('open'); }
  function close(){ scrim.classList.remove('open'); }

  function toast(msg){
    if(!toastEl) return;
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function(){ toastEl.classList.remove('show'); }, 2600);
  }

  // ---- hidden symbol (daily hunt): a subtle ✦ placed at a date-seeded spot ----
  function placeHiddenSymbol(){
    if(document.querySelector('.sq-hidden')) return;
    var seed = 0, s = today()+location.pathname;
    for(var i=0;i<s.length;i++) seed = (seed*31 + s.charCodeAt(i)) & 0xffffff;
    var top = 22 + (seed % 60);           // 22%–82%
    var left = 8 + ((seed>>4) % 84);      // 8%–92%
    var sym = el('span','sq-hidden','Y');
    sym.style.top = top+'vh'; sym.style.left = left+'vw';
    sym.title = 'A hidden Square token…';
    sym.addEventListener('click', function(){
      if(stamp('hunt', today())) { toast('◎ You found the Square token!'); }
      sym.style.display='none';
      open();
    });
    document.body.appendChild(sym);
  }

  // ---- global stamp hooks ----
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a');
    if(a){
      var ext = a.target==='_blank' && a.href && a.hostname && a.hostname!==location.hostname;
      if(ext) stamp('visit', a.hostname);
    }
    if(e.target.closest && e.target.closest('.vbtn')) stamp('vote', weekStart());
    if(e.target.closest && e.target.closest('.enter-square, .balldrop-open')) stamp('explore', 'square');
  }, true);

  // boot
  function start(){ checkin(); build(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  // expose a tiny API (for future Build-Your-Block / manual stamps)
  window.SquarePass = { stamp: stamp, open: open, get: function(){ return JSON.parse(JSON.stringify(pass)); } };
})();
