/* Youngpreneur Square — cross-page coin bridge
   Replaces the old game.js layer on the directory. ONE currency: the block
   game's save (yps_block_v1). Safe read-modify-write — only ever touches the
   coin count and a small `sqVisit`/`sqLog` field, so visiting the directory can
   NEVER overwrite the 3D game's shops/districts/progress.

   Earns block coins for:
     • collecting subway coins (subway.js already calls SquareGame.reward)
     • genuinely visiting a business: you must stay on a storefront ~30s, and it
       takes several distinct businesses in a day before a coin reward is paid,
       so one quick visit earns nothing.
*/
(function(){
  var LS = 'yps_block_v1';
  var DWELL_MS   = (typeof window!=='undefined' && window.YPS_DWELL_MS) || 30000; // ~30s on a storefront before it counts (test-overridable)
  var VISIT_TIERS = [{n:3, rw:200}, {n:6, rw:350}, {n:10, rw:600}]; // pay only after several visits

  /* ---- safe storage: preserve every other field the block game owns ---- */
  function read(){ try{ return JSON.parse(localStorage.getItem(LS)) || {}; }catch(e){ return {}; } }
  function write(o){ try{ localStorage.setItem(LS, JSON.stringify(o)); }catch(e){} }
  function coins(){ return read().coins || 0; }
  function addCoins(n, note){
    n = Math.max(0, Math.round(n||0)); if(!n){ return coins(); }
    var o = read();
    o.coins = (o.coins||0) + n;
    if(note){ o.sqLog = o.sqLog || []; o.sqLog.push({n:n, t:note}); while(o.sqLog.length>20) o.sqLog.shift(); }
    write(o); updateFab(); return o.coins;
  }
  function today(){ return new Date().toISOString().slice(0,10); }
  function getVisit(){ var o=read(); var s=o.sqVisit; if(!s||s.day!==today()){ s={day:today(),refs:{},count:0,paid:[]}; o.sqVisit=s; write(o); } return s; }

  /* ---- a genuine business visit (called after dwell) ---- */
  function qualifyVisit(name){
    if(!name) return;
    var o = read(); var s = o.sqVisit;
    if(!s || s.day!==today()){ s = {day:today(), refs:{}, count:0, paid:[]}; }
    if(s.refs[name]){ toast('🏪 Already explored '+name+' today'); return; }
    s.refs[name] = 1; s.count = (s.count||0) + 1;
    var reward = 0;
    VISIT_TIERS.forEach(function(t,i){ if(s.count>=t.n && s.paid.indexOf(i)<0){ s.paid.push(i); reward += t.rw; } });
    o.sqVisit = s; write(o);
    if(reward){
      addCoins(reward, 'Explored '+s.count+' businesses on the Square');
      toast('🪙 +'+reward+' coins added to your Block! ('+s.count+' businesses explored today)');
    } else {
      var next = null; for(var i=0;i<VISIT_TIERS.length;i++){ if(s.count<VISIT_TIERS[i].n){ next=VISIT_TIERS[i]; break; } }
      var need = next ? (next.n - s.count) : 0;
      toast('🏪 Explored '+name+' — '+s.count+' today'+(need?(' · '+need+' more for a coin reward'):' · all rewards claimed!'));
    }
    updateFab();
  }

  /* ---- dwell timer (pauses when the tab is hidden) ---- */
  var timer=null, dwellName=null, left=0, last=0;
  function startDwell(name){
    stopDwell(); dwellName=name; left=DWELL_MS; last=Date.now();
    toast('⏳ Take a look around — stay ~30s to log this visit'); tick();
  }
  function tick(){
    if(!dwellName) return;
    var now = Date.now();
    if(!document.hidden){ left -= (now - last); }
    last = now;
    if(left <= 0){ var n = dwellName; stopDwell(); qualifyVisit(n); return; }
    timer = setTimeout(tick, 500);
  }
  function stopDwell(){ if(timer){ clearTimeout(timer); timer=null; } dwellName=null; }
  document.addEventListener('visibilitychange', function(){ last = Date.now(); });

  /* ---- watch the subway storefront modal for a business opening ---- */
  function watchStops(){
    var modal = document.getElementById('subModal');
    var card  = document.getElementById('subCard');
    if(!modal || !card) return;
    function check(){
      if(modal.classList.contains('open')){
        var badge = (card.querySelector('.c-badge')||{}).textContent || '';
        var name  = (card.querySelector('h3')||{}).textContent || '';
        var isBusiness = /Leased|Cornerstone/i.test(badge);   // a real tenant, not an empty lot
        if(isBusiness && name){ if(dwellName !== name) startDwell(name); }
        else stopDwell();
      } else stopDwell();
    }
    new MutationObserver(check).observe(modal, {attributes:true, attributeFilter:['class']});
    new MutationObserver(check).observe(card, {childList:true, subtree:true});
  }

  /* ---- window.SquareGame shim (subway.js calls .reward on coin pickup) ---- */
  window.SquareGame = window.SquareGame || {};
  window.SquareGame.reward      = function(n, msg){ addCoins(n, null); if(msg) toast(msg); };
  window.SquareGame.rewardVisit = function(){ return false; };  // legacy no-ops (visits handled by dwell now)
  window.SquareGame.rewardToken = function(){ return false; };
  window.SquareGame.get         = function(){ return read(); };

  /* ---- the floating "Your Block" coin button ---- */
  function updateFab(){ var f=document.getElementById('bgFabCoins'); if(f) f.textContent = (coins()).toLocaleString(); }
  function buildFab(){
    if(document.getElementById('bgFab')) return;
    var a = document.createElement('a');
    a.id='bgFab'; a.className='bg-fab'; a.href='block.html';
    a.setAttribute('aria-label','Open your Block');
    a.innerHTML = '<span class="yc"></span> <b id="bgFabCoins">'+(coins()).toLocaleString()+'</b> · Your Block';
    document.body.appendChild(a);
  }

  /* ---- self-contained toast + styles ---- */
  var toT;
  function toast(msg){ var t=document.getElementById('yps-btoast'); if(!t){ t=document.createElement('div'); t.id='yps-btoast'; document.body.appendChild(t);} t.textContent=msg; t.className='on'; clearTimeout(toT); toT=setTimeout(function(){ t.className=''; }, 2800); }
  function css(){
    var s=document.createElement('style'); s.id='yps-bridge-css';
    s.textContent =
      '.bg-fab{position:fixed;right:14px;bottom:14px;z-index:60;display:flex;align-items:center;gap:7px;background:linear-gradient(180deg,#fffdf6,#f0e6cf);color:#233;border:2px solid #e0be5e;border-radius:22px;padding:8px 15px;font:800 15px/1 "Work Sans",system-ui,sans-serif;text-decoration:none;box-shadow:0 4px 12px rgba(0,0,0,.3)}'+
      '.bg-fab .yc{width:16px;height:16px;border-radius:50%;background:radial-gradient(circle at 34% 30%,#fff7d8,#F4E3A6 45%,#c9a84a);border:1px solid #a5822f;display:inline-block;position:relative}'+
      '.bg-fab .yc::after{content:"Y";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 9px Georgia;color:#8a6a1f}'+
      '#yps-btoast{position:fixed;left:50%;bottom:74px;transform:translateX(-50%) translateY(8px);z-index:61;background:rgba(8,11,9,.92);color:#F5F1E6;border:1px solid rgba(227,192,90,.4);font:600 13px "Work Sans",system-ui,sans-serif;padding:9px 16px;border-radius:20px;opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;max-width:82vw;text-align:center}'+
      '#yps-btoast.on{opacity:1;transform:translateX(-50%) translateY(0)}';
    document.head.appendChild(s);
  }

  function init(){ css(); buildFab(); watchStops(); updateFab(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
