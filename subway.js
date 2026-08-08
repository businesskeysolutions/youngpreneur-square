// ================= RIDEABLE SUBWAY LINE (the Directory) =================
// Tap a line on the subway map to ride it: your avatar travels the platform,
// stops are storefronts (tier-styled like the walkable Square), and you enter
// a stop to lease it or visit the real shop. Reuses the Square's avatar, cards,
// controls, and building styles so it's one connected world.
(function(){
  var sq=document.getElementById('subway'); if(!sq) return;
  var world=document.getElementById('subWorld'), far=document.getElementById('subFar'),
      track=document.getElementById('subTrack'), stationsEl=document.getElementById('subStations'),
      avatar=document.getElementById('subAvatar'), starsEl=document.getElementById('subStars'),
      modal=document.getElementById('subModal'), card=document.getElementById('subCard'),
      lineBadge=document.getElementById('subLine');

  // each street maps to a price/visibility tier (drives station size + glow)
  var STREET_TIER={ 'Fifth Avenue':'fifth','Broadway':'broadway','Madison Avenue':'madison',
                    'Canal Street':'canal','Motor Row':'broadway','Union Square':'madison' };
  var TIERSPEC={ fifth:{h:284,w:172,bill:true,tag:'front row, premium'},
                 broadway:{h:210,w:150,tag:'the main strip'},
                 madison:{h:236,w:158,tag:'a growth address'},
                 canal:{h:150,w:132,tag:'a starter address'} };
  var SPACING=232, ENDPAD=200;

  var stops=[], street='', color='#F5C518', bullet='B';
  var K=1, WORLD=0, ax=150, keyL=false, keyR=false, raf=null, vw=0, near=null, nearI=-1, rzT=null;
  var clampv=function(v,a,b){return Math.max(a,Math.min(b,v));};
  var esc=function(t){return String(t||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};
  function fitK(){ var H=window.innerHeight||600, W=window.innerWidth||800; return Math.max(0.42, Math.min(1, Math.min((H-84)/470, W/760))); }

  // stars once
  for(var i=0;i<54;i++){ var s=document.createElement('i');
    s.style.left=(Math.random()*100)+'%'; s.style.top=(Math.random()*58)+'%';
    s.style.opacity=(0.3+Math.random()*0.5).toFixed(2); s.style.animationDelay=(Math.random()*5)+'s'; starsEl.appendChild(s); }

  function avatarInner(){
    var a; try{ a=JSON.parse(localStorage.getItem('yps_avatar')); }catch(e){} if(!a||!a.v) a={type:'emoji',v:'🧑'};
    var head = a.type==='img' ? '<div class="av-head" style="background-image:url('+a.v+')"></div>' : '<div class="av-head">'+a.v+'</div>';
    return '<span class="glow"></span><div class="fig">'+head+'<div class="av-torso"></div><div class="leg l"></div><div class="leg r"></div></div>';
  }
  function tierKey(){ return STREET_TIER[street]||'broadway'; }

  function stationHtml(sp,i){
    var tk=tierKey(), T=TIERSPEC[tk];
    var open=sp.status==='available', donated=sp.status==='donated';
    var cls='sq-b t-'+tk+(open?' open':'');
    var chipCls = tk==='fifth'?'tier-hi':(tk==='canal'?'tier-lo':'tier-mid');
    var chip = open?'✦ For lease':(donated?'★ Cornerstone':'✦ Leased');
    var brand = open?'Open spot':(sp.tenant||'Leased');
    var bill = T.bill ? '<div class="sq-bill"><span>'+(open?'Prime Fifth Avenue · your brand here':(esc(brand)+' · on Fifth Avenue'))+'</span></div>' : '';
    var loc = (sp.number!=null?(sp.number+(sp.unit||'')+' · '):'')+street;
    var x=150+i*SPACING;
    return '<div class="'+cls+'" data-i="'+i+'" style="left:'+(x*K)+'px;width:'+(T.w*K)+'px;height:'+(T.h*K)+'px">'+
      '<div class="stn-post"></div>'+
      '<div class="sq-board">'+bill+'<div class="b-chip '+chipCls+'">'+chip+'</div>'+
      '<div class="b-brand">'+esc(brand)+'</div><div class="b-loc">'+esc(loc)+'</div><div class="enter-tag">Enter ↑</div></div></div>';
  }

  // collectible coins (once per coin per day)
  function wcoinDay(){ return new Date().toISOString().slice(0,10); }
  function wcoinGot(){ try{ var w=JSON.parse(localStorage.getItem('yps_wcoins')); if(w&&w.day===wcoinDay()) return w.got||{}; }catch(e){} return {}; }
  function collectCoin(c){ if(c.__done) return; c.__done=true;
    var g=wcoinGot(); g[c.dataset.cid]=1; try{ localStorage.setItem('yps_wcoins', JSON.stringify({day:wcoinDay(),got:g})); }catch(e){}
    if(window.SquareGame && window.SquareGame.reward) window.SquareGame.reward(5, '🪙 +5 coins');
    c.classList.add('pop'); setTimeout(function(){ if(c.parentNode) c.parentNode.removeChild(c); },380); }
  function placeCoins(){
    var got=wcoinGot(), n=Math.min(5, Math.floor(stops.length/2)), xs=[];
    for(var k=0;k<n;k++) xs.push({id:'sub:'+street+':'+k, cx:150+(k*2+1.4)*SPACING});
    xs.forEach(function(o){ if(got[o.id]) return;
      var c=document.createElement('div'); c.className='wcoin'; c.innerHTML='<span class="yc"></span>';
      c.style.left=(o.cx*K)+'px'; c.dataset.cid=o.id; c.__wx=o.cx*K;
      c.addEventListener('click',function(e){ e.stopPropagation(); collectCoin(c); });
      stationsEl.appendChild(c); });
  }

  function layout(){
    K=fitK();
    var count=stops.length;
    WORLD=(150+count*SPACING+ENDPAD)*K;
    var html=''; for(var i=0;i<count;i++) html+=stationHtml(stops[i],i);
    stationsEl.innerHTML=html; stationsEl.style.width=WORLD+'px';
    Array.prototype.forEach.call(stationsEl.querySelectorAll('.sq-b'), function(el){
      el.__cx=parseFloat(el.style.left)+parseFloat(el.style.width)/2;
      el.addEventListener('click', function(){ openStop(+el.getAttribute('data-i')); });
    });
    placeCoins();
    track.style.width=WORLD+'px'; track.style.setProperty('--ln', color);
    far.style.width=WORLD+'px';
    ax=clampv(ax,60,WORLD-60);
  }

  function frame(){
    var dir=(keyR?1:0)-(keyL?1:0);
    if(dir!==0){ ax+=dir*4.6; avatar.classList.add('walk'); avatar.classList.toggle('left',dir<0); }
    else avatar.classList.remove('walk');
    ax=clampv(ax,60,WORLD-60);
    var cam = WORLD<=vw?0:clampv(ax-vw/2,0,WORLD-vw);
    far.style.transform='translateX('+(-cam*0.4)+'px)';
    track.style.transform='translateX('+(-cam)+'px)';
    stationsEl.style.transform='translateX('+(-cam)+'px)';
    avatar.style.left=(ax-cam-21)+'px';
    var best=null, bd=150*K, sts=stationsEl.querySelectorAll('.sq-b');
    for(var i=0;i<sts.length;i++){ var d=Math.abs(ax-sts[i].__cx); if(d<bd){ bd=d; best=sts[i]; } }
    if(best!==near){ if(near) near.classList.remove('near'); near=best; if(near) near.classList.add('near'); nearI = best?+best.getAttribute('data-i'):-1; }
    var coins=stationsEl.querySelectorAll('.wcoin');
    for(var ci=0;ci<coins.length;ci++){ if(!coins[ci].__done && Math.abs(ax-coins[ci].__wx)<34) collectCoin(coins[ci]); }
    raf=requestAnimationFrame(frame);
  }

  function openStop(i){
    var sp=stops[i]; if(!sp) return;
    var tk=tierKey(), T=TIERSPEC[tk], open=sp.status==='available', donated=sp.status==='donated';
    var badge,title,sub='',text,btn;
    if(open){
      badge='✦ For lease · '+street;
      title = tk==='fifth' ? 'A prime Fifth Avenue stop' : (tk==='canal' ? 'A starter stop on Canal Street' : 'An open stop on '+street);
      text='A storefront on the '+street+' line, '+T.tag+'. Lease it and link it straight to your own shop, you keep every sale.';
      btn='<a class="btn" href="lease.html#join">Lease this '+street+' spot</a>';
    } else {
      badge=(donated?'★ Cornerstone · ':'✦ Leased · ')+street;
      title=sp.tenant||'Leased storefront'; sub=sp.category||'';
      var vis = tk==='fifth' ? ' One of the most-seen stops on the map.' : (tk==='canal' ? ' A quieter stop on an outer line.' : '');
      text=(donated
        ? "A Cornerstone founder's storefront, funded by the mission or a sponsor. It links out to their own shop."
        : "A leased storefront. It links straight to the business's own shop, the Square is the landlord, never the cashier.")+vis;
      btn = sp.shop ? '<a class="btn" href="'+esc(sp.shop)+'" target="_blank" rel="noopener">Visit the shop ↗</a>'
                    : '<span class="c-demo">Example storefront · demo</span>';
    }
    card.innerHTML='<button class="c-close" id="subCardClose" aria-label="Close">✕</button>'+
      '<div class="c-badge">'+badge+'</div><h3 class="grad-gold">'+esc(title)+'</h3>'+
      (sub?'<div class="c-who">'+esc(sub)+'</div>':'')+'<p>'+text+'</p><div class="c-actions">'+btn+'</div>';
    modal.classList.add('open'); document.getElementById('subCardClose').onclick=closeModal;
  }
  function closeModal(){ modal.classList.remove('open'); }
  modal.addEventListener('click',function(e){ if(e.target===modal) closeModal(); });

  function ride(st, list, opts){
    street=st; stops=(list||[]).slice(0,26);
    opts=opts||{}; color=opts.color||'#F5C518'; bullet=opts.bullet||(st?st[0]:'·');
    lineBadge.innerHTML='<span class="sub-bull" style="background:'+color+'">'+bullet+'</span> '+esc(st)+' line';
    avatar.innerHTML=avatarInner();
    sq.classList.add('open'); sq.setAttribute('aria-hidden','false'); document.body.classList.add('sq-lock');
    ax=150; layout(); vw=world.clientWidth||window.innerWidth; if(!raf) raf=requestAnimationFrame(frame);
  }
  function close(){ sq.classList.remove('open'); sq.setAttribute('aria-hidden','true'); document.body.classList.remove('sq-lock');
    if(raf){ cancelAnimationFrame(raf); raf=null; } keyL=keyR=false; near=null; nearI=-1; closeModal(); }

  document.getElementById('subClose').addEventListener('click',close);
  window.addEventListener('keydown',function(e){ if(!sq.classList.contains('open'))return; var k=e.key;
    if(k==='ArrowLeft'||k==='a'||k==='A'){keyL=true;e.preventDefault();}
    else if(k==='ArrowRight'||k==='d'||k==='D'){keyR=true;e.preventDefault();}
    else if(k==='ArrowUp'||k==='w'||k==='W'||k===' '){ if(nearI>=0) openStop(nearI); e.preventDefault(); }
    else if(k==='Escape'){ if(modal.classList.contains('open')) closeModal(); else close(); } });
  window.addEventListener('keyup',function(e){ var k=e.key;
    if(k==='ArrowLeft'||k==='a'||k==='A')keyL=false; if(k==='ArrowRight'||k==='d'||k==='D')keyR=false; });
  function hold(id,set){ var el=document.getElementById(id); if(!el)return;
    var on=function(e){e.preventDefault();set(true);}, off=function(e){e.preventDefault();set(false);};
    el.addEventListener('pointerdown',on); el.addEventListener('pointerup',off);
    el.addEventListener('pointerleave',off); el.addEventListener('pointercancel',off); }
  hold('subLeft',function(v){keyL=v;}); hold('subRight',function(v){keyR=v;});
  window.addEventListener('resize',function(){ vw=world.clientWidth||window.innerWidth;
    clearTimeout(rzT); rzT=setTimeout(function(){ if(sq.classList.contains('open')) layout(); },160); });

  window.SquareSubway={ ride:ride };
})();
