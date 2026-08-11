/* ============================================================
   Build Your Block — 3D edition
   A Three.js idle/tycoon game rendered in the same low-poly
   warm style as the walkable Square. Keeps the original
   mechanics + save format (localStorage 'yps_block_v1').
   Exposes window.SquareGame { mount, reward, add, get,
   rewardVisit, rewardToken, share }.
   ============================================================ */
(function(){
'use strict';
if(typeof THREE==='undefined'){ console.warn('BlockGame: THREE not loaded'); }

/* ---------------- game config (matches the original) ---------------- */
const LS='yps_block_v1';
const CFG={ratePerMin:1.5, upgradeBase:140};
const LOT_COST=[0,180,650,1800,4200];
const NLOTS=5;
/* ---- city / districts: the never-ending expansion ---- */
const LOTS_PER=5;              // base lots in a district
const DGAP=46;                 // world-X distance between district centers (block + cross-street)
const DTHEMES=[
  {name:'Founders Row',   accent:'#E3242B'},
  {name:'Sunrise Market', accent:'#E6A020'},
  {name:'Harbor Walk',    accent:'#37A6C9'},
  {name:'Maple Heights',  accent:'#2f9e57'},
  {name:'Neon Alley',     accent:'#8a5aff'},
  {name:'Gold Coast',     accent:'#C9A84A'}
];
function districtName(i){const b=DTHEMES[i%DTHEMES.length].name;const cyc=Math.floor(i/DTHEMES.length);return cyc?b+' '+(cyc+1):b;}
function districtAccent(i){return DTHEMES[i%DTHEMES.length].accent;}
function districtLots(i){return LOTS_PER+Math.min(3,Math.floor(i/2));} // 5,5,6,6,7,7,8,8...
function lotCostFor(di,li){let base;if(li<LOT_COST.length)base=LOT_COST[li];else base=LOT_COST[LOT_COST.length-1]+(li-LOT_COST.length+1)*3200;return Math.round(base*Math.pow(1.9,di));}
function districtOpenCost(di){return Math.round(1500*Math.pow(2.3,di-1));} // di>=1
/* ---- AI rivals & raids (kid-safe: computer opponents only, never real players) ---- */
const RIVALS=[
  {id:'r1',name:'Tycoon Tasha',   emoji:'👑',mult:1.45},
  {id:'r2',name:'Biz-Whiz Ben',   emoji:'🤓',mult:1.10},
  {id:'r3',name:'Mogul Mia',      emoji:'💼',mult:1.28},
  {id:'r4',name:'Captain Cash',   emoji:'🧢',mult:0.92},
  {id:'r5',name:'Duchess Dee',    emoji:'🎩',mult:1.60},
  {id:'r6',name:'Sir Save-a-Lot', emoji:'🦉',mult:0.78}
];
const RAID_MAX_TICKETS=5, RAID_REFILL=25*60*1000, RAID_CD=45*60*1000;
const SHIELD_COST=120, SHIELD_DUR=60*60*1000;
function hash01(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return ((h>>>0)%100000)/100000;}
function playerWorth(){let w=Math.floor(S.coins||0);eachLot(l=>{if(l.built)w+=140+(l.lvl||1)*80;});w+=(S.districts.length-1)*900+ (S.level||1)*120;return w;}
function rivalWorth(r){const pw=Math.max(300,playerWorth());const j=0.86+0.22*hash01(r.id+todayStr());
  // base lead early (something to chase) that fades so a committed player can climb to #1
  return Math.round(r.mult*(1600+0.5*pw)*j);}
function raidTickets(){const R=S.raid;const now=Date.now();if(R.tickets<RAID_MAX_TICKETS){const g=Math.floor((now-(R.ticketsT||now))/RAID_REFILL);if(g>0){R.tickets=Math.min(RAID_MAX_TICKETS,R.tickets+g);R.ticketsT=(R.tickets>=RAID_MAX_TICKETS)?now:(R.ticketsT+g*RAID_REFILL);}}return R.tickets;}
function shieldActive(){return (S.raid&&S.raid.shieldUntil||0)>Date.now();}
function fmtMs(ms){ms=Math.max(0,ms);const m=Math.round(ms/60000);if(m>=60)return Math.floor(m/60)+'h'+(m%60?(' '+(m%60)+'m'):'');return m+'m';}
const TYPES={
  bakery:  {emoji:'🧁',name:'Bakery',   earn:1.00,lvlReq:1, pal:{fac:'#8a5560',win:'#ffe0ea',trim:'#5a3a44'}, awn:0xE3242B, sign:'#f6dcef'},
  lemonade:{emoji:'🍋',name:'Lemonade', earn:0.90,lvlReq:1, pal:{fac:'#9a8a3a',win:'#fff4b0',trim:'#6a5a1e'}, awn:0xE6C020, sign:'#241a06'},
  sneakers:{emoji:'👟',name:'Sneakers', earn:1.25,lvlReq:2, pal:{fac:'#3a6d8a',win:'#cfe8ff',trim:'#22485a',glass:1}, awn:0x2f9e57, sign:'#d8f0ff'},
  books:   {emoji:'📚',name:'Books',    earn:1.10,lvlReq:2, pal:{fac:'#3f6d5a',win:'#ffe6a0',trim:'#284a3a'}, awn:0x8a5a2a, sign:'#fff0d0'},
  flowers: {emoji:'🌸',name:'Flowers',  earn:1.20,lvlReq:3, pal:{fac:'#7a3a6a',win:'#ffd8f4',trim:'#4a2444'}, awn:0xE05aa0, sign:'#ffe0f4'},
  pizza:   {emoji:'🍕',name:'Pizza',    earn:1.35,lvlReq:3, pal:{fac:'#a05a3a',win:'#ffe6b0',trim:'#6a3826'}, awn:0xC0432f, sign:'#ffe6c0'},
  coffee:  {emoji:'☕',name:'Coffee',   earn:1.15,lvlReq:4, pal:{fac:'#7a5a44',win:'#ffe6c0',trim:'#4f3c2a'}, awn:0x6a4a2a, sign:'#ffeccc'},
  games:   {emoji:'🎮',name:'Games',    earn:1.40,lvlReq:4, pal:{fac:'#2e2a36',win:'#c9b8ff',trim:'#c9a84a'}, awn:0x6a4fff, sign:'#e6dcff'}
};
const TYPE_ORDER=['bakery','lemonade','sneakers','books','flowers','pizza','coffee','games'];
function LEVEL_XP(l){return 50*l*l;}
/* ---- light business economy: gross earning -> supplies + rent -> net profit ---- */
const SUPPLY_RATE=0.15;                       // supplies cost = 15% of gross
function rentPerMin(l){return 0.5+(l.lvl||1)*0.2;}   // small daily-feel rent, per minute
const COND_DECAY=100/(38*60);                 // equipment wears from 100->0 over ~38 min of active play
const COND_WARN=45, COND_LOW=20;              // condition thresholds
const BREAK_P_PER_SEC=0.10/60;                // ~10%/min chance to break down once worn
function condOf(l){return (l.cond==null?100:l.cond);}
function condMult(l){ if(l.broke) return 0; const c=condOf(l); return c>=COND_WARN?1:(c>=COND_LOW?0.7:0.45); }
function grossPerMin(l){const t=TYPES[l.type];return CFG.ratePerMin*t.earn*(1+0.25*((l.lvl||1)-1));}
function netPerMin(l){const g=grossPerMin(l)*condMult(l); if(g<=0) return 0; return Math.max(0,g - g*SUPPLY_RATE - rentPerMin(l));}
function ratePerSec(l){return netPerMin(l)/60;}         // wallet accrues NET
function upgradeCost(l){return Math.round(CFG.upgradeBase*Math.pow(l.lvl,1.6));}
function repairCost(l){return Math.round(22+(l.lvl||1)*16+(100-condOf(l))*0.6);}
function storageCap(l){return Math.max(40, Math.round((grossPerMin(l)/60)*60*45)); } // ~45 min of idle storage (gross-based so it doesn't collapse when worn)
function todayStr(){const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function yStr(){const d=new Date(Date.now()-864e5);return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function uuid(){return 'xxxxxxxx'.replace(/x/g,()=>((Math.random()*16)|0).toString(16))+'-'+Date.now().toString(16);}

/* ---------------- state ---------------- */
function makeLot(){return {built:false,unlocked:false};}
function makeDistrict(i,seed){const n=districtLots(i);const lots=[];for(let k=0;k<n;k++){
  if(seed&&i===0&&k===0)lots.push({built:true,unlocked:true,type:'bakery',name:'Bakery',lvl:1,stock:0,t:Date.now(),cond:100,broke:false,rev:0,exp:0});
  else lots.push(makeLot());}
  return {id:i,lots:lots};}
function fresh(){return {v:3,coins:120,xp:0,level:1,streak:0,lastDay:'',tut:0,
  visited:{day:'',refs:{}},tokens:{},pid:uuid(),pname:'',district:0,
  raid:{tickets:RAID_MAX_TICKETS,ticketsT:Date.now(),cd:{},shieldUntil:0,wins:0,losses:0},
  districts:[makeDistrict(0,true)]};}
let S=fresh();
function eachLot(fn){S.districts.forEach((D,di)=>D.lots.forEach((l,li)=>fn(l,di,li,D)));}
function load(){try{const raw=localStorage.getItem(LS);if(raw){const o=JSON.parse(raw);if(o){
    if(o.lots&&!o.districts){o.districts=[{id:0,lots:o.lots}];o.district=0;delete o.lots;} // migrate v2 -> v3
    if(o.districts)S=Object.assign(fresh(),o);
  }}}catch(e){}
  if(!S.districts||!S.districts.length)S.districts=[makeDistrict(0,true)];
  if(typeof S.district!=='number'||S.district<0||S.district>=S.districts.length)S.district=0;
  if(!S.raid)S.raid={tickets:RAID_MAX_TICKETS,ticketsT:Date.now(),cd:{},shieldUntil:0,wins:0,losses:0};
  if(!S.raid.cd)S.raid.cd={};
  // ensure lot counts + backfill business fields
  S.districts.forEach((D,di)=>{const need=districtLots(di);while(D.lots.length<need)D.lots.push(makeLot());
    D.lots.forEach(l=>{if(l.built){if(l.cond==null)l.cond=100;l.broke=!!l.broke;l.rev=l.rev||0;l.exp=l.exp||0;}});});
  // offline accrual + wear across the whole city (cap wear to 1h)
  const now=Date.now();eachLot(l=>{if(l.built){l.t=l.t||now;const el=Math.max(0,(now-l.t)/1000);
    if(!l.broke)l.cond=Math.max(0,condOf(l)-COND_DECAY*Math.min(el,3600));
    l.stock=Math.min(storageCap(l),(l.stock||0)+ratePerSec(l)*el);l.t=now;}});}
let saveT=null;
function save(){try{localStorage.setItem(LS,JSON.stringify(S));}catch(e){}}
function saveSoon(){clearTimeout(saveT);saveT=setTimeout(save,600);}

/* ---------------- three.js scene ---------------- */
let renderer,scene,camera,host,cv, sky, sun, hemi, keyLight, worldGroup;
let mode='night';
const S3={ day:{sky:['#8fc0f0','#cfe0e8'],amb:.85,sun:1.1,emis:0,star:0},
          dusk:{sky:['#2a2f52','#e08a3a'],amb:.6,sun:.6,emis:.6,star:.3},
          night:{sky:['#0e1830','#3a2f4a'],amb:.5,sun:.18,emis:1,star:.9} };
const std=o=>new THREE.MeshStandardMaterial(o);
const plots=[]; // {group, lot index, building, coinSprite, coinCanvas, coinTex, base}
const clickable=[]; const emisMats=[]; const lamps=[];

function skyTex(t,b){const c=document.createElement('canvas');c.width=8;c.height=256;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,0,256);g.addColorStop(0,t);g.addColorStop(1,b);x.fillStyle=g;x.fillRect(0,0,8,256);return new THREE.CanvasTexture(c);}
function texPair(pal){const w=64,h=128;
  const fc=document.createElement('canvas');fc.width=w;fc.height=h;const fx=fc.getContext('2d');
  const ec=document.createElement('canvas');ec.width=w;ec.height=h;const ex=ec.getContext('2d');
  fx.fillStyle=pal.fac;fx.fillRect(0,0,w,h);ex.fillStyle='#000';ex.fillRect(0,0,w,h);
  fx.fillStyle='rgba(0,0,0,.15)';for(let i=0;i<h;i+=13)fx.fillRect(0,i,w,1);
  if(pal.glass){for(let r=0;r<9;r++){const lit=Math.random()<0.82;fx.fillStyle=lit?pal.win:'#26303a';fx.fillRect(6,10+r*13,52,9);if(lit){ex.fillStyle='#bfe0ff';ex.fillRect(6,10+r*13,52,9);}}}
  else{for(let r=0;r<9;r++)for(let cc=0;cc<4;cc++){const lit=Math.random()<0.72;fx.fillStyle=lit?pal.win:'#2b2a24';fx.fillRect(8+cc*13,10+r*13,9,9);if(lit){ex.fillStyle='#ffcf7a';ex.fillRect(8+cc*13,10+r*13,9,9);}}}
  return {map:new THREE.CanvasTexture(fc),emis:new THREE.CanvasTexture(ec),glass:pal.glass};}
function signTex(text,emoji,accent){const c=document.createElement('canvas');c.width=256;c.height=72;const x=c.getContext('2d');
  x.fillStyle='#0c120e';x.fillRect(0,0,256,72);x.strokeStyle=accent;x.lineWidth=5;x.strokeRect(3,3,250,66);
  x.font='30px serif';x.textAlign='left';x.textBaseline='middle';x.fillText(emoji,14,40);
  x.fillStyle='#f6efdd';x.font='800 26px Georgia';x.textAlign='left';x.fillText(text,52,40);
  return new THREE.CanvasTexture(c);}
function coinTex(n){const c=document.createElement('canvas');c.width=150;c.height=76;const x=c.getContext('2d');
  x.clearRect(0,0,150,76);
  x.fillStyle='rgba(8,11,9,.86)';rr(x,6,10,138,44,22);x.fill();x.strokeStyle='rgba(227,192,90,.6)';x.lineWidth=2;rr(x,6,10,138,44,22);x.stroke();
  const g=x.createRadialGradient(34,30,2,34,32,15);g.addColorStop(0,'#fff7d8');g.addColorStop(.5,'#F4E3A6');g.addColorStop(1,'#c9a84a');
  x.fillStyle=g;x.beginPath();x.arc(34,32,13,0,7);x.fill();x.fillStyle='#8a6a1f';x.font='800 15px Georgia';x.textAlign='center';x.textBaseline='middle';x.fillText('Y',34,33);
  x.fillStyle='#f5f1e6';x.font='800 24px Georgia';x.textAlign='left';x.fillText(''+n,54,34);
  const t=new THREE.CanvasTexture(c);return t;}
function repairTex(){const c=document.createElement('canvas');c.width=150;c.height=76;const x=c.getContext('2d');x.clearRect(0,0,150,76);
  x.fillStyle='rgba(150,32,28,.92)';rr(x,6,10,138,44,22);x.fill();x.strokeStyle='rgba(255,150,130,.8)';x.lineWidth=2;rr(x,6,10,138,44,22);x.stroke();
  x.font='27px serif';x.textAlign='left';x.textBaseline='middle';x.fillText('🔧',16,33);
  x.fillStyle='#ffe0d8';x.font='800 22px Georgia';x.fillText('FIX',60,34);
  return new THREE.CanvasTexture(c);}
function rr(x,X,Y,w,h,r){x.beginPath();x.moveTo(X+r,Y);x.arcTo(X+w,Y,X+w,Y+h,r);x.arcTo(X+w,Y+h,X,Y+h,r);x.arcTo(X,Y+h,X,Y,r);x.arcTo(X,Y,X+w,Y,r);x.closePath();}

function buildScene(){
  cv=document.createElement('canvas');
  renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(46,1,0.5,600);
  sky=new THREE.Mesh(new THREE.SphereGeometry(300,20,16),new THREE.MeshBasicMaterial({side:THREE.BackSide}));scene.add(sky);
  const sg=new THREE.BufferGeometry(),sp=[];for(let i=0;i<300;i++){const r=280,th=Math.random()*6.28,ph=Math.acos(Math.random());sp.push(r*Math.sin(ph)*Math.cos(th),Math.abs(r*Math.cos(ph)),r*Math.sin(ph)*Math.sin(th));}
  sg.setAttribute('position',new THREE.Float32BufferAttribute(sp,3));
  starPts=new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:1.5,transparent:true,opacity:.85}));scene.add(starPts);
  moon=new THREE.Mesh(new THREE.SphereGeometry(6,16,16),new THREE.MeshBasicMaterial({color:0xfff6e0}));moon.position.set(-70,60,-120);scene.add(moon);
  hemi=new THREE.HemisphereLight(0x9fb4d0,0x1a140f,.7);scene.add(hemi);
  sun=new THREE.DirectionalLight(0xfff2d6,1);sun.position.set(24,44,26);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-30;sun.shadow.camera.right=30;sun.shadow.camera.top=30;sun.shadow.camera.bottom=-30;sun.shadow.camera.far=160;scene.add(sun);
  worldGroup=new THREE.Group();scene.add(worldGroup);
  buildCity();
  applyMode(autoMode());
  camAngle=0.4; focusX=districtX(S.district); focusXTarget=focusX; updateCam();
}
let starPts,moon;
function districtX(i){return i*DGAP;}
function plotXd(k,nl){return (k-(nl-1)/2)*5;}
let cityGroup;
function buildCity(){
  if(cityGroup){worldGroup.remove(cityGroup);clearGroup(cityGroup);}
  cityGroup=new THREE.Group();worldGroup.add(cityGroup);
  plots.length=0;clickable.length=0;emisMats.length=0;
  const n=S.districts.length, spanW=(n-1)*DGAP;
  // one big ground plane spanning the whole city
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(spanW+320,320),std({color:0x20242c,roughness:1}));
  ground.rotation.x=-Math.PI/2;ground.position.set(spanW/2,-0.62,40);ground.receiveShadow=true;cityGroup.add(ground);
  // continuous avenue running past every district
  const road=new THREE.Mesh(new THREE.BoxGeometry(spanW+DGAP+24,0.4,16),std({color:0x2a2f36,roughness:.98}));road.position.set(spanW/2,-0.55,14);road.receiveShadow=true;cityGroup.add(road);
  for(let x=-12;x<spanW+12;x+=4){const d=new THREE.Mesh(new THREE.BoxGeometry(2,0.02,0.3),std({color:0xE3C05A,emissive:0xE3C05A,emissiveIntensity:.4}));d.position.set(x,-0.34,14);cityGroup.add(d);emisMats.push(d.material);}
  for(let i=0;i<n;i++) buildDistrict(i);
}
function buildDistrict(i){
  const dg=new THREE.Group();dg.position.set(districtX(i),0,0);cityGroup.add(dg);
  const D=S.districts[i], nl=D.lots.length, baseW=nl*5+6;
  const walk=new THREE.Mesh(new THREE.BoxGeometry(baseW,1,10),std({color:0x6f6a60,roughness:.96}));walk.position.set(0,-0.5,0);walk.receiveShadow=true;dg.add(walk);
  const curb=new THREE.Mesh(new THREE.BoxGeometry(baseW,0.5,0.6),std({color:0x8a8478}));curb.position.set(0,-0.25,5.2);dg.add(curb);
  // cross-street on the right edge to separate districts
  if(i<S.districts.length-1){const cs=new THREE.Mesh(new THREE.BoxGeometry(DGAP-baseW+2,0.38,10),std({color:0x2a2f36,roughness:.98}));cs.position.set(baseW/2+(DGAP-baseW)/2,-0.56,0);dg.add(cs);}
  // district nameplate
  const sgn=districtSign(i);sgn.position.set(-baseW/2+1.6,3.4,3.0);dg.add(sgn);
  // streetlamp globes (emissive only — no dynamic lights, so the city scales)
  [-baseW/2+2,baseW/2-2].forEach(x=>{const pole=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,7,8),std({color:0x2a3038}));pole.position.set(x,3,4.4);dg.add(pole);
    const glo=new THREE.Mesh(new THREE.SphereGeometry(.4,10,10),std({color:0xfff2c0,emissive:0xffdf8a,emissiveIntensity:1}));glo.position.set(x,6.6,4.4);dg.add(glo);emisMats.push(glo.material);});
  for(let k=0;k<nl;k++){
    const g=new THREE.Group();g.position.set(plotXd(k,nl),0,0);dg.add(g);
    const rec={group:g,d:i,i:k,building:null,coin:null,coinBaseY:8};
    plots.push(rec);renderPlot(rec);
  }
}
function districtSign(i){const c=document.createElement('canvas');c.width=256;c.height=96;const x=c.getContext('2d');
  x.fillStyle='#0c120e';rr(x,4,4,248,88,12);x.fill();x.strokeStyle=districtAccent(i);x.lineWidth=6;rr(x,4,4,248,88,12);x.stroke();
  x.textAlign='center';x.fillStyle=districtAccent(i);x.font='700 14px "Work Sans",Arial';x.fillText('DISTRICT '+(i+1),128,30);
  x.fillStyle='#f6efdd';x.font='800 25px Georgia';x.fillText(districtName(i),128,64);
  const t=new THREE.CanvasTexture(c);const m=std({map:t,emissiveMap:t,emissive:0xffffff,emissiveIntensity:.5,transparent:true});emisMats.push(m);
  const grp=new THREE.Group();
  const post=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,3.4,6),std({color:0x2a3038}));post.position.y=-1.3;grp.add(post);
  grp.add(new THREE.Mesh(new THREE.PlaneGeometry(3.5,1.31),m));
  return grp;}
