  // ================= WALKABLE "ENTER THE SQUARE" =================
  (function(){
    const sq=document.getElementById('square'), world=document.getElementById('sqWorld'),
      far=document.getElementById('sqFar'), mid=document.getElementById('sqMid'), ground=document.getElementById('sqGround'),
      avatar=document.getElementById('sqAvatar'), starsEl=document.getElementById('sqStars'),
      modal=document.getElementById('sqModal'), card=document.getElementById('sqCard');

    // Tiers = the price/visibility ladder. Higher tiers are taller, brighter,
    // more central, and (for Fifth Avenue) get a lit scrolling billboard.
    const TIERS = {
      marquee:  { name:'The Marquee',    tag:'the landmark',       k:'t-marquee' },
      fifth:    { name:'Fifth Avenue',   tag:'front row, premium', k:'t-fifth', bill:true },
      madison:  { name:'Madison Avenue', tag:'a growth address',   k:'t-madison' },
      broadway: { name:'Broadway',       tag:'the main strip',     k:'t-broadway' },
      canal:    { name:'Canal Street',   tag:'a starter address',  k:'t-canal' }
    };
    const PLOTS=[
      {x:170, w:130,h:150, tier:'canal',   type:'shop',    brand:"Milo's Lemonade", who:'Lemonade stand · age 12', url:'#'},
      {x:352, w:150,h:198, tier:'broadway',type:'shop',    brand:'Kayden Customs',  who:'Sneaker customs · age 17', url:'#'},
      {x:554, w:132,h:150, tier:'canal',   type:'open'},
      {x:738, w:178,h:288, tier:'fifth',   type:'awarded', brand:'Deveny Reads',    who:'Book subscription boxes · age 14', url:'#'},
      {x:968, w:236,h:348, tier:'marquee', type:'marquee'},
      {x:1256,w:178,h:288, tier:'fifth',   type:'shop',    brand:'Aurelio',         who:'Flagship brand takeover', url:'#'},
      {x:1486,w:162,h:236, tier:'madison', type:'shop',    brand:'Vertex Tech',     who:'Student-run tech studio · age 16', url:'#'},
      {x:1700,w:178,h:284, tier:'fifth',   type:'open'},
      {x:1930,w:150,h:196, tier:'broadway',type:'awarded', brand:'Bloom by Amara',  who:'Pressed-flower jewelry · age 16', url:'#'},
      {x:2132,w:130,h:148, tier:'canal',   type:'open'}
    ];
    const BASEW=Math.max.apply(null,PLOTS.map(p=>p.x+p.w))+360;
    let K=1, WORLD=BASEW, ax=140;
    const clampv=(v,a,b)=>Math.max(a,Math.min(b,v));
    // Scale the whole world to fit the screen height, so the tall buildings never
    // overflow a short (mobile landscape or portrait) viewport and you can see
    // several at once. No rotation required.
    function fitK(){ var H=window.innerHeight||600, W=window.innerWidth||800;
      return Math.max(0.42, Math.min(1, Math.min((H-84)/500, W/760))); }

    // stars once (sky layer, scale-independent)
    for(let i=0;i<54;i++){const s=document.createElement('i');
      s.style.left=Math.random()*100+'%';s.style.top=Math.random()*58+'%';
      s.style.opacity=(.3+Math.random()*.5).toFixed(2);s.style.animationDelay=(Math.random()*5)+'s';starsEl.appendChild(s);}

    // far-silhouette spec, generated once and positioned per scale
    const FARSPEC=[];
    for(let x=-40;x<BASEW;x+=Math.round(56+Math.random()*46)){
      FARSPEC.push({x:x,w:Math.round(34+Math.random()*30),h:Math.round(70+Math.random()*120)});}

    function build(p){
      const T = TIERS[p.tier] || TIERS.broadway;
      const b=document.createElement('div');
      b.className='sq-b '+T.k+(p.type==='open'?' open':'')+(p.type==='marquee'?' marquee':'');
      b.style.left=(p.x*K)+'px';b.style.width=(p.w*K)+'px';b.style.height=(p.h*K)+'px';
      if(p.type==='marquee'){
        b.innerHTML='<div class="sq-marq"><div class="mbulbs"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>'+
          '<div class="k">The Landmark</div><div class="name grad-gold">The Marquee</div><div class="now">One brand at a time</div>'+
          '<div class="enter-tag">Enter ↑</div></div>';
      }else{
        const bill = T.bill ? '<div class="sq-bill"><span>'+(p.type==='open'?'Prime Fifth Avenue · your brand here':(p.brand+' · on Fifth Avenue'))+'</span></div>' : '';
        const chipCls = p.tier==='fifth' ? 'tier-hi' : (p.tier==='canal' ? 'tier-lo' : 'tier-mid');
        let chip, brand;
        if(p.type==='open'){ chip='✦ For lease'; brand='Open spot'; }
        else if(p.type==='awarded'){ chip='★ Cornerstone'; brand=p.brand; }
        else { chip='✦ Leased'; brand=p.brand; }
        b.innerHTML='<div class="sq-board">'+bill+'<div class="b-chip '+chipCls+'">'+chip+'</div>'+
          '<div class="b-brand">'+brand+'</div><div class="b-loc">'+T.name+'</div><div class="enter-tag">Enter ↑</div></div>';
      }
      b.addEventListener('click',function(){openPlot(p);});
      p.el=b;p.center=(p.x+p.w/2)*K;mid.appendChild(b);
    }

    function layout(){
      K=fitK(); WORLD=BASEW*K;
      far.innerHTML=''; far.style.width=WORLD+'px';
      FARSPEC.forEach(function(f){ const fb=document.createElement('div');fb.className='fb';
        fb.style.left=(f.x*K)+'px';fb.style.width=(f.w*K)+'px';fb.style.height=(f.h*K)+'px';far.appendChild(fb);});
      ground.innerHTML=''; ground.style.width=WORLD+'px';
      const road=document.createElement('div');road.className='road';road.style.width=WORLD+'px';ground.appendChild(road);
      const curb=document.createElement('div');curb.className='curb';curb.style.width=WORLD+'px';ground.appendChild(curb);
      for(let x=120;x<BASEW;x+=280){const lp=document.createElement('div');lp.className='lamp';lp.style.left=(x*K)+'px';ground.appendChild(lp);}
      mid.innerHTML=''; mid.style.width=WORLD+'px';
      PLOTS.forEach(build);
      ax=clampv(ax,60,WORLD-60);
    }
    layout();

    // ---- movement + camera ----
    let keyL=false, keyR=false, raf=null, vw=0, near=null, rzT=null;
    function resize(){ vw=world.clientWidth||window.innerWidth;
      clearTimeout(rzT); rzT=setTimeout(function(){ if(sq.classList.contains('open')){ layout(); } }, 160); }
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
      // proximity (scaled to the current world size)
      let best=null,bd=140*K;
      for(const p of PLOTS){const d=Math.abs(ax-p.center);if(d<bd){bd=d;best=p;}}
      if(best!==near){ if(near&&near.el)near.el.classList.remove('near'); near=best; if(near&&near.el)near.el.classList.add('near'); }
      raf=requestAnimationFrame(frame);
    }

    // ---- modal ----
    function openPlot(p){
      const T = TIERS[p.tier] || TIERS.broadway;
      let badge,title,who='',text,btnHtml;
      if(p.type==='marquee'){
        badge='★ The Landmark';title='The Marquee';
        text='One sign, dead center, taken by a single brand at a time. The most visible spot on the whole Square, reserved for launch weeks, holiday takeovers, and the nights everyone shows up.';
        btnHtml='<a class="btn" href="lease.html#join">Join the waitlist</a>';
      }else if(p.type==='open'){
        badge='✦ For lease · '+T.name;
        if(p.tier==='fifth'){
          title='A prime Fifth Avenue address';
          text='Front and center, tall and lit, the first thing every visitor sees. The most visible address there is. Lease it and put your shop in the spotlight.';
        }else if(p.tier==='canal'){
          title='A starter address on Canal Street';
          text='An affordable spot to get on the map, a modest storefront on a side street. A great place to plant your flag and grow into a bigger address later.';
        }else{
          title='An open storefront on '+T.name;
          text='A spot on '+T.name+', '+T.tag+'. Lease it and link it straight to your own shop, you keep every sale.';
        }
        btnHtml='<a class="btn" href="lease.html#join">Lease this '+T.name+' spot</a>';
      }else{
        badge=(p.type==='awarded'?'★ Cornerstone · ':'✦ Leased · ')+T.name;
        title=p.brand;who=p.who;
        var vis = p.tier==='fifth' ? ' One of the most-seen addresses on the Square.' : (p.tier==='canal' ? ' A modest address on a quiet side street.' : '');
        text=(p.type==='awarded'
          ? "A Cornerstone founder's storefront, funded by the mission or a sponsor. It links out to their own shop, the Square never holds the sale."
          : "A leased storefront. It links straight to the business's own shop, the Square is the landlord, never the cashier.")+vis;
        btnHtml=(p.url && p.url!=='#')
          ? '<a class="btn" href="'+p.url+'" target="_blank" rel="noopener">Visit the shop ↗</a>'
          : '<span class="c-demo">Example storefront &middot; demo</span>';
      }
      card.innerHTML='<button class="c-close" id="sqCardClose" aria-label="Close">✕</button>'+
        '<div class="c-badge">'+badge+'</div><h3 class="grad-gold">'+title+'</h3>'+
        (who?'<div class="c-who">'+who+'</div>':'')+'<p>'+text+'</p><div class="c-actions">'+btnHtml+'</div>';
      modal.classList.add('open');
      document.getElementById('sqCardClose').onclick=closeModal;
    }
    function closeModal(){ modal.classList.remove('open'); }
    modal.addEventListener('click',function(e){ if(e.target===modal) closeModal(); });

    // ---- character avatar: pick a ready-made one or upload your own ----
    const AV_KEY='yps_avatar';
    const AV_PRESETS=['🧑','👩','👨','🧑🏽','👩🏾','🧑🏿','👦','👧','🧔','🧕','🧑‍🦱','🧑‍🎤','🦸','🦹','🧑‍🚀','👽','🤖','🐱'];
    function getAvatar(){ try{ var a=JSON.parse(localStorage.getItem(AV_KEY)); if(a&&a.v) return a; }catch(e){} return {type:'emoji',v:'🧑'}; }
    function saveAvatar(a){ try{ localStorage.setItem(AV_KEY, JSON.stringify(a)); }catch(e){} }
    function headMarkup(a, cls){ return a.type==='img'
      ? '<div class="'+cls+'" style="background-image:url('+a.v+')"></div>'
      : '<div class="'+cls+'">'+a.v+'</div>'; }
    function renderAvatar(){
      var a=getAvatar();
      avatar.innerHTML='<span class="glow"></span><div class="fig">'+headMarkup(a,'av-head')+
        '<div class="av-torso"></div><div class="leg l"></div><div class="leg r"></div></div>';
      var mini=document.querySelector('#avBtn .mini');
      if(mini){ if(a.type==='img'){ mini.style.backgroundImage='url('+a.v+')'; mini.textContent=''; } else { mini.style.backgroundImage='none'; mini.textContent=a.v; } }
    }
    function downscaleImg(src, size, cb){
      var img=new Image();
      img.onload=function(){ try{ var c=document.createElement('canvas'); c.width=size; c.height=size; var ctx=c.getContext('2d');
        var s=Math.min(img.width,img.height), sx=(img.width-s)/2, sy=(img.height-s)/2;
        ctx.drawImage(img,sx,sy,s,s,0,0,size,size); cb(c.toDataURL('image/jpeg',0.85)); }catch(e){ cb(null); } };
      img.onerror=function(){ cb(null); }; img.src=src;
    }
    // picker button in the top HUD
    var avBtn=document.createElement('button'); avBtn.className='av-btn'; avBtn.id='avBtn';
    avBtn.innerHTML='<span class="mini"></span> You';
    var topBar=document.querySelector('#square .sq-top');
    if(topBar){ topBar.insertBefore(avBtn, topBar.querySelector('.sq-close')); }
    var picker=document.createElement('div'); picker.className='av-picker'; picker.id='avPicker';
    document.getElementById('square').appendChild(picker);
    function previewMarkup(){ var a=getAvatar(); return a.type==='img'
      ? '<div class="big" style="background-image:url('+a.v+')"></div>' : '<div class="big">'+a.v+'</div>'; }
    function refreshPreview(){ var pv=picker.querySelector('.av-preview'); if(pv) pv.innerHTML=previewMarkup(); }
    function openPicker(){
      var a=getAvatar();
      var opts=AV_PRESETS.map(function(e){ return '<div class="av-opt'+(a.type==='emoji'&&a.v===e?' sel':'')+'" data-e="'+e+'">'+e+'</div>'; }).join('');
      picker.innerHTML='<div class="av-sheet"><button class="sq-close c-close" id="avClose" aria-label="Close">✕</button>'+
        '<h3>Choose your character</h3><p>Pick one, or upload your own Memoji, Bitmoji, or photo.</p>'+
        '<div class="av-preview">'+previewMarkup()+'</div>'+
        '<div class="av-grid">'+opts+'</div>'+
        '<label class="av-upload">Upload your own<input type="file" accept="image/*" id="avFile" hidden></label>'+
        '<div class="av-note">On an iPhone, long-press a Memoji sticker to save it as a photo first, then upload it here.</div>'+
        '<button class="av-done" id="avDone">Done</button></div>';
      picker.classList.add('open');
      picker.querySelector('#avClose').onclick=closePicker;
      picker.querySelector('#avDone').onclick=closePicker;
      Array.prototype.forEach.call(picker.querySelectorAll('.av-opt'), function(o){ o.onclick=function(){
        saveAvatar({type:'emoji',v:o.getAttribute('data-e')}); renderAvatar(); refreshPreview();
        Array.prototype.forEach.call(picker.querySelectorAll('.av-opt'),function(x){x.classList.remove('sel');}); o.classList.add('sel'); }; });
      picker.querySelector('#avFile').onchange=function(ev){ var f=ev.target.files&&ev.target.files[0]; if(!f) return;
        var r=new FileReader(); r.onload=function(){ downscaleImg(r.result,128,function(url){ if(!url) return;
          saveAvatar({type:'img',v:url}); renderAvatar(); refreshPreview(); }); }; r.readAsDataURL(f); };
    }
    function closePicker(){ picker.classList.remove('open'); }
    picker.addEventListener('click',function(ev){ if(ev.target===picker) closePicker(); });
    avBtn.onclick=openPicker;
    renderAvatar();

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
      layout(); vw=world.clientWidth||window.innerWidth; syncSky(); if(!raf) raf=requestAnimationFrame(frame); }
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
