/* ============================================================================
   THE SQUARE PASS — on-device engagement game
   Phase 1: Collect stamps (daily check-in + streak, visit a storefront, find the
   hidden Square token, vote, explore) -> your skyline lights up -> weekly
   prize-drawing entries. Prize entries are ALWAYS free, earned only.
   Phase A: Bricks — a cosmetic-only currency you EARN from stamps and spend on
   Build-Your-Block decorations. Bricks never touch prize entries (the wall).
   Build-Your-Block lives on its own page (block.html); the pass popup only
   introduces it and links there. SquarePass.mountBlock(el) renders the full
   builder into any container.
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
  function huntRef(){ return today()+':'+location.pathname; }   // per-page-per-day token
  function load(){ try { return JSON.parse(localStorage.getItem(LS)); } catch(e){ return null; } }
  function persist(){ try { localStorage.setItem(LS, JSON.stringify(pass)); } catch(e){} }

  var pass = load() || { email:'', stamps:[], streak:0, last:'' };
  if(!pass.stamps) pass.stamps = [];
  // --- Bricks jar (cosmetic-only). Separate from stamps/entries. ---
  if(typeof pass.bricks !== 'number') pass.bricks = 20;   // small starter grant
  if(!pass.owned) pass.owned = [];                        // owned cosmetic ids
  if(!pass.equipped) pass.equipped = {};                  // { slot: itemId }
  var view = 'pass'; // 'pass' | 'block'

  var STAMP_LABEL = {
    checkin:'Daily check-in', visit:'Visited a storefront', hunt:'Found the Square token',
    vote:'Cast a vote', explore:'Explored the Square'
  };
  // Bricks earned per newly-earned stamp (cosmetic currency only).
  var BRICK_REWARD = { checkin:5, visit:5, hunt:8, vote:10, explore:6 };

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
    // Earn Bricks (cosmetic jar). Does NOT affect entries — entries are the count
    // of stamps in the current week and stay free/earned-only.
    var earned = BRICK_REWARD[k] || 5;
    pass.bricks += earned;
    persist(); syncStamp(k, ref);
    if (!silent) toast('★ Stamp earned — ' + (STAMP_LABEL[k]||k) + '  ·  +1 entry  ·  +' + earned + ' 🧱');
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

  /* ---------------- Build-Your-Block: cosmetics catalog ----------------
     Every item is "see exactly what you buy" (no random boxes). Slots are
     single-select; equipping sets pass.equipped[slot] = id. Bricks are the
     only cost, and they only ever spend here — never on prize entries. */
  var SHOP = [
    { id:'fac_green',   slot:'facade',   name:'Forest Brick',    price:0,  free:true,  css:'#14231A' },
    { id:'fac_brown',   slot:'facade',   name:'Brownstone',      price:30,            css:'#5a3a2a' },
    { id:'fac_cream',   slot:'facade',   name:'Cream Classic',   price:30,            css:'#cbbf9e' },
    { id:'fac_red',     slot:'facade',   name:'Brick Red',       price:35,            css:'#7a2f28' },
    { id:'awn_none',    slot:'awning',   name:'No Awning',       price:0,  free:true,  css:'' },
    { id:'awn_green',   slot:'awning',   name:'Green Awning',    price:20,            css:'#2F9E44' },
    { id:'awn_stripe',  slot:'awning',   name:'Striped Awning',  price:25,            css:'repeating-linear-gradient(90deg,#E8433B 0 12px,#F5F1E6 12px 24px)' },
    { id:'awn_gold',    slot:'awning',   name:'Gold Awning',     price:30,            css:'linear-gradient(180deg,#F1DEA2,#C9A84A)' },
    { id:'lit_none',    slot:'lights',   name:'No Lights',       price:0,  free:true,  css:'' },
    { id:'lit_string',  slot:'lights',   name:'String Lights',   price:20,            css:'#F1DEA2' },
    { id:'lit_neon',    slot:'lights',   name:'Neon Glow',       price:40,            css:'#7AD03A' },
    { id:'drs_none',    slot:'dressing', name:'Bare Sidewalk',   price:0,  free:true,  emoji:'' },
    { id:'drs_planter', slot:'dressing', name:'Planter',         price:15,            emoji:'🪴' },
    { id:'drs_bench',   slot:'dressing', name:'Bench',           price:15,            emoji:'🪑' },
    { id:'drs_tree',    slot:'dressing', name:'Street Tree',     price:20,            emoji:'🌳' },
    { id:'cov_gold',    slot:'cover',    name:'Gold Cover',      price:0,  free:true,  css:'linear-gradient(135deg,#E9CF8A,#C9A84A 60%,#A9863A)' },
    { id:'cov_night',   slot:'cover',    name:'Midnight Cover',  price:50,            css:'linear-gradient(135deg,#26324a,#141d2e 60%,#0b1220)', ink:'#EFE9D8' },
    { id:'cov_lime',    slot:'cover',    name:'Lime Marquee',    price:50,            css:'linear-gradient(135deg,#8fe25a,#4fae1f 60%,#2f7d1f)', ink:'#0A0D0B' }
  ];
  var SLOTS = [
    { slot:'facade',   label:'Facade' },
    { slot:'awning',   label:'Awning' },
    { slot:'lights',   label:'Lights' },
    { slot:'dressing', label:'Sidewalk' },
    { slot:'cover',    label:'Pass cover' }
  ];
  function item(id){ for(var i=0;i<SHOP.length;i++){ if(SHOP[i].id===id) return SHOP[i]; } return null; }
  function owns(id){ var it=item(id); return !!(it && (it.free || pass.owned.indexOf(id)>=0)); }
  function equippedIn(slot){
    var id = pass.equipped[slot];
    if(id && owns(id)) return item(id);
    for(var i=0;i<SHOP.length;i++){ if(SHOP[i].slot===slot && SHOP[i].free) return SHOP[i]; }
    return null;
  }

  function buy(id){
    var it = item(id); if(!it) return;
    if(owns(id)){ equip(id); return; }
    if(pass.bricks < it.price){ toast('Not enough Bricks — earn more by collecting stamps.'); return; }
    pass.bricks -= it.price;
    pass.owned.push(id);
    pass.equipped[it.slot] = id;
    persist();
    toast('🧱 Bought & placed — ' + it.name);
    render();
  }
  function equip(id){
    var it = item(id); if(!it || !owns(id)) return;
    pass.equipped[it.slot] = id; persist();
    toast('Placed — ' + it.name);
    render();
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
  .sqp-tabs{display:flex;gap:6px;margin-bottom:12px}
  .sqp-tab{flex:1;background:rgba(245,241,230,.05);border:1px solid rgba(201,168,74,.22);border-radius:9px;padding:9px 8px;
    color:#B9C3B4;font-weight:700;font-size:12px;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;text-align:center}
  .sqp-tab.active{background:linear-gradient(180deg,#E9CF8A,#C9A84A);border-color:#E9CF8A;color:#14231A}
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
    font-weight:600;font-size:13px;box-shadow:0 10px 30px rgba(0,0,0,.5);opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis}
  .sqp-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
  .sq-hidden{position:fixed;z-index:8500;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;
    font-family:"Alfa Slab One",Georgia,serif;font-size:11px;line-height:1;color:rgba(233,207,138,.34);border:2px solid rgba(233,207,138,.30);
    background:rgba(201,168,74,.05);cursor:pointer;transition:color .2s,border-color .2s,transform .2s,box-shadow .2s;user-select:none}
  .sq-hidden:hover{color:#14231A;background:linear-gradient(180deg,#F1DEA2,#C9A84A);border-color:#E9CF8A;transform:scale(1.25);box-shadow:0 0 14px rgba(233,207,138,.75)}

  /* --- Bricks wallet --- */
  .sqp-wallet{display:flex;align-items:center;justify-content:space-between;margin:2px 0 12px;
    background:rgba(245,241,230,.05);border:1px solid rgba(201,168,74,.22);border-radius:10px;padding:11px 13px}
  .sqp-wallet .bal{display:flex;align-items:center;gap:8px;font-weight:700;font-size:15px;color:#F1DEA2}
  .sqp-wallet .bal .lbl{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#9AA79A}
  .sqp-wallet .buy{background:rgba(10,13,11,.55);border:1px dashed rgba(201,168,74,.4);border-radius:20px;color:#9AA79A;
    font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:6px 11px;cursor:not-allowed}

  /* --- storefront preview --- */
  .sqp-lot{background:linear-gradient(180deg,#0a1410,#0f1a13);border:1px solid rgba(201,168,74,.16);border-radius:12px;
    padding:16px 12px 0;overflow:hidden}
  .sqp-store{position:relative;width:180px;max-width:70%;margin:0 auto;height:130px;border-radius:6px 6px 0 0;
    box-shadow:inset 0 0 0 1px rgba(0,0,0,.25)}
  .sqp-store .sqp-strlights{position:absolute;top:-9px;left:-6px;right:-6px;height:10px;display:flex;justify-content:space-around;align-items:center}
  .sqp-store .sqp-strlights i{width:6px;height:6px;border-radius:50%;display:block}
  .sqp-store .sqp-win2{position:absolute;top:16px;width:26px;height:26px;border-radius:3px;background:rgba(241,222,162,.85);box-shadow:0 0 8px rgba(241,222,162,.5)}
  .sqp-store .w-l{left:22px}.sqp-store .w-r{right:22px}
  .sqp-store .sqp-door2{position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:44px;height:58px;
    background:#20140c;border-radius:4px 4px 0 0;box-shadow:inset 0 0 0 2px rgba(0,0,0,.3)}
  .sqp-store .sqp-awn{position:absolute;left:50%;transform:translateX(-50%);width:70px;height:16px;border-radius:3px;bottom:58px}
  .sqp-store .sqp-sign{position:absolute;top:50px;left:50%;transform:translateX(-50%);font-family:"Alfa Slab One",Georgia,serif;
    font-size:10px;letter-spacing:.04em;color:#F5F1E6;text-shadow:0 1px 2px rgba(0,0,0,.6);white-space:nowrap}
  .sqp-side{display:flex;align-items:flex-end;justify-content:center;gap:8px;height:34px;margin-top:2px;
    border-top:3px solid #2a2118;background:repeating-linear-gradient(90deg,#20293f 0 18px,#1a2233 18px 20px);font-size:22px;line-height:1}
  .sqp-blocknote{font-size:11px;color:#7c8b7a;text-align:center;margin:10px 2px 4px;line-height:1.5}
  .sqp-blocknote b{color:#7AD03A}

  /* --- shop --- */
  .sqp-shop{margin-top:14px}
  .sqp-slot-h{font-family:"Work Sans",sans-serif;font-weight:700;font-size:11px;letter-spacing:.08em;text-transform:uppercase;
    color:#9AA79A;margin:14px 0 7px}
  .sqp-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
  .sqp-shopitem{background:rgba(245,241,230,.04);border:1px solid rgba(201,168,74,.18);border-radius:9px;padding:9px;
    display:flex;align-items:center;gap:9px}
  .sqp-shopitem.equipped{border-color:#7AD03A;box-shadow:0 0 0 1px rgba(122,208,58,.35)}
  .sqp-sw{width:30px;height:30px;border-radius:6px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;
    font-size:18px;line-height:1;box-shadow:inset 0 0 0 1px rgba(0,0,0,.25)}
  .sqp-shopitem .nm{flex:1;min-width:0}
  .sqp-shopitem .nm b{display:block;font-size:12px;color:#EFE9D8;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sqp-shopitem .nm span{font-size:11px;color:#C9A84A;font-weight:700}
  .sqp-shopitem .nm span.free{color:#7c8b7a;font-weight:600}
  .sqp-act{border:none;border-radius:16px;padding:6px 10px;font-size:10.5px;font-weight:700;letter-spacing:.04em;
    text-transform:uppercase;cursor:pointer;flex:0 0 auto}
  .sqp-act.buy{background:linear-gradient(180deg,#E9CF8A,#C9A84A);color:#14231A}
  .sqp-act.buy:disabled{background:rgba(245,241,230,.08);color:#6f7a6d;cursor:not-allowed}
  .sqp-act.eq{background:rgba(122,208,58,.14);color:#9fe06a;border:1px solid rgba(122,208,58,.4)}
  .sqp-act.on{background:#7AD03A;color:#0A0D0B;cursor:default}

  /* --- compact intro (popup) --- */
  .sqp-introcta{display:block;text-align:center;margin-top:12px;background:linear-gradient(180deg,#E9CF8A,#C9A84A);
    color:#14231A;font-weight:800;font-size:12.5px;letter-spacing:.05em;text-transform:uppercase;text-decoration:none;
    border-radius:24px;padding:12px 16px}

  /* --- full Build-Your-Block page mount --- */
  .sqp-page .sqp-store{width:280px;height:200px}
  .sqp-page .sqp-store .sqp-win2{width:38px;height:38px;top:24px}
  .sqp-page .sqp-store .w-l{left:34px}.sqp-page .sqp-store .w-r{right:34px}
  .sqp-page .sqp-store .sqp-door2{width:64px;height:86px}
  .sqp-page .sqp-store .sqp-awn{width:104px;height:22px;bottom:86px}
  .sqp-page .sqp-store .sqp-sign{top:78px;font-size:13px}
  .sqp-page .sqp-side{height:48px;font-size:30px}
  .sqp-page .sqp-lot{max-width:560px;margin:0 auto;padding:26px 16px 0}
  .sqp-page .sqp-grid{grid-template-columns:repeat(auto-fill,minmax(190px,1fr))}
  .sqp-page .sqp-wallet{max-width:560px;margin:0 auto 16px}
  .sqp-page .sqp-shop{max-width:560px;margin:18px auto 0}
  .sqp-page .sqp-blocknote{max-width:560px;margin:14px auto 0;font-size:12.5px}
  `;

  /* ---------------- DOM ---------------- */
  var scrim, fab, toastEl, toastTimer, blockMount=null;

  function el(tag, cls, html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

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

  /* ---- pass (prize) view ---- */
  function passViewHtml(){
    var total = pass.stamps.length, lit = Math.min(total, GOAL);
    var perB = Math.ceil(GOAL/6), sky='';
    for(var b=0;b<6;b++){
      var wins='';
      for(var w=0; w<perB; w++){ var idx=b*perB+w; wins += '<span class="sqp-win'+(idx<lit?' lit':'')+'"></span>'; }
      sky += '<div class="sqp-bldg" style="height:'+(38+((b*13)%46))+'px">'+wins+'</div>';
    }
    var tasks = [
      { k:'checkin', label:'Check in today', done: pass.last===today(), hint:'Streak '+(pass.streak||0)+'🔥' },
      { k:'visit',   label:'Visit a storefront', done: kindThisWeek('visit'), hint:'Open any shop ↗' },
      { k:'hunt',    label:'Find the hidden Square token', done: hasStamp('hunt',huntRef()), hint:'A gold coin, hidden on each page' },
      { k:'vote',    label:'Vote for Business of the Week', done: kindThisWeek('vote'), hint:'On Ignition Day' },
      { k:'explore', label:'Explore the Square', done: kindThisWeek('explore'), hint:'Enter the walkable Square' }
    ];
    var taskHtml = tasks.map(function(t){
      return '<li class="'+(t.done?'done':'')+'"><span class="tk">'+(t.done?'✓':'')+'</span>'+
             '<span class="tx">'+t.label+'</span><span class="hint">'+(t.done?'':t.hint)+'</span></li>';
    }).join('');
    var cover = equippedIn('cover');
    var coverCss = cover ? cover.css : 'linear-gradient(135deg,#E9CF8A,#C9A84A 60%,#A9863A)';
    var coverInk = (cover && cover.ink) ? cover.ink : '#14231A';
    var emailBlock = pass.email
      ? '<div class="sqp-email saved"><p>✓ Saved to <b>'+esc(pass.email)+'</b>. Your entries are locked in for the weekly drawing.</p></div>'
      : '<div class="sqp-email"><p>Add your email to save your pass across devices and lock in your prize-drawing entries.</p>'+
        '<form id="sqpEmailForm"><input type="email" id="sqpEmail" placeholder="you@email.com" aria-label="Email"><button type="submit">Activate</button></form></div>';
    return (
      '<div class="sqp-card" style="background:'+coverCss+';color:'+coverInk+'"><div class="sqp-swipe"></div>'+
        '<div class="sqp-brand">The Square Pass</div><div class="sqp-sub">Youngpreneur Square · Swipe in</div>'+
        '<div class="sqp-holder">'+ (pass.email ? esc(pass.email) : 'Guest pass') +'</div>'+
        '<div class="sqp-meta"><span>Streak<br><b>'+(pass.streak||0)+'</b></span><span>This week<br><b>'+weekCount()+'</b> entries</span><span>Total stamps<br><b>'+total+'</b></span></div>'+
      '</div>'+
      '<div class="sqp-sky">'+sky+'</div>'+
      '<div class="sqp-sky-cap">Your skyline: <b>'+lit+'</b> / '+GOAL+' lights on</div>'+
      '<ul class="sqp-tasks">'+taskHtml+'</ul>'+
      emailBlock+
      '<div class="sqp-note">Collect stamps to light your skyline. Every stamp is an entry in this week\'s drawing — always free. New week, fresh entries.</div>'
    );
  }

  /* ---- storefront preview (shared) ---- */
  function storefrontHtml(){
    var fac = equippedIn('facade'), awn = equippedIn('awning'), lit = equippedIn('lights'), drs = equippedIn('dressing');
    var facCss = fac ? fac.css : '#14231A';
    var lights='';
    if(lit && lit.css){
      var dots='';
      for(var i=0;i<9;i++){ dots += '<i style="background:'+lit.css+';box-shadow:0 0 6px '+lit.css+'"></i>'; }
      lights = '<div class="sqp-strlights">'+dots+'</div>';
    }
    var awning = (awn && awn.css) ? '<div class="sqp-awn" style="background:'+awn.css+'"></div>' : '';
    var sideItem = (drs && drs.emoji) ? drs.emoji : '';
    var name = pass.email ? esc(pass.email.split('@')[0]).toUpperCase().slice(0,12) : 'YOUR SHOP';
    return (
      '<div class="sqp-lot">'+
        '<div class="sqp-store" style="background:'+facCss+'">'+
          lights+
          '<span class="sqp-win2 w-l"></span><span class="sqp-win2 w-r"></span>'+
          '<div class="sqp-sign">'+name+'</div>'+
          awning+
          '<div class="sqp-door2"></div>'+
        '</div>'+
        '<div class="sqp-side">'+ (sideItem?('<span>'+sideItem+'</span>'):'') +'</div>'+
      '</div>'
    );
  }
  function shopHtml(){
    var out='';
    SLOTS.forEach(function(s){
      var eqId = (equippedIn(s.slot)||{}).id;
      var rows = SHOP.filter(function(it){ return it.slot===s.slot; }).map(function(it){
        var isEq = it.id===eqId;
        var sw = (s.slot==='dressing')
          ? '<div class="sqp-sw" style="background:#20293f">'+(it.emoji||'∅')+'</div>'
          : '<div class="sqp-sw" style="background:'+(it.css||'rgba(245,241,230,.06)')+'">'+(it.css?'':'∅')+'</div>';
        var priceHtml = it.free ? '<span class="free">Free</span>' : '<span>'+it.price+' 🧱</span>';
        var btn;
        if(isEq){ btn = '<button class="sqp-act on" disabled>Placed</button>'; }
        else if(owns(it.id)){ btn = '<button class="sqp-act eq" data-eq="'+it.id+'">Place</button>'; }
        else {
          var afford = pass.bricks >= it.price;
          btn = '<button class="sqp-act buy" data-buy="'+it.id+'"'+(afford?'':' disabled')+'>'+(afford?'Buy':'Need 🧱')+'</button>';
        }
        return '<div class="sqp-shopitem'+(isEq?' equipped':'')+'">'+sw+
               '<div class="nm"><b>'+esc(it.name)+'</b>'+priceHtml+'</div>'+btn+'</div>';
      }).join('');
      out += '<div class="sqp-slot-h">'+s.label+'</div><div class="sqp-grid">'+rows+'</div>';
    });
    return out;
  }
  var WALL_NOTE = '<div class="sqp-blocknote">Bricks decorate your block. They <b>don\'t affect prize drawings</b> — entries stay free, earned by collecting stamps.</div>';

  /* ---- compact intro shown INSIDE the popup ---- */
  function blockIntroHtml(){
    return (
      '<div class="sqp-wallet">'+
        '<div class="bal"><span>🧱 '+pass.bricks+'</span> <span class="lbl">Bricks</span></div>'+
        '<button class="buy" title="Buying Bricks arrives later" disabled>Buy Bricks · soon</button>'+
      '</div>'+
      storefrontHtml()+
      '<div class="sqp-blocknote">Earn Bricks from stamps and spend them decorating your storefront. The full builder has its own page.</div>'+
      '<a class="sqp-introcta" href="block.html">Open Build Your Block →</a>'+
      WALL_NOTE
    );
  }

  /* ---- full builder mounted on block.html ---- */
  function fullBlockHtml(){
    return (
      '<div class="sqp-wallet">'+
        '<div class="bal"><span>🧱 '+pass.bricks+'</span> <span class="lbl">Bricks</span></div>'+
        '<button class="buy" title="Buying Bricks arrives later" disabled>Buy Bricks · soon</button>'+
      '</div>'+
      storefrontHtml()+
      WALL_NOTE+
      '<div class="sqp-shop">'+shopHtml()+'</div>'
    );
  }
  function wireShopButtons(root){
    Array.prototype.forEach.call(root.querySelectorAll('[data-buy]'), function(b){
      b.addEventListener('click', function(){ buy(b.getAttribute('data-buy')); });
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-eq]'), function(b){
      b.addEventListener('click', function(){ equip(b.getAttribute('data-eq')); });
    });
  }
  function renderBlockPage(){
    if(!blockMount) return;
    blockMount.className = 'sqp-page';
    blockMount.innerHTML = fullBlockHtml();
    wireShopButtons(blockMount);
  }
  // Public: render the full Build-Your-Block builder into a container element.
  function mountBlock(elmnt){ if(!elmnt) return; blockMount = elmnt; renderBlockPage(); }

  function render(){
    var badge = document.getElementById('sqpBadge'); if(badge) badge.textContent = weekCount();
    renderBlockPage();
    var panel = scrim && scrim.querySelector('.sqp-panel'); if(!panel) return;

    panel.innerHTML =
      '<div class="sqp-head"><h3>The Square Pass</h3><button class="sqp-x" aria-label="Close">✕</button></div>'+
      '<div class="sqp-tabs">'+
        '<button class="sqp-tab'+(view==='pass'?' active':'')+'" data-view="pass">Pass</button>'+
        '<button class="sqp-tab'+(view==='block'?' active':'')+'" data-view="block">Build your block</button>'+
      '</div>'+
      (view==='pass' ? passViewHtml() : blockIntroHtml());

    panel.querySelector('.sqp-x').addEventListener('click', close);
    Array.prototype.forEach.call(panel.querySelectorAll('.sqp-tab'), function(t){
      t.addEventListener('click', function(){ view = t.getAttribute('data-view'); render(); });
    });
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

  // ---- hidden Square token (daily hunt): a subtle gold coin at a date-seeded spot,
  //      unique per page so collecting more tokens keeps adding stamps + Bricks ----
  function placeHiddenSymbol(){
    if(document.querySelector('.sq-hidden')) return;
    if(hasStamp('hunt', huntRef())) return;   // already found today's token on this page
    var seed = 0, s = today()+location.pathname;
    for(var i=0;i<s.length;i++) seed = (seed*31 + s.charCodeAt(i)) & 0xffffff;
    var top = 22 + (seed % 60);           // 22%–82%
    var left = 8 + ((seed>>4) % 84);      // 8%–92%
    var sym = el('span','sq-hidden','Y');
    sym.style.top = top+'vh'; sym.style.left = left+'vw';
    sym.title = 'A hidden Square token…';
    sym.addEventListener('click', function(){
      if(stamp('hunt', huntRef())) { toast('◎ You found the Square token!  ·  +1 entry  ·  +8 🧱'); }
      sym.style.display='none';
      open();
    });
    document.body.appendChild(sym);
  }

  // ---- global stamp hooks ----
  document.addEventListener('click', function(e){
    if(!e.target || !e.target.closest) return;
    // Visiting a storefront: real external "Visit shop" links...
    var a = e.target.closest('a');
    if(a){
      var ext = a.target==='_blank' && a.href && a.hostname && a.hostname!==location.hostname;
      if(ext) stamp('visit', a.hostname);
    }
    // ...or opening a storefront card in the walkable Square (demo shops included).
    var b = e.target.closest('.sq-b');
    if(b && !b.classList.contains('open') && !b.classList.contains('marquee')){
      var brandEl = b.querySelector('.b-brand');
      var brand = (brandEl && brandEl.textContent.trim()) || 'storefront';
      stamp('visit', brand);
    }
    if(e.target.closest('.vbtn')) stamp('vote', weekStart());
    if(e.target.closest('.enter-square, .balldrop-open')) stamp('explore', 'square');
  }, true);

  // boot
  function start(){ checkin(); build(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  // expose a tiny API (for Build-Your-Block page / manual stamps)
  window.SquarePass = {
    stamp: stamp, open: open,
    bricks: function(){ return pass.bricks; },
    mountBlock: mountBlock,
    get: function(){ return JSON.parse(JSON.stringify(pass)); }
  };
})();