function clearGroup(g){for(let k=g.children.length-1;k>=0;k--){const o=g.children[k];g.remove(o);o.traverse&&o.traverse(n=>{if(n.geometry)n.geometry.dispose();if(n.material){(Array.isArray(n.material)?n.material:[n.material]).forEach(m=>m.dispose&&m.dispose());}});}}
function lotOf(rec){return S.districts[rec.d].lots[rec.i];}
function renderPlot(rec){
  const g=rec.group;clearGroup(g);
  const lot=lotOf(rec);
  const pad=new THREE.Mesh(new THREE.BoxGeometry(4.4,0.2,5),std({color:0x54504a,roughness:.95}));pad.position.y=0.1;pad.receiveShadow=true;g.add(pad);
  if(lot.built){ buildShop(rec,lot); }
  else { buildLot(rec,lot); }
}
function buildShop(rec,lot){
  const g=rec.group;const t=TYPES[lot.type];const tp=texPair(t.pal);
  const h=6.4+Math.min(6,(lot.lvl-1)*0.6), w=3.9, d=3.6;
  const mat=std({map:tp.map,emissiveMap:tp.emis,emissive:tp.glass?0x9fd0ff:0xffcf7a,emissiveIntensity:S3[mode].emis,roughness:tp.glass?.4:.85,metalness:tp.glass?.3:.04});
  emisMats.push(mat);
  const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);body.position.y=h/2+0.2;body.castShadow=true;body.receiveShadow=true;g.add(body);
  const corn=new THREE.Mesh(new THREE.BoxGeometry(w+.4,.5,d+.4),std({color:t.pal.trim}));corn.position.y=h+0.45;g.add(corn);
  // base storefront
  const base=new THREE.Mesh(new THREE.BoxGeometry(w+.2,2.3,d+.2),std({color:0x14100c,roughness:.85}));base.position.y=1.35;base.castShadow=true;g.add(base);
  // awning
  const awn=new THREE.Mesh(new THREE.BoxGeometry(w+.5,.5,.6),std({color:t.awn,roughness:.6}));awn.position.set(0,2.5,d/2+0.2);g.add(awn);
  // sign
  const st=signTex(t.name,t.emoji,'#E3C05A');const sm=std({map:st,emissiveMap:st,emissive:0xffffff,emissiveIntensity:.6,transparent:true});emisMats.push(sm);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(w*0.92,w*0.92*72/256*1.6),sm);sign.position.set(0,3.4,d/2+0.16);g.add(sign);
  // window + door on the front base
  const win=new THREE.Mesh(new THREE.PlaneGeometry(w*0.5,1.4),std({map:makeGlass(),emissive:0x9fd0ff,emissiveIntensity:.35}));win.position.set(-w*0.18,1.5,d/2+0.13);g.add(win);
  const door=new THREE.Mesh(new THREE.BoxGeometry(0.9,1.8,0.15),std({color:0x2a1a10}));door.position.set(w*0.28,1.1,d/2+0.12);g.add(door);
  const prod=new THREE.Mesh(new THREE.PlaneGeometry(0.7,0.7),std({map:emojiTex(t.emoji),transparent:true}));prod.position.set(-w*0.18,1.5,d/2+0.15);g.add(prod);
  body.userData={rec}; base.userData={rec}; sign.userData={rec};
  clickable.push(body,base,sign);
  rec.building=g;
  // coin bubble
  const ct=coinTex(Math.floor(lot.stock||0));const cm=new THREE.SpriteMaterial({map:ct,transparent:true,depthTest:false});
  const spr=new THREE.Sprite(cm);spr.scale.set(2.6,1.32,1);spr.position.set(0,h+2.0,0.4);spr.userData={rec};g.add(spr);clickable.push(spr);
  rec.coin=spr;rec.coinTex=ct;rec.coinBaseY=h+2.0;
}
function buildLot(rec,lot){
  const g=rec.group;const idx=rec.i;
  const next=nextUnlockIndex(rec.d);
  const isNext=(idx===next);
  const col=isNext?0xE3C05A:0x5a6a5a;
  for(let s=-1;s<=1;s+=2){const p=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,1.2,6),std({color:col,emissive:isNext?0xE3C05A:0x000000,emissiveIntensity:isNext?.4:0}));p.position.set(s*1.8,0.7,d0);g.add(p);}
  const sign=makeLotSign(lotCostFor(rec.d,idx),isNext);sign.position.set(0,1.9,d0);g.add(sign);
  sign.userData={rec,lot:true,isNext};clickable.push(sign);
  const pad=g.children.find(c=>c.geometry&&c.geometry.type==='BoxGeometry');
  if(pad){pad.userData={rec,lot:true,isNext};clickable.push(pad);}
  rec.building=null;rec.coin=null;
}
const d0=2.4;
function makeLotSign(cost,isNext){const c=document.createElement('canvas');c.width=256;c.height=128;const x=c.getContext('2d');
  x.fillStyle=isNext?'#14231a':'#0e1512';rr(x,4,4,248,120,14);x.fill();x.strokeStyle=isNext?'#E3C05A':'#4a5a4a';x.lineWidth=5;rr(x,4,4,248,120,14);x.stroke();
  x.textAlign='center';x.fillStyle=isNext?'#E3C05A':'#7a8a7a';
  if(isNext){x.font='800 30px Georgia';x.fillText('OPEN LOT',128,44);x.font='800 40px Georgia';x.fillStyle='#f6efdd';x.fillText(cost>0?('Y '+cost):'FREE',128,92);}
  else{x.font='800 30px Georgia';x.fillText('LOCKED',128,58);x.font='700 20px "Work Sans",Arial';x.fillText('open the lot before it',128,92);}
  const t=new THREE.CanvasTexture(c);const m=std({map:t,emissiveMap:t,emissive:0xffffff,emissiveIntensity:.5,transparent:true});emisMats.push(m);
  return new THREE.Mesh(new THREE.PlaneGeometry(3,1.5),m);}
