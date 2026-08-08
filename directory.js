  // ================= SEARCHABLE DIRECTORY =================
  (function(){
    const listEl=document.getElementById('dirList'); if(!listEl) return;
    const metaEl=document.getElementById('dirMeta'), searchEl=document.getElementById('dirSearch'),
      streetEl=document.getElementById('dirStreet'), catEl=document.getElementById('dirCat'), statusEl=document.getElementById('dirStatus');

    // seeded RNG so the addresses/tenants stay the same on every visit
    function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
    const rnd=mulberry32(20230731), pick=a=>a[Math.floor(rnd()*a.length)];

    const STREETS=[{name:'The Runway'},{name:'The Hangar'},{name:'Takeoff Lane'},
      {name:'Ascend Avenue'},{name:'First Class Row'},{name:'Founders Way'}];
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

    streetEl.innerHTML='<option value="">All streets</option>'+STREETS.map(s=>'<option>'+s.name+'</option>').join('');
    catEl.innerHTML='<option value="">All categories</option>'+CATS.map(c=>'<option>'+c+'</option>').join('');

    function pillLabel(s){ return s==='available'?'Available':s==='leased'?'Leased':'Liftoff'; }
    function rowHTML(sp){
      const occ=sp.status!=='available';
      const ten = occ ? '<div class="nm">'+sp.tenant+'</div><div class="cat">'+(sp.category||'')+'</div>'
                      : '<div class="nm av">Available</div><div class="cat">Ready to lease</div>';
      const visitHref = sp.shop ? sp.shop : '#';
      const act = occ ? '<a href="'+visitHref+'" target="_blank" rel="noopener">Visit ↗</a>' : '<a href="lease.html#join">Lease</a>';
      return '<div class="dir-row"><div class="dir-addr"><span class="num">'+sp.number+' '+sp.street+'</span><br>'+
        '<span class="unit">Unit '+sp.unit+'</span></div><div class="dir-ten">'+ten+'</div>'+
        '<span class="dir-pill '+sp.status+'">'+pillLabel(sp.status)+'</span><div class="dir-act">'+act+'</div></div>';
    }
    function apply(){
      const nAvail=spaces.filter(s=>s.status==='available').length,
            nLeased=spaces.filter(s=>s.status==='leased').length,
            nDon=spaces.filter(s=>s.status==='donated').length;
      const q=(searchEl.value||'').toLowerCase().trim(), fs=streetEl.value, fc=catEl.value, fst=statusEl.value;
      const out=spaces.filter(function(sp){
        if(fs && sp.street!==fs) return false;
        if(fc && sp.category!==fc) return false;
        if(fst && sp.status!==fst) return false;
        if(q){ const hay=(sp.number+' '+sp.street+' unit '+sp.unit+' '+sp.tenant+' '+sp.category).toLowerCase();
          if(hay.indexOf(q)<0) return false; }
        return true;
      });
      metaEl.innerHTML='Showing <b>'+out.length+'</b> of '+spaces.length+' spaces across '+STREETS.length+
        ' streets · <b>'+nAvail+'</b> available · <b>'+nLeased+'</b> leased · <b>'+nDon+'</b> liftoff';
      listEl.innerHTML = out.length ? out.map(rowHTML).join('')
        : '<div class="dir-empty">No spaces match — try another search or street.</div>';
    }
    [searchEl,streetEl,catEl,statusEl].forEach(el=>el.addEventListener('input',apply));
    apply();   // render the demo data instantly

    // ---- Now Boarding: live board from Supabase (falls back to the static rows) ----
    (function(){
      if(!window.SQ_DB) return;
      const board=document.getElementById('npBoard'); if(!board) return;
      const head=board.querySelector('.board-head');
      const SLABEL={boarding:'Boarding',final_call:'Final Call',scheduled:'Scheduled'};
      const SCLASS={boarding:'boarding',final_call:'final',scheduled:'scheduled'};
      // this week's Monday, in UTC, as YYYY-MM-DD
      const d=new Date(); const day=(d.getUTCDay()+6)%7; d.setUTCDate(d.getUTCDate()-day);
      const wk=d.toISOString().slice(0,10);
      window.SQ_DB.from('now_boarding').select('position,flight_code,business_name,gate,status,shop_url')
        .eq('week_start',wk).order('position',{ascending:true})
        .then(function(res){
          if(res.error){ console.warn('Now Boarding: live load failed, keeping demo rows.', res.error.message); return; }
          if(!res.data || !res.data.length) return;   // no lineup set for this week — keep demo rows
          board.querySelectorAll('.brow').forEach(el=>el.remove());
          res.data.forEach(function(r){
            const row=document.createElement('div'); row.className='brow';
            const brand = r.shop_url
              ? '<a href="'+r.shop_url+'" target="_blank" rel="noopener">'+r.business_name+'</a>'
              : r.business_name;
            row.innerHTML='<span class="fl">'+r.flight_code+'</span><span class="bn">'+brand+
              '</span><span class="gt">'+r.gate+'</span><span class="st '+(SCLASS[r.status]||'scheduled')+'">'+
              (SLABEL[r.status]||'Scheduled')+'</span>';
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
