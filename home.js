  // ================= WALKABLE "ENTER THE SQUARE" =================
  (function(){
    const sq=document.getElementById('square'), world=document.getElementById('sqWorld'),
      far=document.getElementById('sqFar'), mid=document.getElementById('sqMid'), ground=document.getElementById('sqGround'),
      avatar=document.getElementById('sqAvatar'), starsEl=document.getElementById('sqStars'),
      modal=document.getElementById('sqModal'), card=document.getElementById('sqCard');

    const PLOTS=[
      {x:220,w:150,h:150,cls:'sage', type:'shop',    brand:'Vertex Tech',    loc:'Skyline',   who:'Student-run tech studio',            url:'#'},
      {x:470,w:162,h:214,cls:'gold', type:'awarded', brand:"Zoe's Bakeshop", loc:'Corner',    who:'Cottage bakery · founder, age 15',   url:'https://example.com/zoes-bakeshop'},
      {x:730,w:150,h:150,             type:'open'},
      {x:970,w:168,h:250,cls:'cream',type:'shop',    brand:'Kayden Customs', loc:'Runway', who:'Sneaker customs · age 17',           url:'https://example.com/kayden-customs'},
      {x:1240,w:212,h:322,           type:'marquee'},
      {x:1545,w:162,h:242,cls:'gold',type:'awarded', brand:'Bloom by Amara', loc:'Center',    who:'Pressed-flower jewelry · age 16',    url:'https://example.com/bloom-by-amara'},
      {x:1805,w:150,h:150,           type:'open'},
      {x:2040,w:162,h:202,cls:'brass',type:'shop',   brand:'Deveny Reads',   loc:'Gateway',   who:'Book subscription boxes · age 14',   url:'#'},
      {x:2300,w:158,h:174,cls:'cream',type:'shop',   brand:'Nova Skate',     loc:'Plaza',     who:'Skate brand · age 17',              url:'#'}
    ];
    const WORLD=Math.max.apply(null,PLOTS.map(p=>p.x+p.w))+380;

    // build stars
    for(let i=0;i<54;i++){const s=document.createElement('i');
      s.style.left=Math.random()*100+'%';s.style.top=Math.random()*58+'%';
      s.style.opacity=(.3+Math.random()*.5).toFixed(2);s.style.animationDelay=(Math.random()*5)+'s';starsEl.appendChild(s);}

    // far silhouette
    far.style.width=WORLD+'px';
    for(let x=-40;x<WORLD;x+=Math.round(56+Math.random()*46)){
      const fb=document.createElement('div');fb.className='fb';
      fb.style.left=x+'px';fb.style.width=Math.round(34+Math.random()*30)+'px';
      fb.style.height=Math.round(70+Math.random()*120)+'px';far.appendChild(fb);}

    // ground: road + curb + lamps
    ground.style.width=WORLD+'px';
    const road=document.createElement('div');road.className='road';road.style.width=WORLD+'px';ground.appendChild(road);
    const curb=document.createElement('div');curb.className='curb';curb.style.width=WORLD+'px';ground.appendChild(curb);
    for(let x=120;x<WORLD;x+=280){const lp=document.createElement('div');lp.className='lamp';lp.style.left=x+'px';ground.appendChild(lp);}

    // buildings
    mid.style.width=WORLD+'px';
    function build(p){
      const b=document.createElement('div');
      b.className='sq-b '+(p.cls||'')+(p.type==='open'?' open':'')+(p.type==='marquee'?' marquee':'');
      b.style.left=p.x+'px';b.style.width=p.w+'px';b.style.height=p.h+'px';
      if(p.type==='marquee'){
        b.innerHTML='<div class="sq-marq"><div class="mbulbs"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>'+
          '<div class="k">The Landmark</div><div class="name grad-gold">The Tower</div><div class="now">One brand at a time</div>'+
          '<div class="enter-tag">Enter ↑</div></div>';
      }else if(p.type==='open'){
        b.innerHTML='<div class="sq-board"><div class="b-brand">For lease</div><div class="enter-tag">Lease ↑</div></div>';
      }else{
        const chip=p.type==='awarded'?'<div class="b-chip">★ Liftoff</div>':'<div class="b-chip">✦ Leased</div>';
        b.innerHTML='<div class="sq-board">'+chip+'<div class="b-brand">'+p.brand+'</div><div class="b-loc">'+p.loc+'</div><div class="enter-tag">Enter ↑</div></div>';
      }
      b.addEventListener('click',function(){openPlot(p);});
      p.el=b;p.center=p.x+p.w/2;mid.appendChild(b);
    }
    PLOTS.forEach(build);

    // ---- movement + camera ----
    let ax=140, keyL=false, keyR=false, raf=null, vw=0, near=null;
    const clampv=(v,a,b)=>Math.max(a,Math.min(b,v));
    function resize(){vw=world.clientWidth||window.innerWidth;}
    window.addEventListener('resize',resize);

    function frame(){
      const dir=(keyR?1:0)-(keyL?1:0);
      if(dir!==0){ ax+=dir*4.4; avatar.classList.add('walk'); avatar.classList.toggle('left',dir<0); }
      else avatar.classList.remove('walk');
      ax=clampv(ax,60,WORLD-60);
      let cam = WORLD<=vw ? 0 : clampv(ax-vw/2, 0, WORLD-vw);
      far.style.transform='translateX('+(-cam*0.4)+'px)';
      ground.style.transform='translateX('+(-cam)+'px)';
      mid.style.transform='translateX('+(-cam)+'px)';
      avatar.style.left=(ax-cam-21)+'px';
      // proximity
      let best=null,bd=150;
      for(const p of PLOTS){const d=Math.abs(ax-p.center);if(d<bd){bd=d;best=p;}}
      if(best!==near){ if(near&&near.el)near.el.classList.remove('near'); near=best; if(near&&near.el)near.el.classList.add('near'); }
      raf=requestAnimationFrame(frame);
    }

    // ---- modal ----
    function openPlot(p){
      let badge,title,who='',text,btnHtml;
      if(p.type==='marquee'){
        badge='★ The Landmark';title='The Tower';
        text='One sign, dead center, taken by a single brand at a time — reserved for launch weeks, holiday takeovers, and the nights the whole square shows up.';
        btnHtml='<a class="btn" href="#">Join the waitlist</a>';
      }else if(p.type==='open'){
        badge='✦ For lease';title='Available storefront';
        text='An open address on the strip. Lease it and link it straight to your own shop — you keep every sale.';
        btnHtml='<a class="btn" href="#">Lease this spot</a>';
      }else{
        badge=p.type==='awarded'?'★ Liftoff · Spotlight':'✦ Paid · Leased';title=p.brand;who=p.who;
        text=p.type==='awarded'
          ? "A Spotlight founder's storefront, funded by the mission or a sponsor. It links out to their own shop — the Square never holds the sale."
          : "A leased storefront. It links straight to the business's own shop — the Square is the landlord, never the cashier.";
        btnHtml='<a class="btn" href="'+p.url+'" target="_blank" rel="noopener">Visit the shop ↗</a>';
      }
      card.innerHTML='<button class="c-close" id="sqCardClose" aria-label="Close">✕</button>'+
        '<div class="c-badge">'+badge+'</div><h3 class="grad-gold">'+title+'</h3>'+
        (who?'<div class="c-who">'+who+'</div>':'')+'<p>'+text+'</p><div class="c-actions">'+btnHtml+'</div>';
      modal.classList.add('open');
      document.getElementById('sqCardClose').onclick=closeModal;
    }
    function closeModal(){ modal.classList.remove('open'); }
    modal.addEventListener('click',function(e){ if(e.target===modal) closeModal(); });

    // ---- open / close the square ----
    // ---- strip sky follows the same day/night as the rest of the site ----
    const sunEl=document.getElementById('sqSun'), moonEl=document.getElementById('sqMoon');
    const clampc=x=>Math.max(0,Math.min(1,x));
    function placeC(el,frac,op){const x=54+clampc(frac)*40,elev=Math.sin(clampc(frac)*Math.PI),top=82-elev*70;
      el.style.left=x+'%';el.style.top=top+'%';el.style.opacity=op;}
    function syncSky(){
      const b=document.body.classList;
      if(b.contains('day')){ placeC(sunEl,0.5,1); moonEl.style.opacity=0; starsEl.style.opacity=0; }
      else if(b.contains('dawn')){ placeC(sunEl,0.14,.85); placeC(moonEl,0.95,.35); starsEl.style.opacity=.4; }
      else if(b.contains('dusk')){ placeC(sunEl,0.9,.85); placeC(moonEl,0.08,.4); starsEl.style.opacity=.45; }
      else { placeC(moonEl,0.5,.95); sunEl.style.opacity=0; starsEl.style.opacity=1; }
    }
    setInterval(()=>{ if(sq.classList.contains('open')) syncSky(); }, 60000);

    function openSquare(e){ if(e)e.preventDefault();
      sq.classList.add('open'); sq.setAttribute('aria-hidden','false'); document.body.classList.add('sq-lock');
      syncSky(); resize(); if(!raf) raf=requestAnimationFrame(frame); }
    function closeSquare(){ sq.classList.remove('open'); sq.setAttribute('aria-hidden','true');
      document.body.classList.remove('sq-lock'); if(raf){cancelAnimationFrame(raf);raf=null;} keyL=keyR=false; closeModal(); }

    document.querySelectorAll('.enter-square').forEach(el=>el.addEventListener('click',openSquare));
    document.getElementById('sqClose').addEventListener('click',closeSquare);

    // keyboard
    window.addEventListener('keydown',function(e){
      if(!sq.classList.contains('open'))return;
      const k=e.key;
      if(k==='ArrowLeft'||k==='a'||k==='A'){keyL=true;e.preventDefault();}
      else if(k==='ArrowRight'||k==='d'||k==='D'){keyR=true;e.preventDefault();}
      else if(k==='ArrowUp'||k==='w'||k==='W'||k===' '){ if(near)openPlot(near); e.preventDefault(); }
      else if(k==='Escape'){ if(modal.classList.contains('open'))closeModal(); else closeSquare(); }
    });
    window.addEventListener('keyup',function(e){
      const k=e.key;
      if(k==='ArrowLeft'||k==='a'||k==='A')keyL=false;
      if(k==='ArrowRight'||k==='d'||k==='D')keyR=false;
    });
    // on-screen buttons (hold to walk)
    function hold(id,set){ const el=document.getElementById(id);
      const on=e=>{e.preventDefault();set(true);}, off=e=>{e.preventDefault();set(false);};
      el.addEventListener('pointerdown',on); el.addEventListener('pointerup',off);
      el.addEventListener('pointerleave',off); el.addEventListener('pointercancel',off);
    }
    hold('sqLeft',v=>keyL=v); hold('sqRight',v=>keyR=v);
  })();
  // ================= BALL-DROP TAKEOVER =================
  (function(){
    const bd=document.getElementById('balldrop'), ball=document.getElementById('bdBall'),
      num=document.getElementById('bdNum'), countBox=document.getElementById('bdCount'),
      takeover=document.getElementById('bdTakeover'), marq=document.getElementById('bdMarq'),
      confetti=document.getElementById('bdConfetti'), flash=document.getElementById('bdFlash'),
      starsBox=document.getElementById('bdStars');
    // demo length in seconds; set SQUARE_CONFIG.ballDropSeconds or a real date later
    const DROP = (window.SQUARE_CONFIG && SQUARE_CONFIG.ballDropSeconds) || 10;
    // stars
    for(let i=0;i<60;i++){const s=document.createElement('i');s.style.left=Math.random()*100+'%';
      s.style.top=Math.random()*66+'%';s.style.opacity=(.3+Math.random()*.5).toFixed(2);
      s.style.animationDelay=(Math.random()*5)+'s';starsBox.appendChild(s);}
    // confetti pieces
    const COLORS=['#c9a84a','#e9cf8a','#f5f1e6','#7ad03a'];
    for(let i=0;i<70;i++){const c=document.createElement('i');c.style.left=Math.random()*100+'%';
      c.style.background=COLORS[i%COLORS.length];c.style.setProperty('--t',(2.4+Math.random()*2.2).toFixed(2)+'s');
      c.dataset.delay=(Math.random()*.8).toFixed(2);confetti.appendChild(c);}

    let timer=null;
    function reset(){
      clearInterval(timer);
      ball.classList.remove('drop','burst'); marq.classList.remove('lit');
      takeover.classList.remove('show'); flash.classList.remove('go');
      countBox.style.opacity='1'; num.textContent=DROP; num.classList.remove('grad-gold');
      ball.style.transition='none'; ball.style.top='5%';
      [...confetti.children].forEach(c=>c.classList.remove('go'));
      // force reflow so the reset position sticks before we animate
      void ball.offsetWidth;
    }
    function run(){
      reset();
      ball.style.setProperty('--drop', DROP+'s');
      requestAnimationFrame(()=>{ ball.classList.add('drop'); ball.style.top='51%';
        let n=DROP; num.textContent=n;
        timer=setInterval(()=>{ n--; if(n>0){ num.textContent=n; if(n<=3) num.classList.add('grad-gold'); }
          else { clearInterval(timer); zero(); } }, 1000);
      });
    }
    function zero(){
      num.textContent='0';
      ball.classList.add('burst');
      flash.classList.add('go');
      marq.classList.add('lit');
      [...confetti.children].forEach(c=>{ setTimeout(()=>c.classList.add('go'), (parseFloat(c.dataset.delay)||0)*1000); });
      setTimeout(()=>{ countBox.style.opacity='0'; takeover.classList.add('show'); }, 700);
    }
    function open(e){ if(e)e.preventDefault(); bd.classList.add('open'); bd.setAttribute('aria-hidden','false');
      document.body.classList.add('sq-lock'); run(); }
    function close(){ bd.classList.remove('open'); bd.setAttribute('aria-hidden','true');
      document.body.classList.remove('sq-lock'); clearInterval(timer); }

    document.querySelectorAll('.balldrop-open').forEach(el=>el.addEventListener('click',open));
    document.getElementById('bdClose').addEventListener('click',close);
    document.getElementById('bdReplay').addEventListener('click',run);
    window.addEventListener('keydown',e=>{ if(bd.classList.contains('open')&&e.key==='Escape') close(); });
  })();