function nextUnlockIndex(d){const lots=S.districts[d].lots;for(let i=0;i<lots.length;i++){if(!lots[i].built)return i;}return -1;}
function makeGlass(){const c=document.createElement('canvas');c.width=32;c.height=32;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,32,32);g.addColorStop(0,'#d6ecff');g.addColorStop(1,'#8fb8e6');x.fillStyle=g;x.fillRect(0,0,32,32);return new THREE.CanvasTexture(c);}
const emojiCache={};
function emojiTex(e){if(emojiCache[e])return emojiCache[e];const c=document.createElement('canvas');c.width=64;c.height=64;const x=c.getContext('2d');x.font='48px serif';x.textAlign='center';x.textBaseline='middle';x.fillText(e,32,36);const t=new THREE.CanvasTexture(c);emojiCache[e]=t;return t;}

/* ---------------- camera + modes + travel ---------------- */
let camAngle=0.4, camDist=22, camH=12, focusX=0, focusXTarget=0, traveling=false;
function updateCam(){const cz=6, fx=focusX;
  camera.position.set(fx+Math.sin(camAngle)*camDist, camH, Math.cos(camAngle)*camDist + cz);
  camera.lookAt(fx,3.2,0);
  if(sky)sky.position.x=fx; if(starPts)starPts.position.x=fx; if(moon)moon.position.x=fx-70;}
