  // ================= THE DIRECTORY — NYC subway-line map + searchable index =================
  (function(){
    const listEl=document.getElementById('dirList'); if(!listEl) return;
    const mapEl=document.getElementById('concourseMap');   // the subway-map container
    const metaEl=document.getElementById('dirMeta'), searchEl=document.getElementById('dirSearch'),
      streetEl=document.getElementById('dirStreet'), catEl=document.getElementById('dirCat'), statusEl=document.getElementById('dirStatus');

    function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
    const rnd=mulberry32(20230731), pick=a=>a[Math.floor(rnd()*a.length)];

    // Streets = subway lines (NYC-style bullets + MTA colors)
    const STREETS=[
      {name:'Broadway',       bullet:'B', color:'#F5C518', text:'#14231A'},
      {name:'Fifth Avenue',   bullet:'5', color:'#FF6319', text:'#fff'},
      {name:'Madison Avenue', bullet:'M', color:'#2F9E44', text:'#fff'},
      {name:'Canal Street',   bullet:'C', color:'#3A7DD1', text:'#fff'},
      {name:'Motor Row',      bullet:'R', color:'#B84FC0', text:'#fff'},
      {name:'Union Square',   bullet:'U', color:'#E8433B', text:'#fff'}
    ];
    const LINE={}; STREETS.forEach(s=>LINE[s.name]=s);
    // Map any legacy (DB) street names onto the NYC lines so live data keeps working.
    const DBNAME={'The Runway':'Broadway','First Class Row':'Fifth Avenue','Ascend Avenue':'Madison Avenue',
      'Takeoff Lane':'Canal Street','The Hangar':'Motor Row','Founders Way':'Union Square'};
    const toLine=n=>DBNAME[n]||n;

    const CATS=['Food & Drink','Retail','Services','Tech','Beauty','Fitness','Auto','Creative','Home','Finance'];
    const FIRST=['Meridian','Copper','Vertex','Halcyon','Aurelio','Nova','Summit','Coastline','Ironwood','Marlowe',
      'Kestrel','Juniper','Atlas','Beacon','Onyx','Sage','Ember','Harbor','Lumen','Marigold','Cobalt','Wilder',
      'Anchor','Cardinal','Hollow','Foxglove','Verde','Crescent','Delmar','Northwind','Bramble','Solace','Aurora','Pike','Grove'];
    const SUF={
      'Food & Drink':['Coffee','Kitchen','Bakehouse','Table','Roasters','Provisions'],
      'Retail':['& Co.','Goods','Supply','Market','Mercantile','Trading Co.'],
      'Services':['Studio','Works','Agency','Group','Collective'],
      'Tech':['Labs','Systems','Digital','Technologies','Cloud'],
      'Beauty':['Beauty','Salon','Skin','Aesthetics','Grooming'],
      'Fitness':['Fitness','Athletic','Strength','Movement','Cycle'],
      'Auto':['Motors','Auto','Garage','Detailing','Autoworks'],
      'Creative':['Studio','Press','Design','Media','Films'],
      'Home':['Home','Interiors','& Hearth','Living','Furnishings'],
      'Finance':['Capital','Advisors','Financial','Wealth','Partners']};
    const DONATED=["Zoe's Bakeshop","Kayden Customs","Bloom by Amara","Deveny Reads","Nova Skate","Milo's Lemonade",
      "Ava Makes","Jayden's Kicks","Bright Start Crafts","Ren's Candles","Talia Tie-Dye","Marcus Mixtapes"];
    let dIdx=0;

    let spaces=[];
    STREETS.forEach(function(st){
      for(let i=0;i<30;i++){
        const number=100+Math.floor(i/2)*2, unit=(i%2===0)?'A':'B', r=rnd();
        let status='available', tenant='', category='', shop='';
        if(r<0.09) status='donated'; else if(r<0.42) status='leased';
        if(status==='leased'){ category=pick(CATS); tenant=pick(FIRST)+' '+pick(SUF[category]); }
        else if(status==='donated'){ category=pick(CATS); tenant=DONATED[dIdx%DONATED.length]; dIdx++; }
        spaces.push({number:number, unit:unit, street:st.name, status:status, tenant:tenant, category:category, shop:shop});
      }
    });

    streetEl.innerHTML='<option value="">All lines</option>'+STREETS.map(s=>'<option value="'+s.name+'">'+s.name+'</option>').join('');
    catEl.innerHTML='<option value="">All categories</option>'+CATS.map(c=>'<option>'+c+'</option>').join('');

    function pillLabel(s){ return s==='available'?'Available':s==='leased'?'Leased':'Cornerstone'; }
    function esc(t){ return String(t||'').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
    function addr(sp){ return sp.number+sp.unit; }
    function statusClass(s){ return s==='available'?'open':(s==='leased'?'leased':'corner'); }

    // ---------- the subway map ----------
    function mapHTML(list){
      const groups={}; STREETS.forEach(s=>groups[s.name]=[]);
      list.forEach(sp=>{ const ln=toLine(sp.street); (groups[ln]=groups[ln]||[]).push(sp); });
      let html='';
      STREETS.forEach(function(s){
        const gs=groups[s.name]||[]; if(!gs.length) return;
        const nOpen=gs.filter(g=>g.status==='available').length;
        html+='<div class="line" style="--ln:'+s.color+'">'+
          '<div class="line-head"><span class="bullet" style="background:'+s.color+';color:'+s.text+'">'+s.bullet+'</span>'+
          '<span class="ln-name">'+s.name+'</span><span class="ln-count">'+nOpen+' open · '+gs.length+' stops</span></div>'+
          '<div class="route-scroll"><div class="route">';
        gs.forEach(function(sp){
          const cls=statusClass(sp.status), occ=sp.status!=='available';
          const nm= occ ? sp.tenant : 'Open';
          const tip= occ ? (addr(sp)+' '+s.name+' · '+sp.tenant+(sp.category?' — '+sp.category:'')) : (addr(sp)+' '+s.name+' · Available to lease');
          const inner='<span class="dot"></span><span class="lbl"><b>'+addr(sp)+'</b>'+esc(nm)+'</span>';
          if(!occ){ html+='<a class="stn '+cls+'" href="lease.html#join" title="'+esc(tip)+'">'+inner+'</a>'; }
          else if(sp.shop){ html+='<a class="stn '+cls+'" target="_blank" rel="noopener" href="'+esc(sp.shop)+'" title="'+esc(tip)+'">'+inner+'</a>'; }
          else { html+='<span class="stn '+cls+'" title="'+esc(tip)+'">'+inner+'</span>'; }
        });
        html+='</div></div></div>';
      });
      return html || '<div class="dir-empty">No stops match — try another search or line.</div>';
    }

    // ---------- the searchable list ----------
    function rowHTML(sp){
      const occ=sp.status!=='available';
      const ten = occ ? '<div class="nm">'+esc(sp.tenant)+'</div><div class="cat">'+esc(sp.category||'')+'</div>'
                      : '<div class="nm av">Available</div><div class="cat">Ready to lease</div>';
      const visitHref = sp.shop ? esc(sp.shop) : '';
      const act = occ ? (sp.shop?'<a href="'+visitHref+'" target="_blank" rel="noopener">Visit ↗</a>':'<span class="muted">Leased</span>')
                      : '<a href="lease.html#join">Lease</a>';
      return '<div class="dir-row"><div class="dir-addr"><span class="num">'+sp.number+' '+toLine(sp.street)+'</span><br>'+
        '<span class="unit">Unit '+sp.unit+'</span></div><div class="dir-ten">'+ten+'</div>'+
        '<span class="dir-pill '+sp.status+'">'+pillLabel(sp.status)+'</span><div class="dir-act">'+act+'</div></div>';
    }

    function apply(){
      const nAvail=spaces.filter(s=>s.status==='available').length,
            nLeased=spaces.filter(s=>s.status==='leased').length,
            nDon=spaces.filter(s=>s.status==='donated').length;
      const q=(searchEl.value||'').toLowerCase().trim(), fs=streetEl.value, fc=catEl.value, fst=statusEl.value;
      const out=spaces.filter(function(sp){
        const ln=toLine(sp.street);
        if(fs && ln!==fs) return false;
        if(fc && sp.category!==fc) return false;
        if(fst && sp.status!==fst) return false;
        if(q){ const hay=(sp.number+sp.unit+' '+sp.number+' '+ln+' unit '+sp.unit+' '+sp.tenant+' '+sp.category).toLowerCase();
          if(hay.indexOf(q)<0) return false; }
        return true;
      });
      metaEl.innerHTML='Showing <b>'+out.length+'</b> of '+spaces.length+' storefronts across '+STREETS.length+
        ' lines · <b>'+nAvail+'</b> available · <b>'+nLeased+'</b> leased · <b>'+nDon+'</b> Cornerstone';
      if(mapEl) mapEl.innerHTML = mapHTML(out);
      listEl.innerHTML = out.length ? out.map(rowHTML).join('')
        : '<div class="dir-empty">No storefronts match — try another search or line.</div>';
    }
    [searchEl,streetEl,catEl,statusEl].forEach(el=>el.addEventListener('input',apply));
    apply();   // render the demo data instantly

    // ---- Now Playing: live weekly board from Supabase (falls back to the static rows) ----
    (function(){
      if(!window.SQ_DB) return;
      const board=document.getElementById('npBoard'); if(!board) return;
      const SLABEL={boarding:'On now',final_call:'Final week',scheduled:'Coming'};
      const SCLASS={boarding:'boarding',final_call:'final',scheduled:'scheduled'};
      const d=new Date(); const day=(d.getUTCDay()+6)%7; d.setUTCDate(d.getUTCDate()-day);
      const wk=d.toISOString().slice(0,10);
      window.SQ_DB.from('now_boarding').select('position,flight_code,business_name,gate,status,shop_url')
        .eq('week_start',wk).order('position',{ascending:true})
        .then(function(res){
          if(res.error){ console.warn('Now Playing: live load failed, keeping demo rows.', res.error.message); return; }
          if(!res.data || !res.data.length) return;
          board.querySelectorAll('.brow').forEach(el=>el.remove());
          res.data.forEach(function(r){
            const row=document.createElement('div'); row.className='brow';
            const brand = r.shop_url
              ? '<a href="'+r.shop_url+'" target="_blank" rel="noopener">'+r.business_name+'</a>'
              : r.business_name;
            row.innerHTML='<span class="fl">'+r.flight_code+'</span><span class="bn">'+brand+
              '</span><span class="gt">'+r.gate+'</span><span class="st '+(SCLASS[r.status]||'scheduled')+'">'+
              (SLABEL[r.status]||'Coming')+'</span>';
            board.appendChild(row);
          });
        });
    })();

    // If Supabase is connected, replace the demo data with the live directory.
    if(window.SQ_DB){
      const DBMAP={open:'available',leased:'leased',liftoff:'donated'};
      window.SQ_DB.from('spaces').select('street,num,unit,status,tenant_name,category,shop_url')
        .order('street',{ascending:true}).order('num',{ascending:true}).order('unit',{ascending:true})
        .then(function(res){
          if(res.error || !res.data || !res.data.length){ if(res.error) console.warn('Directory: live load failed, keeping demo data.', res.error.message); return; }
          spaces = res.data.map(function(r){
            return { number:r.num, unit:r.unit, street:r.street, status:DBMAP[r.status]||'available',
                     tenant:r.tenant_name||'', category:r.category||'', shop:r.shop_url||'' };
          });
          apply();
        });
    }
  })();
