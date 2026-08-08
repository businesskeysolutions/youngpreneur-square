/* ============================================================================
   BUILD YOUR BLOCK — shop tycoon (v1)
   Build and run your own little shops on the Square. Stock a shop, customers
   buy while you're away, come back to collect Coins, upgrade, and grow your
   block. Free-to-earn: Coins and prize entries are never bought. (Real-money
   speed-ups / cosmetics are a later phase and never touch prize odds.)
   Self-contained: injects its own CSS. Persists to localStorage; offline
   earnings are computed from elapsed time on load.
   Mount with: window.SquareGame.mount(containerEl)
   ========================================================================== */
(function () {
  if (window.__squareGame) return; window.__squareGame = true;

  var LS = 'yps_block_v1';
  var now = function(){ return new Date().getTime(); };
  var todayStr = function(){ return new Date().toISOString().slice(0,10); };
  var yesterdayStr = function(){ var d=new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); };

  /* ---------------- config / balance ---------------- */
  var CFG = {
    startCoins: 150,
    capBase: 20, capPerLvl: 12,        // stock capacity
    ratePerMin: 1.5,                    // units sold / min at lvl 1 (x type.earn)
    saleBase: 4, salePerLvl: 1.5,       // coins per unit
    restockUnit: 2,                     // coin cost per unit restocked
    upgradeBase: 140,                   // upgrade cost base
    lotCosts: [0, 180, 650, 1800, 4200],// coin cost to unlock lot i
    streakBonusPerDay: 20, streakCap: 120
  };
  // shop types (unlock by entrepreneur level)
  var TYPES = {
    bakery:   { name:'Bakery',        emoji:'🧁', item:'🧁', face:'#b6774a', roof:'#e26d5c', sign:'#f1dea2', earn:1.00, lvlReq:1 },
    lemonade: { name:'Lemonade Stand',emoji:'🍋', item:'🥤', face:'#d9b13a', roof:'#8fd14f', sign:'#2f7d1f', earn:0.90, lvlReq:1 },
    sneakers: { name:'Sneaker Shop',  emoji:'👟', item:'👟', face:'#3a6dd1', roof:'#7ad03a', sign:'#eafff0', earn:1.25, lvlReq:2 },
    books:    { name:'Bookstore',     emoji:'📚', item:'📗', face:'#7a3f38', roof:'#c9a84a', sign:'#f1dea2', earn:1.10, lvlReq:2 },
    flowers:  { name:'Flower Shop',   emoji:'🌸', item:'💐', face:'#b04fa0', roof:'#f5a9d0', sign:'#fff', earn:1.20, lvlReq:3 },
    pizza:    { name:'Pizza Place',   emoji:'🍕', item:'🍕', face:'#c0432f', roof:'#2f9e44', sign:'#f1dea2', earn:1.35, lvlReq:3 },
    coffee:   { name:'Coffee Bar',    emoji:'☕', item:'☕', face:'#5a3a2a', roof:'#c9a84a', sign:'#e9cf8a', earn:1.15, lvlReq:4 },
    games:    { name:'Game Store',    emoji:'🎮', item:'🕹️', face:'#4b2fa8', roof:'#7ad03a', sign:'#eafff0', earn:1.40, lvlReq:4 }
  };
  var LEVEL_XP = function(lvl){ return 50 * lvl * lvl; }; // xp to go from lvl -> lvl+1

  /* ---------------- state ---------------- */
  function fresh(){
    return {
      v:1, coins: CFG.startCoins, xp:0, level:1, streak:0, lastDay:'',
      lots: [
        { built:false, unlocked:true },
        { built:false, unlocked:false },
        { built:false, unlocked:false },
        { built:false, unlocked:false },
        { built:false, unlocked:false }
      ]
    };
  }
  var S;
  try { S = JSON.parse(localStorage.getItem(LS)); } catch(e){ S = null; }
  if(!S || !S.lots) S = fresh();
  function save(){ try { localStorage.setItem(LS, JSON.stringify(S)); } catch(e){} }

  /* ---------------- shop math ---------------- */
  function cap(lot){ return CFG.capBase + (lot.lvl-1)*CFG.capPerLvl; }
  function ratePerSec(lot){ var t=TYPES[lot.type]; return (CFG.ratePerMin * t.earn * (1 + 0.25*(lot.lvl-1))) / 60; }
  function saleValue(lot){ return CFG.saleBase + (lot.lvl-1)*CFG.salePerLvl; }
  function upgradeCost(lot){ return Math.round(CFG.upgradeBase * Math.pow(lot.lvl, 1.6)); }
  function restockCost(lot){ return Math.round((cap(lot) - lot.stock) * CFG.restockUnit); }
  // units sold since lot.t, capped by current stock
  function soldUnits(lot){
    if(!lot.built || lot.stock<=0) return 0;
    var elapsed = Math.max(0, (now() - lot.t)/1000);
    return Math.min(lot.stock, Math.floor(elapsed * ratePerSec(lot)));
  }
  function pendingCoins(lot){ return Math.round(soldUnits(lot) * saleValue(lot)); }
  function isFull(lot){ return pendingCoins(lot)>0 && soldUnits(lot) >= lot.stock; }

  /* ---------------- actions ---------------- */
  function addXp(n){
    S.xp += n;
    var leveled = false;
    while(S.xp >= LEVEL_XP(S.level)){ S.xp -= LEVEL_XP(S.level); S.level++; S.coins += S.level*25; leveled = true; }
    return leveled;
  }
  function buildShop(i, type, name){
    var t = TYPES[type]; if(!t) return;
    var lot = S.lots[i];
    lot.built = true; lot.type = type;
    lot.name = (name||'').trim().slice(0,16) || t.name;
    lot.lvl = 1; lot.stock = 0; lot.t = now();
    save(); toast('🏗️ '+lot.name+' is open! Stock it up.'); render();
  }
  function collect(i){
    var lot = S.lots[i]; if(!lot.built) return;
    var sold = soldUnits(lot); if(sold<=0){ return; }
    var coins = Math.round(sold * saleValue(lot));
    S.coins += coins; lot.stock -= sold; lot.t = now();
    var lv = addXp(sold);
    save(); coinBurst(i, coins); if(lv) toast('⭐ Level up! You reached Lvl '+S.level);
    render();
  }
  function restock(i){
    var lot = S.lots[i]; if(!lot.built) return;
    // auto-collect anything pending first
    var sold = soldUnits(lot);
    if(sold>0){ S.coins += Math.round(sold*saleValue(lot)); lot.stock -= sold; addXp(sold); }
    var cost = restockCost(lot);
    if(cost<=0){ toast('Shelves are already full.'); render(); return; }
    if(S.coins < cost){ toast('Not enough Coins to restock ('+cost+' 🪙).'); render(); return; }
    S.coins -= cost; lot.stock = cap(lot); lot.t = now();
    save(); toast('📦 Restocked '+lot.name+'.'); render();
  }
  function upgrade(i){
    var lot = S.lots[i]; if(!lot.built) return;
    var cost = upgradeCost(lot);
    if(S.coins < cost){ toast('Need '+cost+' 🪙 to upgrade.'); return; }
    S.coins -= cost; lot.lvl++; addXp(8);
    save(); toast('🔧 '+lot.name+' upgraded to Lvl '+lot.lvl+'!'); render();
  }
  function unlockLot(i){
    var lot = S.lots[i]; if(lot.unlocked) return;
    var cost = CFG.lotCosts[i] || 99999;
    if(S.coins < cost){ toast('Need '+cost+' 🪙 to open a new lot.'); return; }
    S.coins -= cost; lot.unlocked = true;
    save(); toast('🌆 New lot opened — build on it!'); render();
  }
  function dailyStreak(){
    var t = todayStr();
    if(S.lastDay === t) return;
    S.streak = (S.lastDay === yesterdayStr()) ? (S.streak||0)+1 : 1;
    S.lastDay = t;
    var bonus = Math.min(CFG.streakCap, CFG.streakBonusPerDay * S.streak);
    S.coins += bonus; save();
    setTimeout(function(){ toast('🔥 Day '+S.streak+' streak — +'+bonus+' 🪙 bonus'); }, 600);
  }

  function typesForLevel(){
    var out=[]; for(var k in TYPES){ if(TYPES[k].lvlReq <= S.level) out.push(k); } return out;
  }

  /* ---------------- styles ---------------- */
  var CSS = `
  .bg-wrap{font-family:"Work Sans",system-ui,sans-serif;color:#F5F1E6;max-width:760px;margin:0 auto}
  /* HUD */
  .bg-hud{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:center;
    background:linear-gradient(180deg,rgba(245,241,230,.06),rgba(245,241,230,.02));
    border:1px solid rgba(201,168,74,.25);border-radius:14px;padding:12px 14px;margin-bottom:16px}
  .bg-stat{display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:20px;background:rgba(10,13,11,.5)}
  .bg-stat .v{font-family:"Playfair Display",Georgia,serif;font-weight:800;font-size:18px;color:#F1DEA2}
  .bg-stat .l{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#9AA79A}
  .bg-lvl{flex:1;min-width:150px}
  .bg-lvl .top{display:flex;justify-content:space-between;font-size:11px;color:#B9C3B4;margin-bottom:4px}
  .bg-lvl .top b{color:#F1DEA2}
  .bg-xp{height:8px;border-radius:6px;background:rgba(10,13,11,.6);overflow:hidden;border:1px solid rgba(201,168,74,.2)}
  .bg-xp i{display:block;height:100%;background:linear-gradient(90deg,#7AD03A,#B9F27A);transition:width .5s}
  /* block strip */
  .bg-strip{display:flex;gap:14px;overflow-x:auto;padding:6px 2px 16px;scroll-snap-type:x mandatory}
  .bg-strip::-webkit-scrollbar{height:8px}
  .bg-strip::-webkit-scrollbar-thumb{background:rgba(201,168,74,.35);border-radius:8px}
  .bg-lot{scroll-snap-align:center;flex:0 0 auto;width:230px;border-radius:14px;overflow:hidden;
    border:1px solid rgba(201,168,74,.22);background:linear-gradient(180deg,#0e1a13,#0b130e)}
  /* scene */
  .bg-scene{position:relative;height:190px;overflow:hidden;
    background:linear-gradient(to bottom,var(--sky-1,#20324e) 0%,var(--sky-3,#3a2f3e) 62%,#141d16 100%)}
  body.day .bg-scene{background:linear-gradient(to bottom,#8fb4e0 0%,#cbb89a 66%,#b9a07a 100%)}
  .bg-scene .moon2{position:absolute;top:14px;right:18px;width:22px;height:22px;border-radius:50%;
    background:radial-gradient(circle at 35% 35%,#fff,#e9e3c8);box-shadow:0 0 16px rgba(233,227,200,.6)}
  body.day .bg-scene .moon2{background:radial-gradient(circle at 35% 35%,#fff6cf,#ffd85e);box-shadow:0 0 22px rgba(255,210,90,.8)}
  .bg-sky-star{position:absolute;width:2px;height:2px;border-radius:50%;background:#fff;opacity:.7}
  body.day .bg-sky-star{opacity:0}
  /* the shop */
  .bg-shop{position:absolute;left:50%;bottom:34px;transform:translateX(-50%);width:150px;transition:width .3s}
  .bg-shop.big{width:170px}
  .bg-roof{height:16px;border-radius:8px 8px 0 0;position:relative;
    background:repeating-linear-gradient(90deg,var(--roofA) 0 14px,#f7f1e2 14px 28px)}
  .bg-sign{background:#0c120e;border-left:3px solid var(--signC);border-right:3px solid var(--signC);
    text-align:center;padding:5px 4px;position:relative}
  .bg-sign b{font-family:"Alfa Slab One",Georgia,serif;font-size:11px;letter-spacing:.02em;color:var(--signC);
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;text-shadow:0 0 8px var(--signGlow)}
  .bg-sign .bulbs{position:absolute;top:-3px;left:6px;right:6px;height:4px;display:flex;justify-content:space-between}
  .bg-sign .bulbs i{width:3px;height:3px;border-radius:50%;background:var(--signC);box-shadow:0 0 5px var(--signC);
    animation:bgblink 1.6s infinite}
  .bg-body2{background:var(--faceC);border:2px solid rgba(0,0,0,.25);border-top:none;padding:8px;display:flex;gap:6px}
  .bg-window{flex:1;background:linear-gradient(180deg,#cfe6ff,#8fb8e6);border-radius:3px;min-height:56px;
    display:flex;flex-wrap:wrap;align-content:flex-end;gap:2px;padding:4px;box-shadow:inset 0 0 0 2px rgba(0,0,0,.15)}
  .bg-window span{font-size:12px;line-height:1}
  .bg-door2{width:26px;background:#2a1a10;border-radius:3px 3px 0 0;box-shadow:inset 0 0 0 2px rgba(0,0,0,.3);
    display:flex;align-items:flex-end;justify-content:center;padding-bottom:3px;font-size:9px}
  .bg-stars2{position:absolute;top:-16px;left:50%;transform:translateX(-50%);font-size:11px;color:#F1DEA2;white-space:nowrap;text-shadow:0 1px 2px #000}
  .bg-side{position:absolute;left:0;right:0;bottom:0;height:34px;
    background:repeating-linear-gradient(90deg,#26303f 0 22px,#20293580 22px 24px);border-top:3px solid #2a2118}
  body.day .bg-side{background:repeating-linear-gradient(90deg,#8b8577 0 22px,#7d776a 22px 24px)}
  .bg-cust{position:absolute;bottom:5px;font-size:16px;line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,.4));
    animation:bgwalk 6s linear infinite}
  .bg-coin2{position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:3;cursor:pointer;
    background:linear-gradient(180deg,#F1DEA2,#C9A84A);color:#14231A;font-weight:800;font-size:13px;
    border-radius:20px;padding:5px 12px;box-shadow:0 6px 18px rgba(0,0,0,.45);white-space:nowrap;
    animation:bgbob 1.4s ease-in-out infinite}
  .bg-coin2 small{font-weight:700;font-size:10px}
  .bg-fly{position:absolute;left:50%;top:40%;transform:translateX(-50%);z-index:5;font-weight:800;color:#F1DEA2;
    font-size:16px;pointer-events:none;text-shadow:0 2px 4px #000;animation:bgfly 1s ease-out forwards}
  /* locked / empty lots */
  .bg-empty{height:190px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;
    background:repeating-linear-gradient(45deg,rgba(201,168,74,.05) 0 12px,transparent 12px 24px)}
  .bg-empty .plus{width:52px;height:52px;border-radius:50%;border:2px dashed rgba(201,168,74,.5);color:#C9A84A;
    display:flex;align-items:center;justify-content:center;font-size:26px}
  .bg-empty .cap2{font-size:13px;color:#B9C3B4;text-align:center;padding:0 14px}
  .bg-empty .lock{font-size:22px}
  /* info + actions */
  .bg-info{padding:11px 12px 13px}
  .bg-nm{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
  .bg-nm b{font-size:13px;color:#EFE9D8}
  .bg-nm .ty{font-size:10.5px;color:#9AA79A;letter-spacing:.04em}
  .bg-stockbar{height:9px;border-radius:6px;background:rgba(10,13,11,.6);overflow:hidden;border:1px solid rgba(201,168,74,.2);margin-bottom:4px}
  .bg-stockbar i{display:block;height:100%;background:linear-gradient(90deg,#C9A84A,#F1DEA2);transition:width .4s}
  .bg-stocktxt{font-size:10.5px;color:#9AA79A;margin-bottom:9px}
  .bg-stocktxt.empty{color:#e0a04a}
  .bg-acts{display:grid;grid-template-columns:1fr 1fr;gap:7px}
  .bg-acts.one{grid-template-columns:1fr}
  .bg-btn{border:none;border-radius:8px;padding:9px 6px;font-family:"Work Sans";font-weight:700;font-size:11.5px;
    letter-spacing:.03em;cursor:pointer;transition:transform .1s,filter .15s}
  .bg-btn:active{transform:scale(.96)}
  .bg-btn:disabled{opacity:.45;cursor:not-allowed}
  .bg-btn .c{display:block;font-size:9.5px;font-weight:600;opacity:.8;margin-top:1px}
  .bg-collect{background:linear-gradient(180deg,#8fe25a,#4fae1f);color:#08210a}
  .bg-restock{background:linear-gradient(180deg,#F1DEA2,#C9A84A);color:#14231A}
  .bg-upg{background:rgba(245,241,230,.08);color:#EFE9D8;border:1px solid rgba(201,168,74,.35)}
  .bg-build{background:linear-gradient(180deg,#F1DEA2,#C9A84A);color:#14231A;width:100%}
  .bg-unlock{background:rgba(245,241,230,.06);color:#EFE9D8;border:1px solid rgba(201,168,74,.35)}
  .bg-note{font-size:11px;color:#7c8b7a;text-align:center;margin:6px auto 0;line-height:1.5;max-width:520px}
  .bg-note b{color:#7AD03A}
  .bg-hint{font-size:12px;color:#9AA79A;text-align:center;margin:0 0 12px}
  /* type picker modal */
  .bg-modal{position:fixed;inset:0;z-index:9200;background:rgba(4,7,5,.7);backdrop-filter:blur(3px);
    display:none;align-items:center;justify-content:center;padding:16px}
  .bg-modal.open{display:flex}
  .bg-sheet{width:100%;max-width:440px;background:#0C120E;border:1px solid rgba(201,168,74,.3);border-radius:16px;
    padding:18px;max-height:90vh;overflow:auto}
  .bg-sheet h3{font-family:"Playfair Display",Georgia,serif;font-weight:800;font-size:18px;margin:0 0 4px;text-transform:uppercase}
  .bg-sheet p{font-size:12.5px;color:#9AA79A;margin:0 0 14px}
  .bg-types{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
  .bg-type{display:flex;align-items:center;gap:9px;padding:10px;border-radius:10px;cursor:pointer;
    background:rgba(245,241,230,.04);border:1px solid rgba(201,168,74,.2)}
  .bg-type.sel{border-color:#7AD03A;box-shadow:0 0 0 1px rgba(122,208,58,.4)}
  .bg-type .em{font-size:22px}
  .bg-type b{display:block;font-size:12.5px;color:#EFE9D8}
  .bg-type span{font-size:10.5px;color:#9AA79A}
  .bg-type.lock{opacity:.5;cursor:not-allowed}
  .bg-name-in{width:100%;background:rgba(10,13,11,.6);border:1px solid rgba(201,168,74,.25);border-radius:8px;
    padding:11px;color:#F5F1E6;font-size:14px;margin-bottom:12px}
  .bg-sheet .row{display:flex;gap:8px}
  .bg-open{flex:1;background:linear-gradient(180deg,#8fe25a,#4fae1f);color:#08210a;border:none;border-radius:8px;
    padding:12px;font-weight:800;font-size:13px;cursor:pointer}
  .bg-cancel{background:none;border:1px solid rgba(201,168,74,.3);color:#9AA79A;border-radius:8px;padding:12px 16px;cursor:pointer}
  .bg-toast{position:fixed;left:50%;bottom:84px;transform:translateX(-50%) translateY(14px);z-index:9300;
    background:#12331A;color:#F5F1E6;border:1px solid rgba(201,168,74,.5);border-radius:24px;padding:10px 18px;
    font-weight:600;font-size:13px;box-shadow:0 10px 30px rgba(0,0,0,.5);opacity:0;transition:opacity .3s,transform .3s;
    pointer-events:none;white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis}
  .bg-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
  @keyframes bgblink{0%,45%{opacity:1}55%,100%{opacity:.25}}
  @keyframes bgbob{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-5px)}}
  @keyframes bgwalk{0%{left:-8%}100%{left:104%}}
  @keyframes bgfly{0%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-46px)}}
  `;

  /* ---------------- DOM ---------------- */
  var mountEl=null, toastEl=null, toastTimer=null, tick=null;
  var picker={ lot:-1, type:null };

  function el(tag, cls, html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function toast(m){ if(!toastEl) return; toastEl.textContent=m; toastEl.classList.add('show');
    clearTimeout(toastTimer); toastTimer=setTimeout(function(){ toastEl.classList.remove('show'); },2600); }

  function shopSceneHtml(lot){
    var t = TYPES[lot.type];
    var pend = pendingCoins(lot);
    var stockNow = lot.stock - soldUnits(lot);
    // window items reflect current (unsold) stock, capped visually at 12
    var shown = Math.max(0, Math.min(12, Math.round(stockNow / cap(lot) * 12)));
    var items=''; for(var w=0; w<shown; w++){ items += '<span>'+t.item+'</span>'; }
    var stars=''; for(var s=0;s<Math.min(5,lot.lvl);s++) stars+='★';
    var custs='';
    if(stockNow>0){
      var n = Math.min(4, 1 + Math.floor(lot.lvl/1));
      for(var c=0;c<n;c++){ custs += '<span class="bg-cust" style="animation-delay:'+(c*1.4)+'s">🧍</span>'; }
    }
    var starsSky=''; for(var k=0;k<7;k++){ starsSky+='<span class="bg-sky-star" style="left:'+(8+k*13)+'%;top:'+(8+(k*7)%30)+'%"></span>'; }
    var coin = pend>0 ? '<div class="bg-coin2" data-collect="'+lot._i+'">🪙 '+pend+' <small>collect</small></div>' : '';
    return (
      '<div class="bg-scene">'+
        starsSky+'<div class="moon2"></div>'+ custs + coin +
        '<div class="bg-shop'+(lot.lvl>=3?' big':'')+'" style="--faceC:'+t.face+';--roofA:'+t.roof+';--signC:'+t.sign+';--signGlow:'+t.sign+'88">'+
          '<div class="bg-stars2">'+stars+'</div>'+
          '<div class="bg-roof"></div>'+
          '<div class="bg-sign"><span class="bulbs"><i></i><i style="animation-delay:.3s"></i><i style="animation-delay:.6s"></i><i style="animation-delay:.9s"></i></span><b>'+esc(lot.name)+'</b></div>'+
          '<div class="bg-body2"><div class="bg-window">'+items+'</div><div class="bg-door2">'+t.emoji+'</div></div>'+
        '</div>'+
        '<div class="bg-side"></div>'+
      '</div>'
    );
  }

  function builtInfoHtml(lot){
    var t = TYPES[lot.type];
    var stockNow = lot.stock - soldUnits(lot);
    var pct = Math.round(stockNow / cap(lot) * 100);
    var empty = stockNow<=0;
    var pend = pendingCoins(lot);
    var rCost = restockCost(lot);
    var uCost = upgradeCost(lot);
    return (
      '<div class="bg-info">'+
        '<div class="bg-nm"><b>'+esc(lot.name)+'</b><span class="ty">'+t.name+' · Lvl '+lot.lvl+'</span></div>'+
        '<div class="bg-stockbar"><i style="width:'+Math.max(0,pct)+'%"></i></div>'+
        '<div class="bg-stocktxt'+(empty?' empty':'')+'">'+(empty?'Sold out — restock to keep selling':('Stock '+Math.max(0,stockNow)+' / '+cap(lot)))+'</div>'+
        '<div class="bg-acts">'+
          '<button class="bg-btn bg-collect" data-collect="'+lot._i+'"'+(pend>0?'':' disabled')+'>Collect<span class="c">'+(pend>0?('🪙 '+pend):'—')+'</span></button>'+
          '<button class="bg-btn bg-restock" data-restock="'+lot._i+'"'+(rCost>0?'':' disabled')+'>Restock<span class="c">🪙 '+rCost+'</span></button>'+
        '</div>'+
        '<div class="bg-acts one" style="margin-top:7px">'+
          '<button class="bg-btn bg-upg" data-upg="'+lot._i+'">Upgrade to Lvl '+(lot.lvl+1)+' <span class="c" style="display:inline">· 🪙 '+uCost+'</span></button>'+
        '</div>'+
      '</div>'
    );
  }

  function lotHtml(lot, i){
    lot._i = i;
    if(!lot.unlocked){
      var cost = CFG.lotCosts[i] || 99999;
      return '<div class="bg-lot"><div class="bg-empty"><div class="lock">🔒</div><div class="cap2">A new lot on your block</div>'+
        '<button class="bg-btn bg-unlock" data-unlock="'+i+'">Open this lot · 🪙 '+cost+'</button></div></div>';
    }
    if(!lot.built){
      return '<div class="bg-lot"><div class="bg-empty"><div class="plus">＋</div><div class="cap2">Empty lot — open a shop here</div>'+
        '<button class="bg-btn bg-build" data-build="'+i+'">Build a shop</button></div></div>';
    }
    return '<div class="bg-lot" id="bg-lot-'+i+'">'+ shopSceneHtml(lot) + builtInfoHtml(lot) + '</div>';
  }

  function hudHtml(){
    var need = LEVEL_XP(S.level);
    var pct = Math.round(S.xp/need*100);
    return (
      '<div class="bg-hud">'+
        '<div class="bg-stat"><span class="v" id="bgCoins">'+S.coins+'</span><span class="l">🪙 Coins</span></div>'+
        '<div class="bg-stat"><span class="v">🔥 '+S.streak+'</span><span class="l">day streak</span></div>'+
        '<div class="bg-lvl">'+
          '<div class="top"><span>Entrepreneur <b>Lvl '+S.level+'</b></span><span>'+S.xp+' / '+need+' XP</span></div>'+
          '<div class="bg-xp"><i style="width:'+pct+'%"></i></div>'+
        '</div>'+
      '</div>'
    );
  }

  function render(){
    if(!mountEl) return;
    var lots=''; for(var i=0;i<S.lots.length;i++){ lots += lotHtml(S.lots[i], i); }
    mountEl.className='bg-wrap';
    mountEl.innerHTML =
      hudHtml() +
      '<div class="bg-hint">Stock a shop, customers buy while you\'re away, then come back to collect. 🪙</div>'+
      '<div class="bg-strip">'+lots+'</div>'+
      '<div class="bg-note">Coins are <b>free to earn</b> by playing. They build your block, and never affect the free prize drawings.</div>';
    wire(mountEl);
  }

  function wire(root){
    each(root, '[data-collect]', 'click', function(elm){ collect(+elm.getAttribute('data-collect')); });
    each(root, '[data-restock]', 'click', function(elm){ restock(+elm.getAttribute('data-restock')); });
    each(root, '[data-upg]', 'click', function(elm){ upgrade(+elm.getAttribute('data-upg')); });
    each(root, '[data-unlock]', 'click', function(elm){ unlockLot(+elm.getAttribute('data-unlock')); });
    each(root, '[data-build]', 'click', function(elm){ openPicker(+elm.getAttribute('data-build')); });
  }
  function each(root, sel, ev, fn){
    Array.prototype.forEach.call(root.querySelectorAll(sel), function(elm){
      elm.addEventListener(ev, function(){ fn(elm); });
    });
  }

  /* live tick: update coin badges / stock without rebuilding (keeps animations smooth) */
  function live(){
    if(!mountEl) return;
    var cEl=document.getElementById('bgCoins'); if(cEl) cEl.textContent=S.coins;
    for(var i=0;i<S.lots.length;i++){
      var lot=S.lots[i]; if(!lot.built) continue;
      var host=document.getElementById('bg-lot-'+i); if(!host) continue;
      var pend=pendingCoins(lot);
      var badge=host.querySelector('.bg-coin2');
      // if a badge should appear/disappear, do a light refresh of that lot
      if((pend>0) !== !!badge){ host.outerHTML = lotHtml(lot,i); wire(mountEl); continue; }
      if(badge){ badge.innerHTML='🪙 '+pend+' <small>collect</small>'; }
      var cb=host.querySelector('.bg-collect'); if(cb){ cb.disabled=pend<=0; var cc=cb.querySelector('.c'); if(cc) cc.textContent=pend>0?('🪙 '+pend):'—'; }
    }
  }

  function coinBurst(i, amount){
    var host=document.getElementById('bg-lot-'+i); if(!host){ return; }
    var scene=host.querySelector('.bg-scene'); if(!scene) return;
    var f=el('div','bg-fly','+'+amount+' 🪙'); scene.appendChild(f);
    setTimeout(function(){ if(f.parentNode) f.parentNode.removeChild(f); }, 1000);
  }

  /* ---- build picker ---- */
  var modal=null;
  function buildModal(){
    modal=el('div','bg-modal');
    modal.addEventListener('click', function(e){ if(e.target===modal) closePicker(); });
    document.body.appendChild(modal);
  }
  function openPicker(i){
    picker.lot=i; picker.type=typesForLevel()[0];
    var avail = typesForLevel();
    var cards='';
    for(var k in TYPES){
      var t=TYPES[k], ok=t.lvlReq<=S.level;
      cards += '<div class="bg-type'+(ok?'':' lock')+(k===picker.type?' sel':'')+'" '+(ok?'data-pick="'+k+'"':'')+'>'+
        '<span class="em">'+t.emoji+'</span><div><b>'+t.name+'</b><span>'+(ok?('earns ×'+t.earn.toFixed(2)):('unlocks at Lvl '+t.lvlReq))+'</span></div></div>';
    }
    modal.innerHTML =
      '<div class="bg-sheet">'+
        '<h3>Open a shop</h3><p>Pick what you\'re selling and name it. You can build more on other lots.</p>'+
        '<input class="bg-name-in" id="bgName" maxlength="16" placeholder="Name your shop (optional)">'+
        '<div class="bg-types">'+cards+'</div>'+
        '<div class="row"><button class="bg-open" id="bgOpen">Open for business</button><button class="bg-cancel" id="bgCancel">Cancel</button></div>'+
      '</div>';
    modal.classList.add('open');
    each(modal, '[data-pick]', 'click', function(elm){
      picker.type=elm.getAttribute('data-pick');
      Array.prototype.forEach.call(modal.querySelectorAll('.bg-type'), function(c){ c.classList.remove('sel'); });
      elm.classList.add('sel');
    });
    modal.querySelector('#bgOpen').addEventListener('click', function(){
      var nm=(modal.querySelector('#bgName').value||'');
      buildShop(picker.lot, picker.type, nm); closePicker();
    });
    modal.querySelector('#bgCancel').addEventListener('click', closePicker);
  }
  function closePicker(){ if(modal) modal.classList.remove('open'); }

  /* ---------------- boot ---------------- */
  function mount(elmnt){
    if(!elmnt) return;
    mountEl=elmnt;
    if(!document.getElementById('bg-style')){ var st=el('style'); st.id='bg-style'; st.textContent=CSS; document.head.appendChild(st); }
    if(!toastEl){ toastEl=el('div','bg-toast'); document.body.appendChild(toastEl); }
    if(!modal) buildModal();
    dailyStreak();
    render();
    if(tick) clearInterval(tick);
    tick=setInterval(live, 1000);
  }

  window.SquareGame = {
    mount: mount,
    get: function(){ return JSON.parse(JSON.stringify(S)); },
    add: function(n){ S.coins += (n||0); save(); render(); }   // debug helper
  };
})();