function travelTo(i){if(i<0||i>=S.districts.length)return;S.district=i;focusXTarget=districtX(i);traveling=true;updateDistrictUI();saveSoon();}
function autoMode(){const h=new Date().getHours();return (h>=7&&h<17)?'day':((h>=17&&h<20)||(h>=5&&h<7)?'dusk':'night');}
function applyMode(m){mode=m;const c=S3[m];
  sky.material.map=skyTex(c.sky[0],c.sky[1]);sky.material.needsUpdate=true;
  hemi.intensity=c.amb;sun.intensity=c.sun;
  starPts.material.opacity=c.star;moon.visible=c.star>0.2;
  emisMats.forEach(mm=>{mm.emissiveIntensity=(mm.map&&mm.emissiveMap)?Math.max(.5,c.emis):c.emis;});
  lamps.forEach(L=>L.intensity=(m==='day')?0:(m==='dusk')?.5:1);
  document.body.classList.toggle('day',m==='day');
}

/* ---------------- UI overlay ---------------- */
let ui={};
function buildUI(){
  const wrap=document.createElement('div');wrap.className='bg3-root';
  wrap.innerHTML=
   '<div class="bg3-canvaswrap"></div>'+
   '<div class="bg3-top">'+
     '<div class="bg3-chip" id="bg3coins"><span class="bg3-ycoin"></span><b>0</b></div>'+
     '<div class="bg3-chip" id="bg3streak">🔥 <b>0</b></div>'+
     '<button class="bg3-chip" id="bg3rivals" style="cursor:pointer" title="Rivals & raids">🏆 <b id="bg3rank">#1</b></button>'+
     '<div class="bg3-lvl"><div class="bg3-lvlrow"><span id="bg3lvl">Lvl 1</span><span id="bg3xp">0/50 XP</span></div><div class="bg3-bar"><i id="bg3xpbar"></i></div></div>'+
     '<button class="bg3-icon" id="bg3fs" title="Fullscreen">⤢</button>'+
   '</div>'+
   '<div class="bg3-travel"><button class="bg3-nav" id="bg3prev" title="Previous district">‹</button>'+
     '<div class="bg3-dname" id="bg3dname">Founders Row</div>'+
     '<button class="bg3-nav" id="bg3next" title="Next district">›</button></div>'+
   '<div class="bg3-toast" id="bg3toast"></div>'+
   '<div class="bg3-modal" id="bg3modal"><div class="bg3-box"><button class="bg3-x" id="bg3x">✕</button><div id="bg3modalbody"></div></div></div>';
  host.innerHTML='';host.appendChild(wrap);
  ui.wrap=wrap;ui.canvaswrap=wrap.querySelector('.bg3-canvaswrap');
  ui.coins=wrap.querySelector('#bg3coins b');ui.streak=wrap.querySelector('#bg3streak b');
  ui.lvl=wrap.querySelector('#bg3lvl');ui.xp=wrap.querySelector('#bg3xp');ui.xpbar=wrap.querySelector('#bg3xpbar');
  ui.toast=wrap.querySelector('#bg3toast');ui.modal=wrap.querySelector('#bg3modal');ui.modalbody=wrap.querySelector('#bg3modalbody');
  ui.dname=wrap.querySelector('#bg3dname');ui.prev=wrap.querySelector('#bg3prev');ui.next=wrap.querySelector('#bg3next');
  ui.rank=wrap.querySelector('#bg3rank');
  ui.canvaswrap.appendChild(cv);
  wrap.querySelector('#bg3rivals').onclick=openRivals;
  wrap.querySelector('#bg3x').onclick=closeModal;
  ui.modal.addEventListener('click',e=>{if(e.target===ui.modal)closeModal();});
  wrap.querySelector('#bg3fs').onclick=toggleFs;
  ui.prev.onclick=()=>{if(S.district>0)travelTo(S.district-1);};
  ui.next.onclick=()=>{const last=S.districts.length-1;
    if(S.district<last){travelTo(S.district+1);}
    else if(S.districts[last].lots.every(l=>l.built)){openUnlockDistrict();}
    else {toast('Fill this district with shops first, then expand the city');}};
  injectCSS();updateDistrictUI();
}
function updateDistrictUI(){if(!ui.dname)return;
  ui.dname.textContent=districtName(S.district)+' · District '+(S.district+1);
  ui.prev.disabled=S.district<=0;
  const last=S.districts.length-1;
  if(S.district<last){ui.next.textContent='›';ui.next.classList.remove('plus');ui.next.title='Next district';}
  else {ui.next.textContent='＋';ui.next.classList.add('plus');ui.next.title='Expand the city';}
}
function openUnlockDistrict(){const di=S.districts.length;const cost=districtOpenCost(di);const nm=districtName(di);
  openModal('<h3>🏙️ Expand the city</h3><p>Open a brand-new district, <b>'+nm+'</b> — a fresh block with '+districtLots(di)+' lots to build on. Your other shops keep earning while you grow.</p>'+
    '<div class="bg3-stat" style="border-bottom:none"><span>Unlock cost</span><b>Y '+cost+'</b></div>'+
    '<button class="bg3-btn" id="bg3newd" '+(S.coins>=cost?'':'disabled')+'>'+(S.coins>=cost?('Unlock '+nm+' · Y '+cost):('Need Y '+cost))+'</button>');
  const b=ui.modalbody.querySelector('#bg3newd');if(b)b.onclick=()=>{if(S.coins<cost)return;S.coins-=cost;S.districts.push(makeDistrict(di,false));
    buildCity();applyMode(mode);travelTo(di);toast('Unlocked '+nm+'! Traveling there…');closeModal();refreshUI();saveSoon();};}
