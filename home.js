// ============ SITE-WIDE: day/night palette, marquee lights, nav, footer year ============
// Safe on every page — every DOM lookup is guarded, so pages without a hero sky
// still get the time-of-day palette and a working nav.
(function(){
  // ---- footer year ----
  var y = document.getElementById('yr'); if (y) y.textContent = new Date().getFullYear();

  // ---- mobile nav toggle ----
  var burger = document.getElementById('navBurger'), menu = document.getElementById('navMenu');
  if (burger && menu) burger.addEventListener('click', function(){ menu.classList.toggle('open'); });

  // ---- hero sky (home only) ----
  var stars = document.getElementById('stars');
  if (stars) {
    for (var i=0;i<70;i++){ var s=document.createElement('div'); s.className='star';
      s.style.left=Math.random()*100+'%'; s.style.top=Math.random()*55+'%';
      s.style.animationDelay=(Math.random()*5)+'s'; stars.appendChild(s); }
  }
  var far = document.getElementById('far');
  if (far) { [40,62,50,72,45,80,55,68,48,75,52,60,44,70,50].forEach(function(h){
    var d=document.createElement('div'); d.style.width=(20+Math.random()*26)+'px'; d.style.height=h+'%'; far.appendChild(d); }); }

  var sunEl=document.getElementById('sun'), moonEl=document.getElementById('moon'),
      starsEl=document.getElementById('stars'), btn=document.getElementById('toggle');
  var hasSky = !!(sunEl && moonEl && starsEl);
  var clamp=function(x){return Math.max(0,Math.min(1,x));};
  var smooth=function(a,b,x){x=clamp((x-a)/(b-a));return x*x*(3-2*x);};
  function place(el,frac,op){ if(!el) return 0;
    var x=54+clamp(frac)*40, elev=Math.sin(clamp(frac)*Math.PI), top=86-elev*74;
    el.style.left=x+'%'; el.style.top=top+'%'; el.style.opacity=op; return elev; }
  function phaseFor(h){ if(h<6||h>=20)return 'night'; if(h<8)return 'dawn'; if(h<17)return 'day'; return 'dusk'; }
  function applyAuto(){
    var d=new Date(), h=d.getHours()+d.getMinutes()/60;
    document.body.classList.remove('day','dawn','dusk','night');
    document.body.classList.add(phaseFor(h));
    if(!hasSky) return;
    var sf=(h-6)/14, sOp=smooth(5.5,6.8,h)*(1-smooth(19.2,20.6,h));
    var elev=place(sunEl,sf,sOp);
    sunEl.style.boxShadow = elev<0.28 ? '0 0 120px 46px rgba(255,120,50,.4)' : '0 0 120px 42px rgba(255,190,80,.35)';
    var mh = h>=18 ? h-18 : h+6;
    var mOp = h>=18 ? smooth(18,19.6,h) : (h<=7.5 ? 1-smooth(6,7.5,h) : 0);
    place(moonEl, mh/12, mOp);
    starsEl.style.opacity = (h>=20||h<6) ? 1 : (h>=19?smooth(19,20,h):(h<6.5?1-smooth(5,6.5,h):0));
  }
  var mode='auto';
  function render(){
    if(mode==='auto'){ applyAuto(); }
    else if(mode==='day'){ document.body.classList.remove('dawn','dusk','night'); document.body.classList.add('day');
      if(hasSky){ place(sunEl,0.5,1); moonEl.style.opacity=0; starsEl.style.opacity=0; } }
    else { document.body.classList.remove('day','dawn','dusk'); document.body.classList.add('night');
      if(hasSky){ place(moonEl,0.5,.95); sunEl.style.opacity=0; starsEl.style.opacity=1; } }
    if(btn) btn.textContent = mode==='auto' ? 'Auto' : mode==='day' ? 'Day' : 'Night';
  }
  if(btn) btn.addEventListener('click', function(){ mode = mode==='auto'?'day':mode==='day'?'night':'auto'; render(); });
  render();
  setInterval(function(){ if(mode==='auto') applyAuto(); }, 60000);

  // ---- marquee logo bulbs (home) ----
  (function(){
    var frame=document.querySelector('.lm-frame'); if(!frame) return;
    var mk=function(cls,n,vertical){ var s=document.createElement('span'); s.className=(vertical?'bulb-col ':'bulb-row ')+cls;
      for(var i=0;i<n;i++){ var d=document.createElement('span'); d.className='bulb'; s.appendChild(d); } return s; };
    var top=mk('top',16,false), right=mk('right',7,true), bottom=mk('bottom',16,false), left=mk('left',7,true);
    frame.append(top,right,bottom,left);
    var order=[].concat([].slice.call(top.children),[].slice.call(right.children),
      [].slice.call(bottom.children).reverse(),[].slice.call(left.children).reverse());
    var step=1.5/order.length;
    order.forEach(function(b,i){ b.style.animationDelay=(i*step).toFixed(3)+'s'; });
  })();
  // ---- small marquee running lights ----
  document.querySelectorAll('.marquee-sign .bulbs, .sq-marq .mbulbs, .bd-marq .mbulbs').forEach(function(row){
    var kids=[].slice.call(row.children), n=kids.length||1, dur=1.3;
    kids.forEach(function(b,i){ b.style.animationDuration=dur+'s'; b.style.animationDelay=((i/n)*dur).toFixed(3)+'s'; });
  });
})();
