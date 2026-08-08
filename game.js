/* ============================================================================
   BUILD YOUR BLOCK — shop tycoon (v2)
   One all-in-one screen: a little city of your shops. Build, stock, collect
   coins, upgrade, and expand — plus a fullscreen city view and a guided
   first-time tutorial. You also earn coins by VISITING real storefronts on the
   Square (a traffic driver to the businesses that lease). Free to play; coins
   are earned by playing, never bought.
   Currency: the gold "Y" coin. Persists to localStorage; offline earnings are
   computed from elapsed time. Mount with window.SquareGame.mount(el); coin
   rewards for store visits work on every page via window.SquareGame.rewardVisit.
   ========================================================================== */
(function () {
  if (window.__squareGame) return; window.__squareGame = true;

  var LS = 'yps_block_v1';
  var nowMs = function(){ return new Date().getTime(); };
  var todayStr = function(){ return new Date().toISOString().slice(0,10); };
  var yesterdayStr = function(){ var d=new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); };

  var CFG = {
    startCoins: 120,
    capBase: 20, capPerLvl: 12,
    ratePerMin: 1.5, saleBase: 4, salePerLvl: 1.5,
    restockUnit: 2, upgradeBase: 140,
    lotCosts: [0, 180, 650, 1800, 4200],
    streakBonusPerDay: 20, streakCap: 120,
    visitCoins: 12                       // coins per real store visit (once/store/day)
  };
  var TYPES = {
    bakery:   { name:'Bakery',         emoji:'🧁', item:'🧁', face:'#b6774a', roof:'#e26d5c', sign:'#f1dea2', earn:1.00, lvlReq:1 },
    lemonade: { name:'Lemonade Stand', emoji:'🍋', item:'🥤', face:'#d9b13a', roof:'#8fd14f', sign:'#2f7d1f', earn:0.90, lvlReq:1 },
    sneakers: { name:'Sneaker Shop',   emoji:'👟', item:'👟', face:'#3a6dd1', roof:'#7ad03a', sign:'#eafff0', earn:1.25, lvlReq:2 },
    books:    { name:'Bookstore',      emoji:'📚', item:'📗', face:'#7a3f38', roof:'#c9a84a', sign:'#f1dea2', earn:1.10, lvlReq:2 },
    flowers:  { name:'Flower Shop',    emoji:'🌸', item:'💐', face:'#b04fa0', roof:'#f5a9d0', sign:'#ffffff', earn:1.20, lvlReq:3 },
    pizza:    { name:'Pizza Place',    emoji:'🍕', item:'🍕', face:'#c0432f', roof:'#2f9e44', sign:'#f1dea2', earn:1.35, lvlReq:3 },
    coffee:   { name:'Coffee Bar',     emoji:'☕', item:'☕', face:'#5a3a2a', roof:'#c9a84a', sign:'#e9cf8a', earn:1.15, lvlReq:4 },
    games:    { name:'Game Store',     emoji:'🎮', item:'🕹️', face:'#4b2fa8', roof:'#7ad03a', sign:'#eafff0', earn:1.40, lvlReq:4 }
  };
  var LEVEL_XP = function(lvl){ return 50 * lvl * lvl; };

  function fresh(){
    return { v:2, coins:CFG.startCoins, xp:0, level:1, streak:0, lastDay:'', tut:0,
      visited:{ day:'', refs:{} }, tokens:{},
      lots:[ {built:false,unlocked:true},{built:false,unlocked:false},{built:false,unlocked:false},
             {built:false,unlocked:false},{built:false,unlocked:false} ] };
  }
  var S;
  try { S = JSON.parse(localStorage.getItem(LS)); } catch(e){ S=null; }
  if(!S || !S.lots) S = fresh();
  if(typeof S.tut !== 'number' && S.tut!=='done') S.tut = (S.lots.some(function(l){return l.built;}) ? 'done' : 0);
  if(!S.visited) S.visited = { day:'', refs:{} };
  if(!S.tokens) S.tokens = {};
  function save(){ try{ localStorage.setItem(LS, JSON.stringify(S)); }catch(e){} }

  /* ---- math ---- */
  function cap(l){ return CFG.capBase + (l.lvl-1)*CFG.capPerLvl; }
  function ratePerSec(l){ var t=TYPES[l.type]; return (CFG.ratePerMin*t.earn*(1+0.25*(l.lvl-1)))/60; }
  function saleValue(l){ return CFG.saleBase + (l.lvl-1)*CFG.salePerLvl; }
  function upgradeCost(l){ return Math.round(CFG.upgradeBase*Math.pow(l.lvl,1.6)); }
  function restockCost(l){ return Math.round((cap(l)-l.stock)*CFG.restockUnit); }
  function soldUnits(l){ if(!l.built||l.stock<=0) return 0;
    var e=Math.max(0,(nowMs()-l.t)/1000); return Math.min(l.stock, Math.floor(e*ratePerSec(l))); }
  function pendingCoins(l){ return Math.round(soldUnits(l)*saleValue(l)); }
  function stockNow(l){ return Math.max(0, l.stock - soldUnits(l)); }

  /* ---- actions ---- */
  function addXp(n){ S.xp+=n; var up=false;
    while(S.xp>=LEVEL_XP(S.level)){ S.xp-=LEVEL_XP(S.level); S.level++; S.coins+=S.level*25; up=true; } return up; }
  function buildShop(i,type,name){
    var t=TYPES[type]; if(!t) return; var lot=S.lots[i];
    lot.built=true; lot.type=type; lot.name=(name||'').trim().slice(0,16)||t.name; lot.lvl=1;
    lot.stock=cap(lot); lot.t=nowMs();
    var firstEver = (S.tut===0);
    if(firstEver){ lot.t = nowMs() - 380*1000; S.tut=1; }   // head start so tutorial has coins to collect
    sel=i; save();
    if(!firstEver) toast('🏗️ '+lot.name+' is open! Stock it and let it sell.');
    render();
  }
  function collect(i){
    var l=S.lots[i]; if(!l.built) return; var sold=soldUnits(l); if(sold<=0) return;
    var coins=Math.round(sold*saleValue(l)); S.coins+=coins; l.stock-=sold; l.t=nowMs();
    var up=addXp(sold); if(S.tut===1) S.tut=2;
    save(); coinBurst(i,coins); if(up) toast('⭐ Level up! You reached Lvl '+S.level); render();
  }
  function restock(i){
    var l=S.lots[i]; if(!l.built) return;
    var sold=soldUnits(l); if(sold>0){ S.coins+=Math.round(sold*saleValue(l)); l.stock-=sold; addXp(sold); }
    var cost=restockCost(l);
    if(cost<=0){ toast('Shelves are already full.'); render(); return; }
    if(S.coins<cost){ toast('Not enough coins to restock ('+cost+').'); render(); return; }
    S.coins-=cost; l.stock=cap(l); l.t=nowMs(); if(S.tut===2) S.tut=3;
    save(); toast('📦 Restocked '+l.name+'.'); render();
  }
  function upgrade(i){
    var l=S.lots[i]; if(!l.built) return; var cost=upgradeCost(l);
    if(S.coins<cost){ toast('Need '+cost+' coins to upgrade.'); return; }
    S.coins-=cost; l.lvl++; addXp(8); if(S.tut===2) S.tut=3;
    save(); toast('🔧 '+l.name+' upgraded to Lvl '+l.lvl+'!'); render();
  }
  function unlockLot(i){
    var l=S.lots[i]; if(l.unlocked) return; var cost=CFG.lotCosts[i]||99999;
    if(S.coins<cost){ toast('Need '+cost+' coins to open a new lot.'); return; }
    S.coins-=cost; l.unlocked=true; save(); toast('🌆 New lot opened — build on it!'); render();
  }
  function dailyStreak(){
    var t=todayStr(); if(S.lastDay===t) return;
    S.streak=(S.lastDay===yesterdayStr())?(S.streak||0)+1:1; S.lastDay=t;
    var bonus=Math.min(CFG.streakCap, CFG.streakBonusPerDay*S.streak); S.coins+=bonus; save();
    setTimeout(function(){ toast('🔥 Day '+S.streak+' streak — +'+bonus+' coins'); },700);
  }
  function typesForLevel(){ var o=[]; for(var k in TYPES){ if(TYPES[k].lvlReq<=S.level) o.push(k); } return o; }

  /* ---- store-visit reward (traffic driver): once per store per day ---- */
  function rewardVisit(ref){
    ref = String(ref||'store');
    var d=todayStr();
    if(S.visited.day!==d){ S.visited={ day:d, refs:{} }; }
    if(S.visited.refs[ref]) return false;
    S.visited.refs[ref]=1; S.coins+=CFG.visitCoins; save();
    ensureChrome();
    toast('🛍️ +'+CFG.visitCoins+' coins for visiting '+ref);
    updateFab(); if(mountEl) render();
    return true;
  }
  // finding a stray coin hidden on a page (once per page per day)
  function rewardToken(key){
    if(!S.tokens) S.tokens={};
    if(S.tokens[key]) return false;
    S.tokens[key]=1; S.coins+=15; save();
    ensureChrome(); toast('🪙 +15 coins — you found a stray coin!');
    updateFab(); if(mountEl) render(); return true;
  }
  function updateFab(){ var f=document.getElementById('bgFabCoins'); if(f) f.textContent=S.coins; }
  /* ---- sharing (viral loop) ---- */
  function shareBlock(){
    var url='https://youngpreneursquare.pages.dev/block.html';
    var text="I'm building my block on Youngpreneur Square — come build yours!";
    try{ if(navigator.share){ navigator.share({title:'Youngpreneur Square', text:text, url:url}).catch(function(){}); return; } }catch(e){}
    shareFacebook();
  }
  function shareFacebook(){
    var url='https://youngpreneursquare.pages.dev/block.html';
    window.open('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(url),'_blank','noopener,width=640,height=560');
  }
  /* ---- site-wide presence: launcher + stray coins + store-visit rewards ---- */
  function initPresence(){
    ensureChrome();
    if(!document.getElementById('bgFab')){
      var fab=el('button','bg-fab'); fab.id='bgFab';
      fab.innerHTML='<span class="yc"></span> <b id="bgFabCoins">'+S.coins+'</b> · Your Block';
      fab.addEventListener('click', function(){ if(mountEl){ if(!fs) toggleFs(); } else { location.href='block.html'; } });
      document.body.appendChild(fab);
    }
    placeToken();
    document.addEventListener('click', visitListener, true);
  }
  function placeToken(){
    if(document.querySelector('.bg-token')) return;
    var day=todayStr(), key='tok:'+location.pathname+':'+day;
    if(S.tokens && S.tokens[key]) return;
    var seed=0,s=key; for(var i=0;i<s.length;i++) seed=(seed*31+s.charCodeAt(i))&0xffffff;
    var top=22+(seed%60), left=8+((seed>>4)%84);
    var t=el('span','bg-token','<span class="yc"></span>'); t.style.top=top+'vh'; t.style.left=left+'vw'; t.title='A stray coin…';
    t.addEventListener('click', function(){ if(rewardToken(key)){ t.style.transform='scale(1.7)'; t.style.opacity='0'; setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); },200); } });
    document.body.appendChild(t);
  }
  function visitListener(e){
    if(!e.target||!e.target.closest) return;
    var a=e.target.closest('a');
    if(a){ var ext=a.target==='_blank'&&a.href&&a.hostname&&a.hostname!==location.hostname; if(ext) rewardVisit(a.hostname); }
    var b=e.target.closest('.sq-b');
    if(b&&!b.classList.contains('open')&&!b.classList.contains('marquee')){ var br=b.querySelector('.b-brand'); rewardVisit((br&&br.textContent.trim())||'a shop'); }
  }

  /* ---------------- styles ---------------- */
  var CSS = `
  .yc{display:inline-block;width:1.05em;height:1.05em;border-radius:50%;position:relative;vertical-align:-.16em;
    background:radial-gradient(circle at 36% 30%,#fff4cf,#F1DEA2 42%,#C9A84A 74%,#9c7f34);
    box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.45),0 1px 2px rgba(0,0,0,.4)}
  .yc::after{content:"Y";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
    font-family:"Alfa Slab One",Georgia,serif;font-size:.66em;color:#6b5320;line-height:1}
  .bg-game{position:relative;display:flex;flex-direction:column;height:560px;border-radius:16px;overflow:hidden;
    border:1px solid rgba(201,168,74,.25);background:#0b130e;font-family:"Work Sans",system-ui,sans-serif;color:#F5F1E6;max-width:820px;margin:0 auto}
  .bg-game.fs{position:fixed;inset:0;height:100dvh;max-width:none;z-index:9500;border-radius:0;border:none}
  body.bg-lock{overflow:hidden}
  /* topbar */
  .bg-topbar{display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(8,11,9,.9);
    border-bottom:1px solid rgba(201,168,74,.25);z-index:7;flex:0 0 auto}
  .bg-chip{display:flex;align-items:center;gap:7px;background:rgba(245,241,230,.05);border:1px solid rgba(201,168,74,.2);
    border-radius:20px;padding:6px 12px}
  .bg-chip .v{font-family:"Playfair Display",Georgia,serif;font-weight:800;font-size:17px;color:#F1DEA2}
  .bg-chip .yc{font-size:17px}
  .bg-chip.streak .v{color:#ffb44a}
  .bg-lvlbox{flex:1;min-width:90px}
  .bg-lvlbox .r{display:flex;justify-content:space-between;font-size:10.5px;color:#B9C3B4;margin-bottom:3px}
  .bg-lvlbox .r b{color:#F1DEA2}
  .bg-xp{height:7px;border-radius:6px;background:rgba(10,13,11,.7);overflow:hidden;border:1px solid rgba(201,168,74,.2)}
  .bg-xp i{display:block;height:100%;background:linear-gradient(90deg,#7AD03A,#B9F27A);transition:width .5s}
  .bg-fs{flex:0 0 auto;background:rgba(245,241,230,.06);border:1px solid rgba(201,168,74,.3);color:#EFE9D8;
    width:38px;height:38px;border-radius:10px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center}
  .bg-fs:hover{border-color:var(--gold,#C9A84A)}
  .bg-share{flex:0 0 auto;border:none;width:38px;height:38px;border-radius:10px;font-size:15px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center}
  .bg-share.fb{background:#1877F2;color:#fff;font-family:Georgia,serif}
  .bg-share.gen{background:rgba(245,241,230,.06);color:#EFE9D8;border:1px solid rgba(201,168,74,.3)}
  .bg-fab{position:fixed;right:18px;bottom:18px;z-index:9000;display:flex;align-items:center;gap:6px;
    font-family:"Work Sans",system-ui,sans-serif;font-weight:700;font-size:12px;letter-spacing:.03em;color:#14231A;
    background:linear-gradient(180deg,#F1DEA2,#C9A84A);border:none;border-radius:30px;padding:10px 15px;cursor:pointer;
    box-shadow:0 8px 26px rgba(0,0,0,.4),0 0 0 1px rgba(201,168,74,.5)}
  .bg-fab:hover{transform:translateY(-2px)} .bg-fab .yc{font-size:15px} .bg-fab b{font-size:13px;font-family:"Playfair Display",Georgia,serif}
  .bg-token{position:fixed;z-index:8500;font-size:23px;line-height:1;cursor:pointer;transition:transform .18s,opacity .18s;filter:drop-shadow(0 2px 7px rgba(233,207,138,.75))}
  .bg-token .yc{width:1em;height:1em} .bg-token:hover{transform:scale(1.22)}
  /* city */
  .bg-city{position:relative;flex:1;min-height:0;overflow-x:auto;overflow-y:hidden;display:flex;align-items:flex-end;
    gap:14px;padding:0 20px 46px;scroll-snap-type:x proximity;
    background:linear-gradient(to bottom,var(--sky-1,#1b2740) 0%,var(--sky-2,#2a2f45) 40%,var(--sky-3,#3a2f3e) 72%,#141d16 100%)}
  body.day .bg-city{background:linear-gradient(to bottom,#8fb4e0 0%,#b9c6d6 42%,#cdb99a 74%,#b6a07c 100%)}
  .bg-city::-webkit-scrollbar{height:8px}.bg-city::-webkit-scrollbar-thumb{background:rgba(201,168,74,.35);border-radius:8px}
  .bg-road{position:absolute;left:0;right:0;bottom:0;height:44px;z-index:0;border-top:3px solid #2a2118;
    background:repeating-linear-gradient(90deg,#2a3346 0 26px,#232b3b 26px 28px)}
  body.day .bg-road{background:repeating-linear-gradient(90deg,#8f887a 0 26px,#837c6f 26px 28px)}
  .bg-moon3{position:absolute;top:16px;right:22px;width:26px;height:26px;border-radius:50%;z-index:0;
    background:radial-gradient(circle at 35% 35%,#fff,#e9e3c8);box-shadow:0 0 18px rgba(233,227,200,.6)}
  body.day .bg-moon3{background:radial-gradient(circle at 35% 35%,#fff6cf,#ffd85e);box-shadow:0 0 26px rgba(255,210,90,.85)}
  .bg-city-star{position:absolute;width:2px;height:2px;border-radius:50%;background:#fff;opacity:.55;z-index:0}
  body.day .bg-city-star{opacity:0}
  .bg-far2{position:absolute;left:0;right:0;bottom:44px;height:90px;z-index:0;opacity:.5;
    background:repeating-linear-gradient(90deg,transparent 0 22px,#0c1a12 22px 30px,transparent 30px 40px,#0e1e14 40px 52px,transparent 52px 66px);
    -webkit-mask-image:linear-gradient(to top,#000,transparent);mask-image:linear-gradient(to top,#000,transparent)}
  body.day .bg-far2{opacity:.25}
  .bg-cust2{position:absolute;bottom:8px;font-size:18px;z-index:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,.4));animation:bgwalk 9s linear infinite}
  .bg-b{position:relative;z-index:2;flex:0 0 auto;width:138px;margin-bottom:44px;cursor:pointer;scroll-snap-align:center;
    transition:transform .15s}
  .bg-b:hover{transform:translateY(-3px)}
  .bg-b.sel .bg-shopwrap{box-shadow:0 0 0 2px #7AD03A,0 10px 24px rgba(0,0,0,.5);border-radius:8px}
  .bg-shopwrap{position:relative}
  .bg-roof{height:15px;border-radius:8px 8px 0 0;background:repeating-linear-gradient(90deg,var(--roofA) 0 13px,#f7f1e2 13px 26px)}
  .bg-sign{background:#0c120e;border-left:3px solid var(--signC);border-right:3px solid var(--signC);text-align:center;padding:5px 4px;position:relative}
  .bg-sign b{font-family:"Alfa Slab One",Georgia,serif;font-size:10.5px;color:var(--signC);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;text-shadow:0 0 8px var(--signC)}
  .bg-sign .bulbs{position:absolute;top:-3px;left:6px;right:6px;height:4px;display:flex;justify-content:space-between}
  .bg-sign .bulbs i{width:3px;height:3px;border-radius:50%;background:var(--signC);box-shadow:0 0 5px var(--signC);animation:bgblink 1.6s infinite}
  .bg-body2{background:var(--faceC);border:2px solid rgba(0,0,0,.25);border-top:none;padding:7px;display:flex;gap:5px}
  .bg-window{flex:1;background:linear-gradient(180deg,#d6ecff,#8fb8e6);border-radius:3px;min-height:52px;display:flex;flex-wrap:wrap;align-content:flex-end;gap:2px;padding:3px;box-shadow:inset 0 0 0 2px rgba(0,0,0,.15)}
  .bg-window span{font-size:12px;line-height:1}
  .bg-door2{width:24px;background:#2a1a10;border-radius:3px 3px 0 0;box-shadow:inset 0 0 0 2px rgba(0,0,0,.3);display:flex;align-items:flex-end;justify-content:center;padding-bottom:3px;font-size:9px}
  .bg-stars2{position:absolute;top:-15px;left:50%;transform:translateX(-50%);font-size:10px;color:#F1DEA2;white-space:nowrap;text-shadow:0 1px 2px #000;z-index:3}
  .bg-coin2{position:absolute;top:-30px;left:50%;transform:translateX(-50%);z-index:5;cursor:pointer;
    background:linear-gradient(180deg,#F1DEA2,#C9A84A);color:#14231A;font-weight:800;font-size:12.5px;border-radius:20px;
    padding:5px 11px;box-shadow:0 6px 16px rgba(0,0,0,.45);white-space:nowrap;display:flex;align-items:center;gap:5px;animation:bgbob 1.4s ease-in-out infinite}
  .bg-b .tap{position:absolute;bottom:-22px;left:0;right:0;text-align:center;font-size:10px;color:#9AA79A;white-space:nowrap}
  .bg-b.empty .bg-plot,.bg-b.locked .bg-plot{height:118px;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
    background:repeating-linear-gradient(45deg,rgba(201,168,74,.06) 0 11px,transparent 11px 22px);border:1px dashed rgba(201,168,74,.3)}
  .bg-b .pico{width:44px;height:44px;border-radius:50%;border:2px dashed rgba(201,168,74,.55);color:#C9A84A;display:flex;align-items:center;justify-content:center;font-size:24px}
  .bg-b .plabel{font-size:11px;color:#B9C3B4;text-align:center;padding:0 8px;line-height:1.3}
  /* panel */
  .bg-panel{position:absolute;left:0;right:0;bottom:0;transform:translateY(102%);transition:transform .28s ease;z-index:6;
    background:#0C120E;border-top:1px solid rgba(201,168,74,.35);border-radius:16px 16px 0 0;padding:14px 16px 16px;box-shadow:0 -14px 40px rgba(0,0,0,.5)}
  .bg-panel.open{transform:translateY(0)}
  .bg-ph{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
  .bg-ph b{font-size:15px;color:#EFE9D8}
  .bg-ph .ty{font-size:11px;color:#9AA79A}
  .bg-pclose{background:none;border:none;color:#9AA79A;font-size:20px;cursor:pointer;line-height:1}
  .bg-stockbar{height:10px;border-radius:6px;background:rgba(10,13,11,.6);overflow:hidden;border:1px solid rgba(201,168,74,.2);margin-bottom:4px}
  .bg-stockbar i{display:block;height:100%;background:linear-gradient(90deg,#C9A84A,#F1DEA2);transition:width .4s}
  .bg-stocktxt{font-size:11px;color:#9AA79A;margin-bottom:11px}
  .bg-stocktxt.empty{color:#e0a04a}
  .bg-acts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}
  .bg-btn{border:none;border-radius:9px;padding:11px 6px;font-family:"Work Sans";font-weight:700;font-size:12.5px;cursor:pointer;transition:transform .1s,filter .15s;display:flex;flex-direction:column;align-items:center;gap:2px}
  .bg-btn:active{transform:scale(.96)} .bg-btn:disabled{opacity:.45;cursor:not-allowed}
  .bg-btn .c{font-size:10.5px;font-weight:600;opacity:.85;display:flex;align-items:center;gap:4px}
  .bg-collect{background:linear-gradient(180deg,#8fe25a,#4fae1f);color:#08210a}
  .bg-restock{background:linear-gradient(180deg,#F1DEA2,#C9A84A);color:#14231A}
  .bg-upg{background:rgba(245,241,230,.08);color:#EFE9D8;border:1px solid rgba(201,168,74,.35);grid-column:1/3}
  /* build picker */
  .bg-modal{position:fixed;inset:0;z-index:9600;background:rgba(4,7,5,.72);backdrop-filter:blur(3px);display:none;align-items:center;justify-content:center;padding:16px}
  .bg-modal.open{display:flex}
  .bg-sheet{width:100%;max-width:440px;background:#0C120E;border:1px solid rgba(201,168,74,.3);border-radius:16px;padding:18px;max-height:90vh;overflow:auto;font-family:"Work Sans",sans-serif;color:#F5F1E6}
  .bg-sheet h3{font-family:"Playfair Display",Georgia,serif;font-weight:800;font-size:18px;margin:0 0 4px;text-transform:uppercase}
  .bg-sheet p{font-size:12.5px;color:#9AA79A;margin:0 0 14px}
  .bg-types{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
  .bg-type{display:flex;align-items:center;gap:9px;padding:10px;border-radius:10px;cursor:pointer;background:rgba(245,241,230,.04);border:1px solid rgba(201,168,74,.2)}
  .bg-type.sel{border-color:#7AD03A;box-shadow:0 0 0 1px rgba(122,208,58,.4)}
  .bg-type .em{font-size:22px}.bg-type b{display:block;font-size:12.5px;color:#EFE9D8}.bg-type span{font-size:10.5px;color:#9AA79A}
  .bg-type.lock{opacity:.5;cursor:not-allowed}
  .bg-name-in{width:100%;background:rgba(10,13,11,.6);border:1px solid rgba(201,168,74,.25);border-radius:8px;padding:11px;color:#F5F1E6;font-size:14px;margin-bottom:12px}
  .bg-row{display:flex;gap:8px}
  .bg-open{flex:1;background:linear-gradient(180deg,#8fe25a,#4fae1f);color:#08210a;border:none;border-radius:8px;padding:12px;font-weight:800;font-size:13px;cursor:pointer}
  .bg-cancel{background:none;border:1px solid rgba(201,168,74,.3);color:#9AA79A;border-radius:8px;padding:12px 16px;cursor:pointer}
  /* coach */
  .bg-coach{position:absolute;left:50%;transform:translateX(-50%);z-index:8;max-width:90%;
    background:#12331A;border:1px solid rgba(122,208,58,.55);border-radius:14px;padding:12px 16px;color:#F5F1E6;font-size:13px;
    box-shadow:0 12px 34px rgba(0,0,0,.55);text-align:center;line-height:1.5}
  .bg-coach b{color:#9fe06a}
  .bg-coach .go{margin-top:9px;background:linear-gradient(180deg,#8fe25a,#4fae1f);color:#08210a;border:none;border-radius:20px;padding:7px 16px;font-weight:800;font-size:12px;cursor:pointer}
  .bg-pulse{animation:bgpulse 1.25s infinite}
  .bg-fly{position:absolute;left:50%;top:20%;transform:translateX(-50%);z-index:9;font-weight:800;color:#F1DEA2;font-size:18px;pointer-events:none;text-shadow:0 2px 4px #000;animation:bgfly 1s ease-out forwards;display:flex;align-items:center;gap:5px}
  .bg-toast{position:fixed;left:50%;bottom:84px;transform:translateX(-50%) translateY(14px);z-index:9700;background:#12331A;color:#F5F1E6;border:1px solid rgba(201,168,74,.5);border-radius:24px;padding:10px 18px;font-family:"Work Sans",sans-serif;font-weight:600;font-size:13px;box-shadow:0 10px 30px rgba(0,0,0,.5);opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis}
  .bg-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
  @keyframes bgblink{0%,45%{opacity:1}55%,100%{opacity:.25}}
  @keyframes bgbob{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-5px)}}
  @keyframes bgwalk{0%{left:-6%}100%{left:103%}}
  @keyframes bgpulse{0%,100%{box-shadow:0 0 0 0 rgba(122,208,58,.55)}50%{box-shadow:0 0 0 9px rgba(122,208,58,0)}}
  @keyframes bgfly{0%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-46px)}}
  `;

  /* ---------------- DOM ---------------- */
  var mountEl=null, toastEl=null, toastTimer=null, tick=null, modal=null, host=null;
  var sel=-1, fs=false, picker={lot:-1,type:null};
  var STARPOS=[[6,12],[14,26],[22,9],[31,20],[39,14],[48,28],[57,10],[65,22],[73,16],[82,9],[90,24],[95,15],[11,34],[44,7],[78,30]];
  function el(t,c,h){ var e=document.createElement(t); if(c)e.className=c; if(h!=null)e.innerHTML=h; return e; }
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function coin(n){ return '<span class="yc"></span>'+(n!=null?(' '+n):''); }
  function toast(m){ if(!toastEl) return; toastEl.textContent=m; toastEl.classList.add('show');
    clearTimeout(toastTimer); toastTimer=setTimeout(function(){ toastEl.classList.remove('show'); },2600); }
  function ensureChrome(){
    if(!document.getElementById('bg-style')){ var st=el('style'); st.id='bg-style'; st.textContent=CSS; document.head.appendChild(st); }
    if(!toastEl){ toastEl=el('div','bg-toast'); document.body.appendChild(toastEl); }
  }

  /* ---- render helpers ---- */
  function buildingHtml(l,i){
    if(!l.unlocked){ var cost=CFG.lotCosts[i]||99999;
      return '<div class="bg-b locked" data-unlock="'+i+'"><div class="bg-plot"><div class="pico">🔒</div><div class="plabel">Open lot</div></div><div class="tap">'+coin(cost)+'</div></div>'; }
    if(!l.built){
      return '<div class="bg-b empty" data-build="'+i+'"><div class="bg-plot"><div class="pico">＋</div><div class="plabel">Build a shop</div></div></div>'; }
    var t=TYPES[l.type], sn=stockNow(l), pend=pendingCoins(l);
    var shown=Math.max(0,Math.min(12,Math.round(sn/cap(l)*12))), items='';
    for(var w=0;w<shown;w++) items+='<span>'+t.item+'</span>';
    var stars=''; for(var s=0;s<Math.min(5,l.lvl);s++) stars+='★';
    var badge = pend>0 ? '<div class="bg-coin2" data-collect="'+i+'">'+coin(pend)+'</div>' : '';
    return '<div class="bg-b built'+(sel===i?' sel':'')+'" id="bg-b-'+i+'" data-sel="'+i+'">'+
      '<div class="bg-shopwrap" style="--faceC:'+t.face+';--roofA:'+t.roof+';--signC:'+t.sign+'">'+
        '<div class="bg-stars2">'+stars+'</div>'+ badge +
        '<div class="bg-roof"></div>'+
        '<div class="bg-sign"><span class="bulbs"><i></i><i style="animation-delay:.3s"></i><i style="animation-delay:.6s"></i></span><b>'+esc(l.name)+'</b></div>'+
        '<div class="bg-body2"><div class="bg-window">'+items+'</div><div class="bg-door2">'+t.emoji+'</div></div>'+
      '</div>'+
      '<div class="tap">'+(sn<=0?'Sold out — tap':'Lvl '+l.lvl+' · tap')+'</div>'+
    '</div>';
  }
  function cityHtml(){
    var buildings=''; for(var i=0;i<S.lots.length;i++) buildings+=buildingHtml(S.lots[i],i);
    var custs=''; var anyStock=S.lots.some(function(l){return l.built && stockNow(l)>0;});
    if(anyStock){ for(var c=0;c<4;c++) custs+='<span class="bg-cust2" style="animation-delay:'+(c*2.1)+'s">🧍</span>'; }
    var stars=''; for(var k=0;k<STARPOS.length;k++) stars+='<span class="bg-city-star" style="left:'+STARPOS[k][0]+'%;top:'+STARPOS[k][1]+'%"></span>';
    return '<div class="bg-city" id="bgCity">'+stars+'<div class="bg-moon3"></div><div class="bg-far2"></div>'+custs+buildings+'<div class="bg-road"></div></div>';
  }
  function topbarHtml(){
    var need=LEVEL_XP(S.level), pct=Math.round(S.xp/need*100);
    return '<div class="bg-topbar">'+
      '<div class="bg-chip"><span class="yc"></span><span class="v" id="bgCoins">'+S.coins+'</span></div>'+
      '<div class="bg-chip streak"><span class="v">🔥 '+S.streak+'</span></div>'+
      '<div class="bg-lvlbox"><div class="r"><span>Lvl <b>'+S.level+'</b></span><span>'+S.xp+'/'+need+' XP</span></div><div class="bg-xp"><i style="width:'+pct+'%"></i></div></div>'+
      '<button class="bg-share fb" id="bgFb" title="Share to Facebook">f</button>'+
      '<button class="bg-share gen" id="bgShare" title="Share your block">📤</button>'+
      '<button class="bg-fs" id="bgFs" title="Fullscreen">'+(fs?'✕':'⛶')+'</button>'+
    '</div>';
  }
  function panelHtml(){
    var open = sel>=0 && S.lots[sel] && S.lots[sel].built;
    if(!open) return '<div class="bg-panel" id="bgPanel"></div>';
    var l=S.lots[sel], t=TYPES[l.type], sn=stockNow(l), pct=Math.round(sn/cap(l)*100), pend=pendingCoins(l);
    return '<div class="bg-panel open" id="bgPanel">'+
      '<div class="bg-ph"><div><b>'+esc(l.name)+'</b> <span class="ty">· '+t.name+' · Lvl '+l.lvl+'</span></div><button class="bg-pclose" data-close="1">✕</button></div>'+
      '<div class="bg-stockbar"><i style="width:'+pct+'%"></i></div>'+
      '<div class="bg-stocktxt'+(sn<=0?' empty':'')+'">'+(sn<=0?'Sold out — restock to keep selling':('Stock '+sn+' / '+cap(l))) +'</div>'+
      '<div class="bg-acts">'+
        '<button class="bg-btn bg-collect" data-collect="'+sel+'"'+(pend>0?'':' disabled')+'>Collect<span class="c">'+(pend>0?coin(pend):'—')+'</span></button>'+
        '<button class="bg-btn bg-restock" data-restock="'+sel+'"'+(restockCost(l)>0?'':' disabled')+'>Restock<span class="c">'+coin(restockCost(l))+'</span></button>'+
        '<button class="bg-btn bg-upg" data-upg="'+sel+'">Upgrade to Lvl '+(l.lvl+1)+' <span class="c">· '+coin(upgradeCost(l))+'</span></button>'+
      '</div>'+
    '</div>';
  }
  function coachData(){
    if(S.tut==='done' || typeof S.tut!=='number') return null;
    if(S.tut===0) return { html:'👋 Welcome to your block! Tap a lot and <b>build your first shop</b>.', target:'.bg-b.empty' };
    if(S.tut===1) return { html:'Your shop opened and is <b>already earning</b>. Tap the gold coin to collect.', target:'.bg-coin2' };
    if(S.tut===2) return { html:'Nice — that\'s coins earned! Now <b>Restock</b> so customers keep buying while you\'re away.', target:'.bg-restock' };
    if(S.tut===3) return { html:'You\'ve got it! Upgrade shops, open new lots, and <b>visit real shops on the Square to earn even more coins</b>.', done:true };
    return null;
  }

  function render(){
    if(!host){ if(!mountEl) return; host=el('div'); mountEl.appendChild(host); }
    host.className = 'bg-game'+(fs?' fs':''); host.id='bgGame';
    host.innerHTML = topbarHtml() + cityHtml() + panelHtml();
    var cd=coachData();
    if(cd){
      var c=el('div','bg-coach', cd.html + (cd.done?'<br><button class="go" id="bgCoachGo">Got it</button>':''));
      c.style.bottom = (sel>=0 ? '190px' : '18px');
      host.appendChild(c);
      if(cd.done){ c.querySelector('#bgCoachGo').addEventListener('click', function(){ S.tut='done'; save(); render(); }); }
    }
    wire(host);
    if(cd && cd.target){ var tg=host.querySelector(cd.target); if(tg) tg.classList.add('bg-pulse'); }
  }
  function wire(root){
    ev(root,'[data-sel]','click',function(e){ selectLot(+e.getAttribute('data-sel')); });
    ev(root,'[data-collect]','click',function(e,evt){ evt.stopPropagation(); collect(+e.getAttribute('data-collect')); });
    ev(root,'[data-restock]','click',function(e){ restock(+e.getAttribute('data-restock')); });
    ev(root,'[data-upg]','click',function(e){ upgrade(+e.getAttribute('data-upg')); });
    ev(root,'[data-unlock]','click',function(e){ unlockLot(+e.getAttribute('data-unlock')); });
    ev(root,'[data-build]','click',function(e){ openPicker(+e.getAttribute('data-build')); });
    ev(root,'[data-close]','click',function(){ sel=-1; render(); });
    var fsb=root.querySelector('#bgFs'); if(fsb) fsb.addEventListener('click', toggleFs);
    var fbb=root.querySelector('#bgFb'); if(fbb) fbb.addEventListener('click', shareFacebook);
    var shb=root.querySelector('#bgShare'); if(shb) shb.addEventListener('click', shareBlock);
  }
  function ev(root,sel2,type,fn){ Array.prototype.forEach.call(root.querySelectorAll(sel2),function(e){
    e.addEventListener(type,function(evt){ fn(e,evt); }); }); }
  function selectLot(i){ var l=S.lots[i]; if(!l||!l.built) return; sel=(sel===i?-1:i); render(); }

  function live(){
    if(!mountEl) return;
    var cEl=document.getElementById('bgCoins'); if(cEl) cEl.textContent=S.coins;
    for(var i=0;i<S.lots.length;i++){ var l=S.lots[i]; if(!l.built) continue;
      var host=document.getElementById('bg-b-'+i); if(!host) continue;
      var pend=pendingCoins(l); var badge=host.querySelector('.bg-coin2');
      if((pend>0)!==!!badge){ render(); return; }             // structural change -> full render
      if(badge){ badge.innerHTML=coin(pend); }
    }
    // update open panel numbers
    if(sel>=0 && S.lots[sel] && S.lots[sel].built){
      var l2=S.lots[sel], p=document.getElementById('bgPanel');
      if(p && p.classList.contains('open')){
        var pend2=pendingCoins(l2), cb=p.querySelector('.bg-collect');
        if(cb){ cb.disabled=pend2<=0; var cc=cb.querySelector('.c'); if(cc) cc.innerHTML=pend2>0?coin(pend2):'—'; }
      }
    }
  }
  function coinBurst(i,amt){ var host=document.getElementById('bg-b-'+i); if(!host) return;
    var f=el('div','bg-fly', coin(amt)); host.appendChild(f); setTimeout(function(){ if(f.parentNode)f.parentNode.removeChild(f); },1000); }

  /* ---- fullscreen ---- */
  function toggleFs(){ fs=!fs;
    if(fs){ document.body.appendChild(host); } else if(mountEl){ mountEl.appendChild(host); }
    document.body.classList.toggle('bg-lock', fs); render();
    if(fs){ var c=document.getElementById('bgCity'); if(c) c.scrollLeft=0; }
  }
  document.addEventListener('keydown', function(e){ if(e.key==='Escape' && fs){ fs=false; if(mountEl) mountEl.appendChild(host); document.body.classList.remove('bg-lock'); render(); } });

  /* ---- build picker ---- */
  function openPicker(i){
    if(!modal){ modal=el('div','bg-modal'); modal.addEventListener('click',function(e){ if(e.target===modal) modal.classList.remove('open'); }); document.body.appendChild(modal); }
    picker.lot=i; picker.type=typesForLevel()[0];
    var cards='';
    for(var k in TYPES){ var t=TYPES[k], ok=t.lvlReq<=S.level;
      cards+='<div class="bg-type'+(ok?'':' lock')+(k===picker.type?' sel':'')+'" '+(ok?'data-pick="'+k+'"':'')+'><span class="em">'+t.emoji+'</span><div><b>'+t.name+'</b><span>'+(ok?('earns ×'+t.earn.toFixed(2)):('Lvl '+t.lvlReq+' to unlock'))+'</span></div></div>'; }
    modal.innerHTML='<div class="bg-sheet"><h3>Open a shop</h3><p>Pick what you\'re selling and give it a name.</p>'+
      '<input class="bg-name-in" id="bgName" maxlength="16" placeholder="Name your shop (optional)">'+
      '<div class="bg-types">'+cards+'</div>'+
      '<div class="bg-row"><button class="bg-open" id="bgOpen">Open for business</button><button class="bg-cancel" id="bgCancel">Cancel</button></div></div>';
    modal.classList.add('open');
    ev(modal,'[data-pick]','click',function(e){ picker.type=e.getAttribute('data-pick');
      Array.prototype.forEach.call(modal.querySelectorAll('.bg-type'),function(c){ c.classList.remove('sel'); }); e.classList.add('sel'); });
    modal.querySelector('#bgOpen').addEventListener('click',function(){ buildShop(picker.lot,picker.type,modal.querySelector('#bgName').value||''); modal.classList.remove('open'); });
    modal.querySelector('#bgCancel').addEventListener('click',function(){ modal.classList.remove('open'); });
  }

  /* ---- boot ---- */
  function mount(elmnt){
    if(!elmnt) return; mountEl=elmnt; ensureChrome();
    dailyStreak(); render();
    if(tick) clearInterval(tick); tick=setInterval(live,1000);
  }
  window.SquareGame = {
    mount: mount,
    rewardVisit: rewardVisit,
    rewardToken: rewardToken,
    share: shareBlock,
    get: function(){ return JSON.parse(JSON.stringify(S)); },
    add: function(n){ S.coins+=(n||0); save(); updateFab(); if(mountEl) render(); }
  };

  // site-wide presence (launcher, stray coins, visit rewards) runs on every page
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', initPresence);
  else initPresence();
})();