function injectCSS(){ if(document.getElementById('bg3css'))return;const s=document.createElement('style');s.id='bg3css';s.textContent=`
.bg3-root{position:relative;width:100%;height:min(72vh,600px);min-height:420px;border-radius:16px;overflow:hidden;background:#0b1220;box-shadow:0 20px 50px rgba(0,0,0,.4);font-family:"Work Sans",system-ui,sans-serif;color:#F5F1E6;-webkit-user-select:none;user-select:none}
.bg3-root.fs{position:fixed;inset:0;height:100dvh;width:100vw;z-index:9999;border-radius:0}
.bg3-canvaswrap{position:absolute;inset:0}
.bg3-canvaswrap canvas{width:100%!important;height:100%!important;display:block;touch-action:none}
.bg3-top{position:absolute;top:10px;left:10px;right:10px;display:flex;align-items:center;gap:8px;z-index:5;pointer-events:none;flex-wrap:wrap}
.bg3-chip{pointer-events:auto;display:flex;align-items:center;gap:6px;background:rgba(8,11,14,.62);backdrop-filter:blur(6px);border:1px solid rgba(227,192,90,.3);border-radius:20px;padding:6px 13px;font-size:15px;font-weight:800}
.bg3-ycoin{width:17px;height:17px;border-radius:50%;background:radial-gradient(circle at 34% 30%,#fff7d8,#F4E3A6 40%,#c9a84a);position:relative}
.bg3-ycoin::after{content:"Y";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 10px Georgia;color:#8a6a1f}
.bg3-lvl{pointer-events:auto;flex:1;min-width:130px;max-width:300px;background:rgba(8,11,14,.62);backdrop-filter:blur(6px);border:1px solid rgba(227,192,90,.25);border-radius:14px;padding:5px 11px}
.bg3-lvlrow{display:flex;justify-content:space-between;font-size:11px;color:#cdd6cd}
.bg3-bar{height:6px;background:rgba(255,255,255,.12);border-radius:6px;margin-top:3px;overflow:hidden}
.bg3-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#7ad03a,#4fae2a);border-radius:6px;transition:width .3s}
.bg3-icon{pointer-events:auto;background:rgba(8,11,14,.62);border:1px solid rgba(227,192,90,.3);color:#F5F1E6;border-radius:12px;width:34px;height:34px;font-size:16px;cursor:pointer}
.bg3-toast{position:absolute;left:50%;bottom:62px;transform:translateX(-50%);background:rgba(8,11,9,.86);border:1px solid rgba(227,192,90,.35);color:#F5F1E6;font-size:13px;padding:9px 16px;border-radius:20px;opacity:0;transition:opacity .3s,transform .3s;z-index:8;pointer-events:none;white-space:nowrap}
.bg3-toast.on{opacity:1;transform:translateX(-50%) translateY(-4px)}
.bg3-travel{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:6px;z-index:6;background:rgba(8,11,14,.66);backdrop-filter:blur(6px);border:1px solid rgba(227,192,90,.3);border-radius:22px;padding:5px 8px}
.bg3-nav{background:rgba(255,255,255,.08);border:none;color:#F5F1E6;width:30px;height:30px;border-radius:50%;font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}
.bg3-nav.plus{color:#E3C05A;font-weight:800}
.bg3-nav:disabled{opacity:.3;cursor:not-allowed}
.bg3-dname{font-size:12.5px;font-weight:800;min-width:168px;text-align:center;color:#F5F1E6}
.bg3-modal{position:absolute;inset:0;z-index:10;display:none;align-items:center;justify-content:center;background:rgba(4,6,9,.6);backdrop-filter:blur(3px);padding:16px}
.bg3-modal.on{display:flex}
.bg3-box{position:relative;width:100%;max-width:420px;background:linear-gradient(160deg,#14201a,#0b130e);border:1px solid rgba(227,192,90,.4);border-radius:16px;padding:20px}
.bg3-x{position:absolute;top:10px;right:12px;background:none;border:none;color:#9AA79A;font-size:19px;cursor:pointer}
.bg3-box h3{font-family:Georgia,serif;font-size:20px;margin-bottom:4px}
.bg3-box p{font-size:13px;color:#cdd6cd;margin-bottom:12px}
.bg3-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.bg3-cell{background:rgba(255,255,255,.05);border:1px solid rgba(227,192,90,.25);border-radius:12px;padding:9px 4px;text-align:center;cursor:pointer;transition:transform .1s}
.bg3-cell:active{transform:scale(.95)}
.bg3-cell.lock{opacity:.4;cursor:not-allowed}
.bg3-cell .e{font-size:26px}.bg3-cell .n{font-size:10.5px;color:#cdd6cd;margin-top:2px}
.bg3-btn{width:100%;margin-top:12px;background:linear-gradient(180deg,#E3C05A,#B0862F);color:#14231a;border:none;border-radius:10px;padding:12px;font-weight:800;font-size:14px;cursor:pointer}
.bg3-btn:disabled{filter:grayscale(.7);opacity:.6;cursor:not-allowed}
.bg3-stat{display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.07)}
.bg3-mini{flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:7px 5px;text-align:center}
.bg3-mini .k{font-size:9px;color:#9AA79A;text-transform:uppercase;letter-spacing:.03em;line-height:1.2}
.bg3-mini .v{font-size:17px;font-weight:800;margin-top:3px}
.bg3-lb{margin-top:8px;max-height:238px;overflow-y:auto;display:flex;flex-direction:column;gap:3px}
.bg3-lbrow{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:10px;font-size:13px;background:rgba(255,255,255,.03)}
.bg3-lbrow.me{background:rgba(227,192,90,.15);border:1px solid rgba(227,192,90,.4)}
.bg3-lbrow .rk{width:16px;color:#9AA79A;font-weight:800;text-align:center}
.bg3-lbrow .av{font-size:18px}
.bg3-lbrow .nm{flex:1;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bg3-lbrow .wo{color:#E3C05A;font-weight:800;font-size:11.5px;white-space:nowrap}
.bg3-raid{background:linear-gradient(180deg,#E3242B,#a01820);color:#fff;border:none;border-radius:8px;padding:5px 0;width:56px;font-weight:800;font-size:11.5px;cursor:pointer;flex:none}
.bg3-raid:disabled{filter:grayscale(.55);opacity:.5;cursor:not-allowed}
`;document.head.appendChild(s);}

function refreshUI(){
  ui.coins.textContent=Math.floor(S.coins).toLocaleString();
  ui.streak.textContent=S.streak||0;
  ui.lvl.textContent='Lvl '+S.level;
  const need=LEVEL_XP(S.level);ui.xp.textContent=Math.floor(S.xp)+'/'+need+' XP';
  ui.xpbar.style.width=Math.min(100,(S.xp/need)*100)+'%';
  if(ui.rank){const pw=playerWorth();let above=0;RIVALS.forEach(r=>{if(rivalWorth(r)>pw)above++;});ui.rank.textContent='#'+(above+1);}
}
let toastT;
function toast(msg){ui.toast.textContent=msg;ui.toast.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>ui.toast.classList.remove('on'),2000);}
function openModal(html){ui.modalbody.innerHTML=html;ui.modal.classList.add('on');}
function closeModal(){ui.modal.classList.remove('on');}

/* ---------------- interactions ---------------- */
const ray=new THREE.Raycaster();let dragId=null,dragX=0,moved=0,downX=0,downY=0;
function bindInput(){
  cv.addEventListener('pointerdown',e=>{dragId=e.pointerId;dragX=e.clientX;downX=e.clientX;downY=e.clientY;moved=0;});
  cv.addEventListener('pointermove',e=>{if(e.pointerId!==dragId)return;const dx=e.clientX-dragX;camAngle=Math.max(-0.9,Math.min(0.9,camAngle-dx*0.006));dragX=e.clientX;moved+=Math.abs(dx);updateCam();});
  cv.addEventListener('pointerup',e=>{if(e.pointerId!==dragId)return;if(moved<6&&Math.hypot(e.clientX-downX,e.clientY-downY)<8)tap(e.clientX,e.clientY);dragId=null;});
  cv.addEventListener('wheel',e=>{camDist=Math.max(13,Math.min(30,camDist+Math.sign(e.deltaY)*1.4));updateCam();e.preventDefault();},{passive:false});
}
function tap(cx,cy){const r=cv.getBoundingClientRect();const ndc=new THREE.Vector2(((cx-r.left)/r.width)*2-1,-((cy-r.top)/r.height)*2+1);
  ray.setFromCamera(ndc,camera);const hits=ray.intersectObjects(clickable,false);if(!hits.length)return;
  const obj=hits[0].object;let o=obj;while(o&&!(o.userData&&o.userData.rec))o=o.parent;if(!o)return;const rec=o.userData.rec;const lot=lotOf(rec);
  ensureDaily();
  if(rec.d!==S.district) travelTo(rec.d); // clicked a shop in another district — go there
  if(!lot.built){ openBuild(rec); return; }
  // tap the coin bubble to quick-collect; tap the building to open its dashboard
  if(rec.coin && obj===rec.coin && !lot.broke && Math.floor(lot.stock||0)>=1){ collect(rec); return; }
  openStore(rec);
}
function collect(rec){const lot=lotOf(rec);const amt=Math.floor(lot.stock||0);if(amt<1)return;
  lot.stock-=amt;S.coins+=amt;gainXP(amt);flyCoin(rec);toast('+'+amt+' Y');refreshUI();saveSoon();updateCoin(rec);}
function flyCoin(rec){ if(rec.coin){rec.coin.scale.set(3.1,1.6,1);setTimeout(()=>{if(rec.coin)rec.coin.scale.set(2.6,1.32,1);},120);} }
function gainXP(n){S.xp+=n;let lvlup=false;while(S.xp>=LEVEL_XP(S.level)){S.xp-=LEVEL_XP(S.level);S.level++;lvlup=true;}if(lvlup){toast('Level up! Lvl '+S.level);}}
function openBuild(rec){const idx=rec.i;const next=nextUnlockIndex(rec.d);
  if(idx!==next){openModal('<h3>Locked lot</h3><p>Open the earlier lot first — lots unlock left to right.</p>');return;}
  const cost=lotCostFor(rec.d,idx);
  let cells='';TYPE_ORDER.forEach(k=>{const t=TYPES[k];const locked=t.lvlReq>S.level;
    cells+='<div class="bg3-cell'+(locked?' lock':'')+'" data-k="'+k+'"><div class="e">'+t.emoji+'</div><div class="n">'+t.name+(locked?'<br>Lvl '+t.lvlReq:'')+'</div></div>';});
  openModal('<h3>Open a new shop</h3><p>Costs <b>Y '+cost+'</b> to open this lot. Pick what to build:</p><div class="bg3-grid">'+cells+'</div><div class="bg3-toast2" id="bg3sel" style="font-size:12px;color:#E3C05A;min-height:16px;margin-top:8px"></div><button class="bg3-btn" id="bg3build" disabled>Choose a shop</button>');
  let sel=null;const btn=ui.modalbody.querySelector('#bg3build');
  ui.modalbody.querySelectorAll('.bg3-cell').forEach(c=>c.onclick=()=>{if(c.classList.contains('lock'))return;sel=c.getAttribute('data-k');
    ui.modalbody.querySelectorAll('.bg3-cell').forEach(x=>x.style.outline='');c.style.outline='2px solid #E3C05A';
    const can=S.coins>=cost;btn.disabled=!can;btn.textContent=can?('Build '+TYPES[sel].name+' · Y '+cost):('Need Y '+cost);});
  btn.onclick=()=>{if(!sel||S.coins<cost)return;S.coins-=cost;const t=TYPES[sel];lotBuild(rec,sel);toast('Opened '+t.name+'!');closeModal();refreshUI();saveSoon();updateDistrictUI();};
}
function lotBuild(rec,type){const lot=lotOf(rec);lot.built=true;lot.unlocked=true;lot.type=type;lot.name=TYPES[type].name;lot.lvl=1;lot.stock=0;lot.t=Date.now();lot.cond=100;lot.broke=false;lot.rev=0;lot.exp=0;renderPlot(rec);applyMode(mode);}
function openStore(rec){const lot=lotOf(rec);const t=TYPES[lot.type];
  const gMin=grossPerMin(lot)*condMult(lot);
  const supMin=gMin*SUPPLY_RATE, rentMin=(gMin>0?rentPerMin(lot):0);
  const netMin=Math.max(0,gMin-supMin-rentMin);
  const cond=Math.round(condOf(lot)), upC=upgradeCost(lot), repC=repairCost(lot), stock=Math.floor(lot.stock||0);
  const cc=lot.broke?'#ff6a5a':cond>=COND_WARN?'#7ad03a':cond>=COND_LOW?'#E3C05A':'#ff9a4a';
  const cl=lot.broke?'BROKEN':cond>=COND_WARN?'Good':cond>=COND_LOW?'Worn':'Failing';
  const rev=Math.round(lot.rev||0), exp=Math.round(lot.exp||0), prof=rev-exp;
  let h='<h3>'+t.emoji+' '+t.name+' <span style="font-size:12px;color:#9AA79A;font-family:Work Sans">Lvl '+lot.lvl+'</span></h3>';
  h+='<div style="display:flex;align-items:center;gap:8px;margin:2px 0 12px"><span style="font-size:11px;color:#9AA79A">Equipment</span><div style="flex:1;height:9px;background:rgba(255,255,255,.12);border-radius:6px;overflow:hidden"><i style="display:block;height:100%;width:'+(lot.broke?100:cond)+'%;background:'+cc+'"></i></div><b style="font-size:12px;color:'+cc+'">'+cl+'</b></div>';
  h+='<div class="bg3-stat"><span>Earning</span><b>'+gMin.toFixed(1)+' Y/min</b></div>';
  h+='<div class="bg3-stat"><span>– Supplies (15%)</span><b style="color:#ef8fb0">'+(supMin>0?'-'+supMin.toFixed(1):'0.0')+'</b></div>';
  h+='<div class="bg3-stat"><span>– Rent</span><b style="color:#ef8fb0">'+(rentMin>0?'-'+rentMin.toFixed(1):'0.0')+'</b></div>';
  h+='<div class="bg3-stat" style="border-bottom:none"><span style="color:#F5F1E6"><b>= Profit</b></span><b style="color:#7ad03a">'+netMin.toFixed(1)+' Y/min</b></div>';
  h+='<div style="display:flex;gap:8px;margin:10px 0 2px">'+
     '<div class="bg3-mini"><div class="k">Revenue today</div><div class="v">'+rev+'</div></div>'+
     '<div class="bg3-mini"><div class="k">Expenses</div><div class="v" style="color:#ef8fb0">'+exp+'</div></div>'+
     '<div class="bg3-mini"><div class="k">Profit</div><div class="v" style="color:#7ad03a">'+prof+'</div></div></div>';
  if(lot.broke){
    h+='<p style="color:#ff9a4a;font-size:12px;margin:10px 0 0">Equipment is broken — this shop earns nothing until you repair it.</p>';
    h+='<button class="bg3-btn" id="bg3rep" '+(S.coins>=repC?'':'disabled')+'>🔧 Repair · Y '+repC+'</button>';
  } else {
    if(stock>=1) h+='<button class="bg3-btn" id="bg3col" style="background:linear-gradient(180deg,#7ad03a,#4fae2a);color:#0c1a08">Collect '+stock+' Y</button>';
    if(cond<100) h+='<button class="bg3-btn" id="bg3rep" style="background:rgba(227,192,90,.14);color:#E3C05A;border:1px solid rgba(227,192,90,.4)" '+(S.coins>=repC?'':'disabled')+'>🔧 Tune-up · Y '+repC+'</button>';
    h+='<button class="bg3-btn" id="bg3up" '+(S.coins>=upC?'':'disabled')+'>⬆ Upgrade · Y '+upC+'</button>';
  }
  openModal(h);
  const col=ui.modalbody.querySelector('#bg3col');if(col)col.onclick=()=>{collect(rec);closeModal();};
  const rep=ui.modalbody.querySelector('#bg3rep');if(rep)rep.onclick=()=>{if(S.coins<repC)return;S.coins-=repC;lot.exp=(lot.exp||0)+repC;lot.broke=false;lot.cond=100;toast('Repaired '+t.name+'!');updateCoin(rec);closeModal();refreshUI();saveSoon();};
  const up=ui.modalbody.querySelector('#bg3up');if(up)up.onclick=()=>{if(S.coins<upC)return;S.coins-=upC;lot.lvl++;gainXP(8);renderPlot(rec);applyMode(mode);toast('Upgraded to Lvl '+lot.lvl);closeModal();refreshUI();saveSoon();};
}
function updateCoin(rec){if(!rec.coin)return;const lot=lotOf(rec);let t,vis;
  if(lot.broke){t=repairTex();vis=true;} else {const n=Math.floor(lot.stock||0);t=coinTex(n);vis=n>=1;}
  if(rec.coin.material.map&&rec.coin.material.map.dispose)rec.coin.material.map.dispose();
  rec.coin.material.map=t;rec.coin.material.needsUpdate=true;rec.coin.visible=vis;}

/* ---------------- daily / streak ---------------- */
function ensureDaily(){const td=todayStr();if(S.lastDay===td)return;
  if(S.lastDay===yStr())S.streak=(S.streak||0)+1;else S.streak=1;S.lastDay=td;
  eachLot(l=>{if(l.built){l.rev=0;l.exp=0;}}); // reset daily books city-wide
  const bonus=Math.min(120,20*S.streak);S.coins+=bonus;toast('Daily +'+bonus+' Y · streak '+S.streak);refreshUI();saveSoon();}

/* ---------------- AI rivals & raids ---------------- */
function openRivals(){ raidTickets();
  const pw=playerWorth();
  const list=RIVALS.map(r=>({name:r.name,emoji:r.emoji,worth:rivalWorth(r),r:r}));
  list.push({name:'You',emoji:'⭐',worth:pw,me:true});
  list.sort((a,b)=>b.worth-a.worth);
  const rank=list.findIndex(x=>x.me)+1;
  const R=S.raid;
  let h='<h3>🏆 City Rivals</h3><p>You\'re rank <b>#'+rank+'</b> of '+list.length+' · Net worth <b style="color:#E3C05A">Y '+pw.toLocaleString()+'</b></p>';
  h+='<div style="display:flex;gap:8px;margin-bottom:10px">'+
     '<div class="bg3-mini"><div class="k">Raid tickets</div><div class="v">'+R.tickets+'/'+RAID_MAX_TICKETS+'</div></div>'+
     '<div class="bg3-mini"><div class="k">Shield</div><div class="v" style="font-size:13px">'+(shieldActive()?fmtMs(R.shieldUntil-Date.now()):'off')+'</div></div>'+
     '<div class="bg3-mini"><div class="k">Raids won</div><div class="v" style="font-size:15px">'+(R.wins||0)+'</div></div></div>';
  if(!shieldActive()) h+='<button class="bg3-btn" id="bg3shield" style="background:rgba(80,140,220,.16);color:#8fc4f0;border:1px solid rgba(120,170,230,.5);margin-top:0" '+(S.coins>=SHIELD_COST?'':'disabled')+'>🛡️ Shield your city 1h · Y '+SHIELD_COST+'</button>';
  else h+='<p style="color:#8fc4f0;font-size:12px;text-align:center;margin:2px 0">🛡️ Protected for '+fmtMs(R.shieldUntil-Date.now())+' — rivals can\'t raid you.</p>';
  h+='<div class="bg3-lb">';
  list.forEach((x,idx)=>{ const onCd=x.r&&(R.cd[x.r.id]||0)>Date.now();
    h+='<div class="bg3-lbrow'+(x.me?' me':'')+'"><span class="rk">'+(idx+1)+'</span><span class="av">'+x.emoji+'</span><span class="nm">'+x.name+'</span><span class="wo">Y '+x.worth.toLocaleString()+'</span>'+
      (x.me?'<span style="width:56px"></span>':'<button class="bg3-raid" data-r="'+x.r.id+'" '+((R.tickets<1||onCd)?'disabled':'')+'>'+(onCd?fmtMs((R.cd[x.r.id]||0)-Date.now()):'Raid')+'</button>')+'</div>';
  });
  h+='</div><p style="font-size:11px;color:#9AA79A;margin-top:8px;margin-bottom:0">Raiding earns you coins from a rival\'s vault. Tickets refill over time. Rivals are computer players — never real people.</p>';
  openModal(h);
  const sh=ui.modalbody.querySelector('#bg3shield');if(sh)sh.onclick=()=>{if(S.coins<SHIELD_COST)return;S.coins-=SHIELD_COST;S.raid.shieldUntil=Date.now()+SHIELD_DUR;toast('🛡️ Shield up for 1 hour!');refreshUI();saveSoon();openRivals();};
  ui.modalbody.querySelectorAll('.bg3-raid').forEach(b=>b.onclick=()=>{const id=b.getAttribute('data-r');const r=RIVALS.find(z=>z.id===id);if(r&&doRaid(r))openRivals();});
}
function doRaid(r){raidTickets();const R=S.raid;const now=Date.now();
  if(R.tickets<1){toast('No raid tickets left — they refill over time');return false;}
  if((R.cd[r.id]||0)>now){toast(r.name+' is recovering — try again later');return false;}
  const wasMax=R.tickets>=RAID_MAX_TICKETS;R.tickets-=1;if(wasMax)R.ticketsT=now;
  R.cd[r.id]=now+RAID_CD;
  const defended=hash01(r.id+':'+Math.floor(now/1000))<0.22; // ~22%: rival had a shield up
  let reward=Math.round(rivalWorth(r)*0.03*(0.8+0.5*hash01(r.name+now)));
  reward=Math.max(15,Math.min(reward,Math.round(playerWorth()*0.2)+60));
  if(defended)reward=Math.max(8,Math.round(reward*0.45));
  S.coins+=reward;R.wins=(R.wins||0)+1;gainXP(4);
  toast((defended?'🛡️ '+r.name+' blocked some — ':'💰 Raided '+r.name+'! ')+'+'+reward+' Y');
  refreshUI();saveSoon();return true;
}
let raidTO=null;
function scheduleIncoming(){clearTimeout(raidTO);const t=105000+Math.random()*75000;raidTO=setTimeout(()=>{incomingRaid();scheduleIncoming();},t);}
function incomingRaid(){ if(shieldActive())return; if(ui.modal&&ui.modal.classList.contains('on'))return;
  const r=RIVALS[Math.floor(Math.random()*RIVALS.length)];
  const bonus=Math.round(playerWorth()*0.02)+20;
  const skim=Math.min(45,Math.max(8,Math.round(playerWorth()*0.012)));
  let done=false;
  openModal('<h3>🚨 Raid incoming!</h3><p><b>'+r.emoji+' '+r.name+'</b> is trying to raid your block. Defend to chase them off and grab a bonus!</p>'+
    '<div class="bg3-stat"><span>If you defend</span><b style="color:#7ad03a">+'+bonus+' Y</b></div>'+
    '<div class="bg3-stat" style="border-bottom:none"><span>If they get through</span><b style="color:#ef8fb0">-'+skim+' Y</b></div>'+
    '<button class="bg3-btn" id="bg3def">🛡️ Defend!</button>');
  const finish=(won)=>{if(done)return;done=true;
    if(won){S.coins+=bonus;S.raid.wins=(S.raid.wins||0)+1;toast('🛡️ Defended! +'+bonus+' Y');}
    else{S.coins=Math.max(0,S.coins-skim);S.raid.losses=(S.raid.losses||0)+1;toast(r.emoji+' '+r.name+' skimmed '+skim+' Y');}
    refreshUI();saveSoon();closeModal();};
  const b=ui.modalbody.querySelector('#bg3def');if(b)b.onclick=()=>finish(true);
  setTimeout(()=>finish(false),9000); // auto-resolve if ignored (small, capped)
}

/* ---------------- loop ---------------- */
let last=performance.now(),coinAcc=0;
function tick(now){const dt=Math.min(.1,(now-last)/1000);last=now;
  // accrue + wear + random breakdowns + per-shop books, across the whole city
  eachLot(l=>{ if(!l.built)return;
    if(!l.broke){
      l.cond=Math.max(0,condOf(l)-COND_DECAY*dt);
      if(l.cond<COND_WARN && Math.random()<BREAK_P_PER_SEC*dt){ l.broke=true; toast('🔧 '+(l.name||'A shop')+' broke down — tap to repair'); }
    }
    const gSec=grossPerMin(l)*condMult(l)/60*dt;   // gross this frame (0 when broke)
    const supSec=gSec*SUPPLY_RATE, rentSec=(gSec>0?rentPerMin(l)/60*dt:0);
    const netSec=Math.max(0,gSec-supSec-rentSec);
    const cap=storageCap(l); l.stock=Math.min(cap,(l.stock||0)+netSec);
    l.rev=(l.rev||0)+gSec; l.exp=(l.exp||0)+supSec+rentSec; l.t=Date.now();
  });
  // smooth travel between districts
  if(traveling||Math.abs(focusX-focusXTarget)>0.01){focusX+=(focusXTarget-focusX)*Math.min(1,dt*3.2);if(Math.abs(focusX-focusXTarget)<0.05){focusX=focusXTarget;traveling=false;}updateCam();}
  // update coin bubbles ~2/sec + bob
  coinAcc+=dt;const ts=now/1000;
  plots.forEach(rec=>{if(rec.coin){rec.coin.position.y=(rec.coinBaseY||8)+Math.sin(ts*2+rec.i)*0.12;}});
  if(coinAcc>0.5){coinAcc=0;plots.forEach(rec=>{if(rec.coin)updateCoin(rec);});}
  renderer.render(scene,camera);requestAnimationFrame(tick);
}
function resize(){if(!ui.canvaswrap)return;const w=ui.canvaswrap.clientWidth||800,h=ui.canvaswrap.clientHeight||500;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
function toggleFs(){ui.wrap.classList.toggle('fs');setTimeout(resize,60);}

/* ---------------- public API ---------------- */
function mount(el){host=el||document.getElementById('blockMount');if(!host)return;
  load();buildScene();buildUI();bindInput();resize();refreshUI();ensureDaily();
  window.addEventListener('resize',resize);
  // re-check day/night every few minutes
  setInterval(()=>applyMode(autoMode()),120000);
  scheduleIncoming(); // rivals start trying to raid after a couple minutes
  requestAnimationFrame(tick);
}
function reward(n,msg){n=Math.max(0,Math.floor(n||0));S.coins+=n;if(msg)toast(msg);else toast('+'+n+' Y');refreshUI&&refreshUI();saveSoon();}
function add(n){reward(n);}
function rewardVisit(ref){ref=String(ref||'');S.visited=S.visited||{day:'',refs:{}};const td=todayStr();if(S.visited.day!==td){S.visited.day=td;S.visited.refs={};}if(S.visited.refs[ref])return false;S.visited.refs[ref]=1;reward(25,'+25 Y for visiting a shop!');return true;}
function rewardToken(key){key=String(key||'');S.tokens=S.tokens||{};if(S.tokens[key])return false;S.tokens[key]=1;reward(10,'+10 Y · coin found!');return true;}
function share(){const url=location.origin+'/block.html';try{if(navigator.share){navigator.share({title:'My Block · Youngpreneur Square',url});}else{navigator.clipboard&&navigator.clipboard.writeText(url);toast('Link copied!');}}catch(e){}}
function get(){return JSON.parse(JSON.stringify(S));}

window.SquareGame={mount,reward,add,get,rewardVisit,rewardToken,share};
})();
