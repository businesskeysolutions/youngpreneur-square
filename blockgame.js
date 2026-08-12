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
function eventMult(l){let m=1;if(l.ev&&l.ev.type==='rush'&&(l.ev.until||0)>Date.now())m*=(l.ev.mult||3);if((S.lucky||0)>Date.now())m*=2;return m;}
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
  lastSeen:0,spinDay:'',goals:null,servedToday:0,collectsToday:0,earnedToday:0,
  cityName:'',decor:{planters:false,lights:false,banner:false,fountain:false},collected:['bakery'],collectClaimed:false,rank:0,event:null,
  spins:30,spinsT:0,stickers:{},stickerClaimed:false,
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
  if(!S.decor)S.decor={planters:false,lights:false,banner:false,fountain:false};
  if(!S.collected)S.collected=[];eachLot(l=>{if(l.built&&l.type&&S.collected.indexOf(l.type)<0)S.collected.push(l.type);});
  if(S.spins==null)S.spins=30;if(!S.spinsT)S.spinsT=Date.now();if(!S.stickers)S.stickers={};
  // clear stale timed events from a previous session
  eachLot(l=>{if(l.ev&&(l.ev.until||0)<Date.now())l.ev=null;});
  if((S.lucky||0)<Date.now())S.lucky=0;
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
const S3={ day:{sky:['#7ec8ff','#dff2ff'],amb:1.05,sun:1.35,emis:0,star:0,grass:0x74c34a,dirt:0xb08454,fog:0xcdeaff},
          dusk:{sky:['#3a3f66','#ffab5e'],amb:.78,sun:.8,emis:.55,star:.25,grass:0x4f7e42,dirt:0x7a5a3a,fog:0x5a4a6a},
          night:{sky:['#1a2748','#4a3f6a'],amb:.66,sun:.32,emis:1,star:.85,grass:0x2f4a34,dirt:0x40332a,fog:0x1a2340} };
const std=o=>new THREE.MeshStandardMaterial(o);
const plots=[]; // {group, d, i, building, coin, evSprite}
const clickable=[]; const emisMats=[]; const lamps=[]; const walkers=[];

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
  scene.fog=new THREE.Fog(0xcdeaff,95,300);
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
  interiorGroup=new THREE.Group();interiorGroup.position.set(0,400,0);interiorGroup.visible=false;scene.add(interiorGroup);
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
  plots.length=0;clickable.length=0;emisMats.length=0;walkers.length=0;platGrassMats=[];platDirtMats=[];
  const n=S.districts.length, spanW=(n-1)*DGAP;
  const cm=S3[mode]||S3.day;
  // diorama island the whole city sits on — grass top, dirt sides (reads as a little world on a table)
  const pw=spanW+DGAP+30, pd=42;
  const grass=std({color:cm.grass,roughness:1}), dirt=std({color:cm.dirt,roughness:1});
  platGrassMats.push(grass);platDirtMats.push(dirt);
  const slab=new THREE.Mesh(new THREE.BoxGeometry(pw,4,pd),[dirt,dirt,grass,dirt,dirt,dirt]);
  slab.position.set(spanW/2,-2.4,6);slab.receiveShadow=true;cityGroup.add(slab);
  // a slightly smaller darker underslab for a layered/floating look
  const under=new THREE.Mesh(new THREE.BoxGeometry(pw-6,3,pd-6),std({color:0x3a2e24,roughness:1}));under.position.set(spanW/2,-5.4,6);cityGroup.add(under);
  // continuous avenue running past every district
  const road=new THREE.Mesh(new THREE.BoxGeometry(spanW+DGAP+24,0.42,16),std({color:0x44474e,roughness:.98}));road.position.set(spanW/2,-0.34,14);road.receiveShadow=true;cityGroup.add(road);
  for(let x=-12;x<spanW+12;x+=4){const d=new THREE.Mesh(new THREE.BoxGeometry(2,0.02,0.3),std({color:0xF4E3A6,emissive:0xF4E3A6,emissiveIntensity:.4}));d.position.set(x,-0.12,14);cityGroup.add(d);emisMats.push(d.material);}
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
  // greenery + benches along the front sidewalk
  const t1=makeTree();t1.position.set(-baseW/2+0.8,0,4.5);dg.add(t1);
  const t2=makeTree();t2.position.set(baseW/2-0.8,0,4.2);t2.scale.setScalar(0.9);dg.add(t2);
  const bench=makeBench();bench.position.set(-baseW/2+3.4,0,4.7);bench.rotation.y=Math.PI;dg.add(bench);
  [-baseW/2+6,1.5,baseW/2-4].forEach((bx,bi)=>{const bu=makeBush();bu.position.set(bx+bi*0.3,0,4.9);bu.scale.setScalar(0.8+0.3*((bi*7)%3)/2);dg.add(bu);});
  // a few customers strolling the sidewalk
  const nWalk=3;for(let wI=0;wI<nWalk;wI++){const seed=i*5+wI;const p=makePerson(seed);
    const min=-baseW/2+1.6,max=baseW/2-1.6;const px=min+(max-min)*((wI+1)/(nWalk+1));
    p.position.set(px,0,4.6+((wI%2)?0.5:-0.3));dg.add(p);
    walkers.push({m:p,min:min,max:max,x:px,dir:(wI%2?1:-1),sp:0.55+0.25*((seed*3)%4)/3});}
  for(let k=0;k<nl;k++){
    const g=new THREE.Group();g.position.set(plotXd(k,nl),0,0);dg.add(g);
    const rec={group:g,d:i,i:k,building:null,coin:null,coinBaseY:8};
    plots.push(rec);renderPlot(rec);
  }
  makeDecorations(dg,baseW);
}
function makeDecorations(dg,baseW){const D=S.decor||{};
  if(D.planters){for(let k=0;k<3;k++){const px=-baseW/2+3.5+k*(baseW-7)/2;
    dg.add(mesh(new THREE.BoxGeometry(1.3,0.5,0.5),std({color:0x8a5a30,roughness:.9}),px,0.2,5.5));
    for(let f=0;f<3;f++){const col=[0xE05aa0,0xE3242B,0xE6A020,0x8a5aff,0xffffff][(k*3+f)%5];
      dg.add(mesh(new THREE.CylinderGeometry(.03,.03,.22,5),std({color:0x2f7a1a}),px-0.32+f*0.32,0.55,5.5));
      dg.add(mesh(new THREE.SphereGeometry(.13,8,8),std({color:col}),px-0.32+f*0.32,0.68,5.5));}}}
  if(D.lights){const cols=[0xE3242B,0xE6C020,0x2f9e57,0x37A6C9,0xE05aa0];for(let k=0;k<12;k++){const lx=-baseW/2+1+k*(baseW-2)/11;const sag=Math.sin(k/11*Math.PI)*0.5;
    const b=mesh(new THREE.SphereGeometry(0.16,8,8),std({color:cols[k%5],emissive:cols[k%5],emissiveIntensity:1}),lx,6.5-sag,4.7);dg.add(b);emisMats.push(b.material);}}
  if(D.fountain){const fx=baseW/2-2.6;
    dg.add(mesh(new THREE.CylinderGeometry(1.1,1.3,0.5,16),std({color:0x8a8478}),fx,0.25,6.2));
    dg.add(mesh(new THREE.CylinderGeometry(0.9,0.9,0.14,16),std({color:0x6fc0e0,emissive:0x2a6a9a,emissiveIntensity:.35,transparent:true,opacity:.85}),fx,0.55,6.2));
    dg.add(mesh(new THREE.CylinderGeometry(0.4,0.55,0.8,12),std({color:0x9a948a}),fx,0.8,6.2));
    dg.add(mesh(new THREE.SphereGeometry(0.22,10,10),std({color:0x9fdcff,emissive:0x5fbfff,emissiveIntensity:.5}),fx,1.35,6.2));}
  if(D.banner){const nm=(S.cityName||'MY BLOCK').toUpperCase();const c=document.createElement('canvas');c.width=512;c.height=104;const x=c.getContext('2d');
    x.fillStyle='#B0122a';rr(x,4,4,504,96,12);x.fill();x.strokeStyle='#F4E3A6';x.lineWidth=6;rr(x,4,4,504,96,12);x.stroke();
    x.fillStyle='#fff7d8';x.font='800 46px Georgia';x.textAlign='center';x.textBaseline='middle';x.fillText(nm,256,54);
    const t=new THREE.CanvasTexture(c);const m=std({map:t,emissiveMap:t,emissive:0xffffff,emissiveIntensity:.5,transparent:true});
    dg.add(mesh(new THREE.PlaneGeometry(baseW*0.78,baseW*0.78*104/512),m,0,7.7,3.2));emisMats.push(m);}
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
/* ---- decorative props: trees, bushes, benches, customers ---- */
function makeTree(){const g=new THREE.Group();
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.16,.22,1.3,7),std({color:0x6b4a2e,roughness:1}));trunk.position.y=0.65;trunk.castShadow=true;g.add(trunk);
  const f1=new THREE.Mesh(new THREE.IcosahedronGeometry(.95,0),std({color:0x4f9e3a,roughness:1,flatShading:true}));f1.position.y=1.75;f1.castShadow=true;g.add(f1);
  const f2=new THREE.Mesh(new THREE.IcosahedronGeometry(.62,0),std({color:0x62b84a,roughness:1,flatShading:true}));f2.position.set(.25,2.35,.1);g.add(f2);
  return g;}
function makeBush(){const m=new THREE.Mesh(new THREE.IcosahedronGeometry(.5,0),std({color:0x53a63c,roughness:1,flatShading:true}));m.scale.y=0.72;m.position.y=0.32;m.castShadow=true;return m;}
function makeBench(){const g=new THREE.Group();const wood=std({color:0x8a5a30,roughness:.9});
  const seat=new THREE.Mesh(new THREE.BoxGeometry(1.5,.12,.5),wood);seat.position.y=.52;g.add(seat);
  const back=new THREE.Mesh(new THREE.BoxGeometry(1.5,.46,.12),wood);back.position.set(0,.78,-.2);g.add(back);
  [-.62,.62].forEach(x=>{const leg=new THREE.Mesh(new THREE.BoxGeometry(.12,.52,.44),std({color:0x4a3420}));leg.position.set(x,.26,0);g.add(leg);});
  return g;}
const SHIRTS=[0xE3242B,0x2f9e57,0x37A6C9,0xE6A020,0x8a5aff,0xE05aa0,0xF4E3A6,0x4f9e3a];
function makePerson(seed){const g=new THREE.Group();const col=SHIRTS[seed%SHIRTS.length];
  const legs=new THREE.Mesh(new THREE.BoxGeometry(.3,.5,.26),std({color:0x30364a}));legs.position.y=.26;g.add(legs);
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.21,.26,.62,8),std({color:col,roughness:.9}));body.position.y=.8;body.castShadow=true;g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.2,10,10),std({color:0xf0c69a}));head.position.y=1.22;g.add(head);
  return g;}
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
  // event bubble (rush / tip / restock) — hidden until an event fires
  const em=new THREE.SpriteMaterial({map:coinTex(0),transparent:true,depthTest:false});const esp=new THREE.Sprite(em);esp.scale.set(2.7,1.2,1);esp.position.set(0,h+3.4,0.4);esp.visible=false;esp.userData={rec};g.add(esp);clickable.push(esp);
  rec.evSprite=esp;rec.evBaseY=h+3.4;updateEventSprite(rec);
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
let interiorGroup=null, insideRec=null, intAngle=0, intDist=12.5; const intClickable=[];
function updateCam(){const cz=6, fx=focusX;
  camera.position.set(fx+Math.sin(camAngle)*camDist, camH, Math.cos(camAngle)*camDist + cz);
  camera.lookAt(fx,3.2,0);
  if(sky)sky.position.x=fx; if(starPts)starPts.position.x=fx; if(moon)moon.position.x=fx-70;}
function travelTo(i){if(i<0||i>=S.districts.length)return;S.district=i;focusXTarget=districtX(i);traveling=true;updateDistrictUI();saveSoon();}
function autoMode(){const h=new Date().getHours();return (h>=6&&h<20)?'day':((h>=20&&h<22)||(h>=5&&h<6)?'dusk':'night');}
function applyMode(m){mode=m;const c=S3[m];
  sky.material.map=skyTex(c.sky[0],c.sky[1]);sky.material.needsUpdate=true;
  hemi.intensity=c.amb;sun.intensity=c.sun;
  starPts.material.opacity=c.star;moon.visible=c.star>0.2;
  emisMats.forEach(mm=>{mm.emissiveIntensity=(mm.map&&mm.emissiveMap)?Math.max(.5,c.emis):c.emis;});
  lamps.forEach(L=>L.intensity=(m==='day')?0:(m==='dusk')?.5:1);
  if(scene.fog){scene.fog.color.setHex(c.fog);}
  platGrassMats.forEach(mm=>mm.color.setHex(c.grass));
  platDirtMats.forEach(mm=>mm.color.setHex(c.dirt));
  document.body.classList.toggle('day',m==='day');
}
let platGrassMats=[],platDirtMats=[];

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
     '<button class="bg3-chip bg3-dchip" id="bg3goals" title="Daily goals">🎯<span class="bg3-badge" id="bg3goalsbadge">0</span></button>'+
     '<button class="bg3-chip bg3-dchip" id="bg3spin" title="Daily spin">🎡</button>'+
     '<button class="bg3-chip bg3-dchip" id="bg3slots" title="Lucky Slots">🎰<b id="bg3energy" style="margin-left:2px;font-size:12px">30</b></button>'+
     '<button class="bg3-chip bg3-dchip" id="bg3myblock" title="My city">🎨</button>'+
     '<div class="bg3-lvl"><div class="bg3-lvlrow"><span id="bg3lvl">Lvl 1</span><span id="bg3xp">0/50 XP</span></div><div class="bg3-bar"><i id="bg3xpbar"></i></div></div>'+
     '<button class="bg3-icon" id="bg3help" title="How to play">?</button>'+
     '<button class="bg3-icon" id="bg3fs" title="Fullscreen">⤢</button>'+
   '</div>'+
   '<div class="bg3-travel"><button class="bg3-nav" id="bg3prev" title="Previous district">‹</button>'+
     '<div class="bg3-dname" id="bg3dname">Founders Row</div>'+
     '<button class="bg3-nav" id="bg3next" title="Next district">›</button></div>'+
   '<button class="bg3-event" id="bg3event"><b>🎪 Event</b><i>ends —</i></button>'+
   '<div class="bg3-lucky" id="bg3lucky"><b>✨ ×2</b></div>'+
   '<div class="bg3-toast" id="bg3toast"></div>'+
   '<div class="bg3-modal" id="bg3modal"><div class="bg3-box"><button class="bg3-x" id="bg3x">✕</button><div id="bg3modalbody"></div></div></div>'+
   '<div class="bg3-tour" id="bg3tour"><div class="bg3-spot" id="bg3spot"></div>'+
     '<div class="bg3-tourcard" id="bg3tcard"><div class="tt"></div><div class="tb"></div>'+
       '<div class="trow"><span class="tstep"></span><span class="tbtns"><button class="tskip">Skip</button><button class="tback">Back</button><button class="tnext">Next</button></span></div></div></div>'+
   '<div class="bg3-store" id="bg3store"><div class="bg3-storebar"><button class="bg3-back" id="bg3exit">‹ Back to street</button><div class="bg3-storetitle" id="bg3storetitle"></div></div>'+
     '<div class="bg3-combo" id="bg3combo"></div>'+
     '<div class="bg3-servehud"><div class="bg3-servehint">🛎️ Tap to serve — keep the line moving for combos!</div><div class="bg3-servecount">Served today <b id="bg3served">0</b></div><button class="bg3-mbtn" id="bg3manage">⚙ Manage</button></div></div>'+
   '<div class="bg3-fade" id="bg3fade"></div>';
  host.innerHTML='';host.appendChild(wrap);
  ui.wrap=wrap;ui.canvaswrap=wrap.querySelector('.bg3-canvaswrap');
  ui.coins=wrap.querySelector('#bg3coins b');ui.streak=wrap.querySelector('#bg3streak b');
  ui.lvl=wrap.querySelector('#bg3lvl');ui.xp=wrap.querySelector('#bg3xp');ui.xpbar=wrap.querySelector('#bg3xpbar');
  ui.toast=wrap.querySelector('#bg3toast');ui.modal=wrap.querySelector('#bg3modal');ui.modalbody=wrap.querySelector('#bg3modalbody');
  ui.dname=wrap.querySelector('#bg3dname');ui.prev=wrap.querySelector('#bg3prev');ui.next=wrap.querySelector('#bg3next');
  ui.rank=wrap.querySelector('#bg3rank');ui.lucky=wrap.querySelector('#bg3lucky');ui.event=wrap.querySelector('#bg3event');
  ui.event.onclick=openEvent;
  ui.canvaswrap.appendChild(cv);
  ui.tour=wrap.querySelector('#bg3tour');ui.tourSpot=wrap.querySelector('#bg3spot');ui.tourCard=wrap.querySelector('#bg3tcard');
  ui.store=wrap.querySelector('#bg3store');ui.storeTitle=wrap.querySelector('#bg3storetitle');ui.served=wrap.querySelector('#bg3served');ui.combo=wrap.querySelector('#bg3combo');ui.fade=wrap.querySelector('#bg3fade');
  wrap.querySelector('#bg3exit').onclick=exitStore;
  wrap.querySelector('#bg3manage').onclick=()=>{if(insideRec)openStoreManage(insideRec);};
  ui.goalsBadge=wrap.querySelector('#bg3goalsbadge');ui.spinBtn=wrap.querySelector('#bg3spin');
  wrap.querySelector('#bg3rivals').onclick=openRivals;
  wrap.querySelector('#bg3goals').onclick=openGoals;
  ui.slotEnergy=wrap.querySelector('#bg3energy');ui.slotBtn=wrap.querySelector('#bg3slots');
  wrap.querySelector('#bg3spin').onclick=openSpin;
  wrap.querySelector('#bg3slots').onclick=openSlots;
  wrap.querySelector('#bg3myblock').onclick=openMyBlock;
  wrap.querySelector('#bg3help').onclick=startTour;
  ui.tourCard.querySelector('.tnext').onclick=()=>tourStep(tourIdx+1);
  ui.tourCard.querySelector('.tback').onclick=()=>tourStep(tourIdx-1);
  ui.tourCard.querySelector('.tskip').onclick=()=>endTour(true);
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
.bg3-chip{pointer-events:auto;display:flex;align-items:center;gap:6px;background:linear-gradient(180deg,#fffdf6,#f0e6cf);color:#233; border:2px solid #e0be5e;border-radius:22px;padding:6px 14px;font-size:15px;font-weight:800;box-shadow:0 3px 0 rgba(120,90,30,.35),0 4px 8px rgba(0,0,0,.18)}
.bg3-chip b{color:#1e2a1e}
.bg3-ycoin{width:18px;height:18px;border-radius:50%;background:radial-gradient(circle at 34% 30%,#fff7d8,#F4E3A6 40%,#c9a84a);border:1px solid #a5822f;position:relative}
.bg3-ycoin::after{content:"Y";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 10px Georgia;color:#8a6a1f}
.bg3-lvl{pointer-events:auto;flex:1;min-width:130px;max-width:300px;background:linear-gradient(180deg,#fffdf6,#f0e6cf);border:2px solid #e0be5e;border-radius:16px;padding:5px 12px;box-shadow:0 3px 0 rgba(120,90,30,.3),0 4px 8px rgba(0,0,0,.16)}
.bg3-lvlrow{display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:#5a5240}
.bg3-bar{height:7px;background:rgba(90,70,30,.2);border-radius:6px;margin-top:3px;overflow:hidden}
.bg3-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#8ede4a,#4fae2a);border-radius:6px;transition:width .3s}
.bg3-icon{pointer-events:auto;background:linear-gradient(180deg,#fffdf6,#f0e6cf);border:2px solid #e0be5e;color:#4a3a10;border-radius:13px;width:36px;height:36px;font-size:16px;cursor:pointer;box-shadow:0 3px 0 rgba(120,90,30,.3)}
.bg3-fly{position:absolute;width:16px;height:16px;border-radius:50%;background:radial-gradient(circle at 34% 30%,#fff7d8,#F4E3A6 45%,#c9a84a);border:1px solid #a5822f;box-shadow:0 1px 3px rgba(0,0,0,.4);z-index:9;pointer-events:none;transition:transform .18s ease-out}
.bg3-confetti{position:absolute;width:9px;height:14px;border-radius:2px;z-index:14;pointer-events:none;opacity:1;transition:transform 1.25s cubic-bezier(.2,.6,.3,1),opacity 1.25s}
#bg3coins.bump{animation:bg3bump .35s ease}
@keyframes bg3bump{0%,100%{transform:scale(1)}42%{transform:scale(1.2)}}
.bg3-toast{position:absolute;left:50%;bottom:62px;transform:translateX(-50%);background:rgba(8,11,9,.86);border:1px solid rgba(227,192,90,.35);color:#F5F1E6;font-size:13px;padding:9px 16px;border-radius:20px;opacity:0;transition:opacity .3s,transform .3s;z-index:8;pointer-events:none;white-space:nowrap}
.bg3-toast.on{opacity:1;transform:translateX(-50%) translateY(-4px)}
.bg3-travel{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:6px;z-index:6;background:linear-gradient(180deg,#fffdf6,#efe4cb);border:2px solid #e0be5e;border-radius:24px;padding:5px 8px;box-shadow:0 3px 0 rgba(120,90,30,.3),0 5px 12px rgba(0,0,0,.22)}
.bg3-nav{background:linear-gradient(180deg,#F4D06A,#C89A34);border:none;color:#3a2a06;width:32px;height:32px;border-radius:50%;font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 0 #8a6a2a}
.bg3-nav.plus{color:#2a5a1e}
.bg3-nav:disabled{opacity:.4;cursor:not-allowed;box-shadow:none}
.bg3-dname{font-size:12.5px;font-weight:800;min-width:168px;text-align:center;color:#3a3020}
.bg3-event{position:absolute;top:54px;left:50%;transform:translateX(-50%);z-index:6;display:flex;align-items:center;gap:7px;pointer-events:auto;cursor:pointer;background:linear-gradient(180deg,#E05aa0,#a83a78);color:#fff;border:2px solid #ffd0ea;font-weight:800;font-size:12.5px;padding:5px 14px;border-radius:20px;box-shadow:0 4px 14px rgba(0,0,0,.4)}
.bg3-event i{font-style:normal;font-weight:600;font-size:11px;opacity:.9}
.bg3-event.ready{animation:bg3pulse2 1.2s ease-in-out infinite}
.bg3-lucky{position:absolute;top:92px;left:50%;transform:translateX(-50%);z-index:6;display:none;align-items:center;background:linear-gradient(180deg,rgba(227,192,90,.95),rgba(176,134,47,.95));color:#14231a;font-weight:800;font-size:13px;padding:5px 14px;border-radius:20px;box-shadow:0 4px 14px rgba(0,0,0,.4);animation:bg3pulse 1.4s ease-in-out infinite}
.bg3-etiers{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.bg3-etier{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:9px 12px}
.bg3-etier.reached{border-color:rgba(122,208,58,.4);background:rgba(122,208,58,.08)}
.bg3-etier .et-l{flex:1;min-width:0}
.bg3-etier .et-pts{font-size:13px;font-weight:700;color:#F5F1E6}
.bg3-etier .et-bar{height:6px;background:rgba(255,255,255,.12);border-radius:5px;margin-top:5px;overflow:hidden}
.bg3-etier .et-bar i{display:block;height:100%;background:linear-gradient(90deg,#E05aa0,#a83a78);border-radius:5px}
.bg3-etier .et-r{font-size:13px;font-weight:800;color:#E3C05A;display:flex;align-items:center;gap:8px;white-space:nowrap}
.bg3-etier .et-claim{background:linear-gradient(180deg,#7ad03a,#4fae2a);color:#0c1a08;border:none;border-radius:8px;padding:5px 12px;font-weight:800;font-size:12px;cursor:pointer;box-shadow:0 2px 0 #2f7a1a}
.bg3-etier .et-claimed{color:#7ad03a}.bg3-etier .et-lock{opacity:.5}
@keyframes bg3pulse{0%,100%{transform:translateX(-50%) scale(1)}50%{transform:translateX(-50%) scale(1.06)}}
.bg3-modal{position:absolute;inset:0;z-index:10;display:none;align-items:center;justify-content:center;background:rgba(4,6,9,.6);backdrop-filter:blur(3px);padding:16px}
.bg3-modal.on{display:flex}
.bg3-box{position:relative;width:100%;max-width:420px;background:linear-gradient(160deg,#1a2620,#0d1510);border:2px solid rgba(227,192,90,.55);border-radius:20px;padding:22px;box-shadow:0 18px 50px rgba(0,0,0,.55)}
.bg3-x{position:absolute;top:10px;right:12px;background:none;border:none;color:#9AA79A;font-size:19px;cursor:pointer}
.bg3-box h3{font-family:Georgia,serif;font-size:20px;margin-bottom:4px}
.bg3-box p{font-size:13px;color:#cdd6cd;margin-bottom:12px}
.bg3-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.bg3-cell{background:rgba(255,255,255,.05);border:1px solid rgba(227,192,90,.25);border-radius:12px;padding:9px 4px;text-align:center;cursor:pointer;transition:transform .1s}
.bg3-cell:active{transform:scale(.95)}
.bg3-cell.lock{opacity:.4;cursor:not-allowed}
.bg3-cell .e{font-size:26px}.bg3-cell .n{font-size:10.5px;color:#cdd6cd;margin-top:2px}
.bg3-btn{width:100%;margin-top:12px;background:linear-gradient(180deg,#F4D06A,#C89A34);color:#3a2a06;border:none;border-radius:13px;padding:13px;font-weight:800;font-size:14.5px;cursor:pointer;box-shadow:0 4px 0 #8a6a2a,0 6px 12px rgba(0,0,0,.3);transition:transform .08s,box-shadow .08s}
.bg3-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #8a6a2a,0 2px 6px rgba(0,0,0,.3)}
.bg3-btn:disabled{filter:grayscale(.6);opacity:.55;cursor:not-allowed;box-shadow:0 4px 0 rgba(0,0,0,.25)}
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
.bg3-tour{position:absolute;inset:0;z-index:20;display:none}
.bg3-tour.on{display:block}
.bg3-spot{position:absolute;border-radius:14px;box-shadow:0 0 0 4px rgba(227,192,90,.95),0 0 0 9999px rgba(6,10,8,.72);transition:left .3s ease,top .3s ease,width .3s ease,height .3s ease;pointer-events:none}
.bg3-tourcard{position:absolute;z-index:21;background:linear-gradient(160deg,#fffdf6,#f0e6cf);color:#2a2418;border:2px solid #e0be5e;border-radius:16px;padding:14px 16px;box-shadow:0 12px 34px rgba(0,0,0,.5);transition:left .3s ease,top .3s ease}
.bg3-tourcard .tt{font-family:Georgia,serif;font-weight:800;font-size:16px;margin-bottom:5px;color:#1e2a12}
.bg3-tourcard .tb{font-size:13px;line-height:1.45;color:#4a4230}
.bg3-tourcard .trow{display:flex;align-items:center;justify-content:space-between;margin-top:12px;gap:8px}
.bg3-tourcard .tstep{font-size:11px;color:#9a8a5a;font-weight:700;white-space:nowrap}
.bg3-tourcard .tbtns{display:flex;gap:6px}
.bg3-tourcard button{border:none;border-radius:9px;padding:7px 12px;font-weight:800;font-size:12.5px;cursor:pointer}
.bg3-tourcard .tskip{background:transparent;color:#9a8a5a}
.bg3-tourcard .tback{background:#e7dcc2;color:#5a5038}
.bg3-tourcard .tnext{background:linear-gradient(180deg,#F4D06A,#C89A34);color:#3a2a06;box-shadow:0 3px 0 #8a6a2a}
.bg3-store{position:absolute;inset:0;z-index:15;display:none;pointer-events:none}
.bg3-store.on{display:block}
.bg3-storebar{position:absolute;top:10px;left:10px;right:10px;display:flex;align-items:center;gap:10px;pointer-events:none}
.bg3-back{pointer-events:auto;background:linear-gradient(180deg,#fffdf6,#efe4cb);border:2px solid #e0be5e;color:#3a2a06;font-weight:800;border-radius:20px;padding:8px 14px;font-size:13px;cursor:pointer;box-shadow:0 3px 0 rgba(120,90,30,.3)}
.bg3-storetitle{pointer-events:auto;background:rgba(8,11,9,.6);backdrop-filter:blur(6px);border:2px solid rgba(227,192,90,.4);color:#F5F1E6;font-family:Georgia,serif;font-weight:800;font-size:15px;border-radius:16px;padding:6px 14px}
.bg3-servehud{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:flex;align-items:center;gap:10px;pointer-events:none;flex-wrap:wrap;justify-content:center;max-width:calc(100% - 20px)}
.bg3-servehint{pointer-events:none;background:rgba(8,11,9,.7);backdrop-filter:blur(5px);border:1px solid rgba(227,192,90,.35);color:#F5F1E6;font-size:13px;font-weight:700;border-radius:20px;padding:8px 15px}
.bg3-servecount{pointer-events:none;background:linear-gradient(180deg,#fffdf6,#f0e6cf);border:2px solid #e0be5e;color:#233;font-size:13px;font-weight:800;border-radius:20px;padding:6px 13px;box-shadow:0 3px 0 rgba(120,90,30,.3)}
.bg3-servecount b{color:#2a5a1e}
.bg3-mbtn{pointer-events:auto;background:linear-gradient(180deg,#fffdf6,#efe4cb);border:2px solid #e0be5e;color:#3a2a06;font-weight:800;border-radius:20px;padding:8px 15px;font-size:13px;cursor:pointer;box-shadow:0 3px 0 rgba(120,90,30,.3)}
.bg3-link{width:100%;background:none;border:none;color:#9AA79A;font-size:12px;font-weight:700;cursor:pointer;padding:7px 0 2px;text-align:center}
.bg3-float{position:absolute;z-index:9;pointer-events:none;color:#7ad03a;font-weight:800;font-size:18px;text-shadow:0 1px 3px rgba(0,0,0,.6);transform:translate(-50%,0);transition:transform .8s ease-out,opacity .8s ease-out}
.bg3-inside .bg3-travel{display:none}
.bg3-heart{position:absolute;z-index:9;pointer-events:none;font-size:18px;transform:translate(-50%,0);transition:transform .7s ease-out,opacity .7s ease-out}
.bg3-combo{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%) scale(.6);z-index:10;pointer-events:none;font-family:Georgia,serif;font-weight:800;font-size:30px;color:#fff;text-shadow:0 2px 0 #E3242B,0 3px 8px rgba(0,0,0,.6);opacity:0;transition:opacity .2s}
.bg3-combo.on{opacity:1}
.bg3-combo.pop{animation:bg3combopop .5s ease-out}
@keyframes bg3combopop{0%{transform:translate(-50%,-50%) scale(.5) rotate(-6deg)}50%{transform:translate(-50%,-50%) scale(1.25) rotate(3deg)}100%{transform:translate(-50%,-50%) scale(1) rotate(0)}}
.bg3-dchip{position:relative;cursor:pointer;padding:6px 11px;font-size:16px}
.bg3-badge{position:absolute;top:-5px;right:-5px;min-width:17px;height:17px;padding:0 4px;background:#E3242B;color:#fff;border-radius:9px;font-size:11px;font-weight:800;display:none;align-items:center;justify-content:center;border:1.5px solid #fffdf6}
#bg3spin.avail,#bg3slots.avail{animation:bg3pulse2 1.3s ease-in-out infinite}
.bg3-reels{display:flex;gap:10px;justify-content:center;margin:12px 0}
.bg3-reel{width:74px;height:74px;display:flex;align-items:center;justify-content:center;font-size:40px;background:linear-gradient(180deg,#fffdf6,#e7dcc2);border:3px solid #e0be5e;border-radius:14px;box-shadow:inset 0 -4px 8px rgba(0,0,0,.15),0 4px 10px rgba(0,0,0,.35)}
.bg3-reel.land{animation:bg3reelland .25s ease-out}
@keyframes bg3reelland{0%{transform:translateY(-8px) scale(1.1)}100%{transform:translateY(0) scale(1)}}
.bg3-slotmsg{text-align:center;font-size:14px;font-weight:700;color:#F5F1E6;min-height:20px;margin-bottom:4px}
@keyframes bg3pulse2{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
.bg3-goals{display:flex;flex-direction:column;gap:9px;margin-top:6px}
.bg3-goal{background:rgba(255,255,255,.05);border:1px solid rgba(227,192,90,.25);border-radius:12px;padding:10px 12px}
.bg3-goal .gtop{display:flex;justify-content:space-between;font-size:13.5px;font-weight:700}
.bg3-goal .gr{color:#E3C05A}
.bg3-goal .gbar{height:8px;background:rgba(255,255,255,.12);border-radius:6px;margin:7px 0 5px;overflow:hidden}
.bg3-goal .gbar i{display:block;height:100%;background:linear-gradient(90deg,#8ede4a,#4fae2a);border-radius:6px}
.bg3-goal .gbot{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#9AA79A}
.bg3-goal .gclaim{background:linear-gradient(180deg,#7ad03a,#4fae2a);color:#0c1a08;border:none;border-radius:8px;padding:5px 14px;font-weight:800;font-size:12px;cursor:pointer;box-shadow:0 2px 0 #2f7a1a}
.bg3-goal .gdone{color:#7ad03a;font-weight:800}
.bg3-wheelwrap{position:relative;width:180px;height:180px;margin:6px auto 12px}
.bg3-wheel{position:absolute;inset:0;border-radius:50%;border:5px solid #fffdf6;box-shadow:0 8px 24px rgba(0,0,0,.5),inset 0 0 0 3px rgba(0,0,0,.2);transform:rotate(0deg)}
.bg3-wlabel{position:absolute;left:50%;top:50%;font-size:12px;font-weight:800;color:#14231a;text-shadow:0 1px 1px rgba(255,255,255,.4);white-space:nowrap}
.bg3-wpin{position:absolute;top:-10px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:11px solid transparent;border-right:11px solid transparent;border-top:20px solid #fffdf6;z-index:3;filter:drop-shadow(0 2px 2px rgba(0,0,0,.5))}
.bg3-sec{font-size:12px;font-weight:800;color:#9AA79A;text-transform:uppercase;letter-spacing:.03em;margin:12px 0 7px;overflow:hidden}
.bg3-decor{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.bg3-dcell{background:rgba(255,255,255,.05);border:1px solid rgba(227,192,90,.25);border-radius:12px;padding:9px;text-align:center}
.bg3-dcell.owned{border-color:rgba(122,208,58,.5);background:rgba(122,208,58,.08)}
.bg3-dcell .e{font-size:24px}.bg3-dcell .n{font-size:11.5px;color:#cdd6cd;margin:3px 0 6px}
.bg3-dbuy{background:linear-gradient(180deg,#F4D06A,#C89A34);color:#3a2a06;border:none;border-radius:8px;padding:5px 12px;font-weight:800;font-size:12px;cursor:pointer;box-shadow:0 2px 0 #8a6a2a}
.bg3-dbuy:disabled{filter:grayscale(.6);opacity:.55;cursor:not-allowed}
.bg3-dcell .own{color:#7ad03a;font-weight:800;font-size:12px}
.bg3-collect{display:grid;grid-template-columns:repeat(8,1fr);gap:6px}
.bg3-ccell{aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;opacity:.5}
.bg3-ccell.got{opacity:1;background:rgba(227,192,90,.15);border-color:rgba(227,192,90,.45)}
.bg3-career{display:flex;align-items:center;gap:12px;background:linear-gradient(120deg,rgba(227,192,90,.18),rgba(227,192,90,.06));border:1px solid rgba(227,192,90,.4);border-radius:14px;padding:11px 13px;margin:8px 0 4px}
.bg3-career .cr-ic{font-size:34px;line-height:1}
.bg3-career .cr-mid{flex:1;min-width:0}
.bg3-career .cr-name{font-family:Georgia,serif;font-weight:800;font-size:17px;color:#F5F1E6}
.bg3-career .cr-bar{height:8px;background:rgba(255,255,255,.12);border-radius:6px;margin:5px 0 4px;overflow:hidden}
.bg3-career .cr-bar i{display:block;height:100%;background:linear-gradient(90deg,#F4D06A,#C89A34);border-radius:6px}
.bg3-career .cr-next{font-size:11px;color:#cdd6cd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bg3-fade{position:absolute;inset:0;z-index:30;background:#0a0f0c;opacity:0;pointer-events:none;transition:opacity .24s ease}
.bg3-fade.on{opacity:1}
`;document.head.appendChild(s);}

let shownCoins=0;
const _wv=(typeof THREE!=='undefined')?new THREE.Vector3():null;
function worldToScreen(obj){if(!_wv)return{x:0,y:0};obj.getWorldPosition(_wv);_wv.project(camera);const r=cv.getBoundingClientRect();const wr=ui.wrap.getBoundingClientRect();return {x:(_wv.x*.5+.5)*r.width+(r.left-wr.left),y:(-_wv.y*.5+.5)*r.height+(r.top-wr.top)};}
function flyCoins(fromObj){if(!fromObj||!ui.wrap)return;const p=worldToScreen(fromObj);const chip=ui.wrap.querySelector('#bg3coins');if(!chip)return;const wr=ui.wrap.getBoundingClientRect();const cr=chip.getBoundingClientRect();const tx=cr.left-wr.left+cr.width/2,ty=cr.top-wr.top+cr.height/2;
  for(let i=0;i<7;i++){const d=document.createElement('div');d.className='bg3-fly';d.style.left=p.x+'px';d.style.top=p.y+'px';ui.wrap.appendChild(d);
    const jx=(Math.random()-.5)*42,jy=(Math.random()-.5)*30;
    requestAnimationFrame(()=>{d.style.transform='translate('+jx+'px,'+jy+'px)';setTimeout(()=>{d.style.transition='transform .5s cubic-bezier(.5,-0.2,.4,1),opacity .5s';d.style.transform='translate('+(tx-p.x)+'px,'+(ty-p.y)+'px) scale(.4)';d.style.opacity='0';},60+i*38);});
    setTimeout(()=>d.remove(),820+i*38);}
  chip.classList.remove('bump');void chip.offsetWidth;chip.classList.add('bump');}
function confettiBurst(){if(!ui.wrap)return;const cols=['#E3242B','#E6A020','#2f9e57','#37A6C9','#8a5aff','#F4E3A6'];const wr=ui.wrap.getBoundingClientRect();
  for(let i=0;i<28;i++){const d=document.createElement('div');d.className='bg3-confetti';d.style.background=cols[i%cols.length];d.style.left=(wr.width/2)+'px';d.style.top='44px';ui.wrap.appendChild(d);
    const ang=Math.random()*Math.PI*2,dist=70+Math.random()*180;const tx=Math.cos(ang)*dist,ty=Math.abs(Math.sin(ang))*dist+130;
    requestAnimationFrame(()=>{d.style.transform='translate('+tx+'px,'+ty+'px) rotate('+(Math.random()*720-360)+'deg)';d.style.opacity='0';});
    setTimeout(()=>d.remove(),1350);}}
function refreshUI(){
  ui.streak.textContent=S.streak||0;
  ui.lvl.textContent='Lvl '+S.level;
  const need=LEVEL_XP(S.level);ui.xp.textContent=Math.floor(S.xp)+'/'+need+' XP';
  ui.xpbar.style.width=Math.min(100,(S.xp/need)*100)+'%';
  if(ui.rank){const pw=playerWorth();let above=0;RIVALS.forEach(r=>{if(rivalWorth(r)>pw)above++;});ui.rank.textContent='#'+(above+1);}
  if(typeof checkRank==='function')checkRank();
}
let toastT;
function toast(msg){ui.toast.textContent=msg;ui.toast.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>ui.toast.classList.remove('on'),2000);}
function openModal(html){ui.modalbody.innerHTML=html;ui.modal.classList.add('on');}
function closeModal(){ui.modal.classList.remove('on');}

/* ---------------- interactions ---------------- */
const ray=new THREE.Raycaster();let dragId=null,dragX=0,moved=0,downX=0,downY=0;
function bindInput(){
  cv.addEventListener('pointerdown',e=>{dragId=e.pointerId;dragX=e.clientX;downX=e.clientX;downY=e.clientY;moved=0;});
  cv.addEventListener('pointermove',e=>{if(e.pointerId!==dragId)return;const dx=e.clientX-dragX;
    if(insideRec){intAngle=Math.max(-0.6,Math.min(0.6,intAngle-dx*0.005));updateIntCam();}
    else{camAngle=Math.max(-0.9,Math.min(0.9,camAngle-dx*0.006));updateCam();}
    dragX=e.clientX;moved+=Math.abs(dx);});
  cv.addEventListener('pointerup',e=>{if(e.pointerId!==dragId)return;if(moved<6&&Math.hypot(e.clientX-downX,e.clientY-downY)<8)tap(e.clientX,e.clientY);dragId=null;});
  cv.addEventListener('wheel',e=>{if(insideRec){intDist=Math.max(9,Math.min(18,intDist+Math.sign(e.deltaY)*1.1));updateIntCam();}else{camDist=Math.max(13,Math.min(30,camDist+Math.sign(e.deltaY)*1.4));updateCam();}e.preventDefault();},{passive:false});
}
function tap(cx,cy){const r=cv.getBoundingClientRect();const ndc=new THREE.Vector2(((cx-r.left)/r.width)*2-1,-((cy-r.top)/r.height)*2+1);
  ray.setFromCamera(ndc,camera);
  if(insideRec){const ih=ray.intersectObjects(intClickable,true);let station=null;if(ih.length){let o=ih[0].object;while(o&&!(o.userData&&o.userData.station))o=o.parent;if(o)station=o.userData.station;}
    if(station==='register'){collect(insideRec);updateIntCoin(insideRec);}
    else if(station==='equip'){openStoreManage(insideRec);}
    else {serveFront();} // tap the customer, the counter, or anywhere -> serve the next one
    return;}
  const hits=ray.intersectObjects(clickable,false);if(!hits.length)return;
  const obj=hits[0].object;let o=obj;while(o&&!(o.userData&&o.userData.rec))o=o.parent;if(!o)return;const rec=o.userData.rec;const lot=lotOf(rec);
  ensureDaily();
  if(rec.d!==S.district) travelTo(rec.d); // clicked a shop in another district — go there
  if(!lot.built){ openBuild(rec); return; }
  // tap an event bubble: rush -> collect the boosted earnings; tip/restock -> claim the bonus
  if(rec.evSprite && obj===rec.evSprite && lot.ev && (lot.ev.until||0)>Date.now()){
    if(lot.ev.type==='rush'){ if(Math.floor(lot.stock||0)>=1){collect(rec);return;} openStore(rec); return; }
    claimEvent(rec); return;
  }
  // tap the coin bubble to quick-collect; tap the building to step inside
  if(rec.coin && obj===rec.coin && !lot.broke && Math.floor(lot.stock||0)>=1){ collect(rec); return; }
  enterStore(rec);
}
function collect(rec){const lot=lotOf(rec);const amt=Math.floor(lot.stock||0);if(amt<1)return;
  lot.stock-=amt;S.coins+=amt;S.earnedToday=(S.earnedToday||0)+amt;S.collectsToday=(S.collectsToday||0)+1;addEventPoints(1);gainXP(amt);flyCoin(rec);flyCoins((insideRec===rec&&rec.intCoin)?rec.intCoin:rec.coin);toast('+'+amt+' Y');refreshUI();saveSoon();updateCoin(rec);if(insideRec===rec)updateIntCoin(rec);refreshDailyBadges();}
function flyCoin(rec){ if(rec.coin){rec.coin.scale.set(3.2,1.7,1);setTimeout(()=>{if(rec.coin)rec.coin.scale.set(2.6,1.32,1);},130);} }
function gainXP(n){S.xp+=n;let lvlup=false;while(S.xp>=LEVEL_XP(S.level)){S.xp-=LEVEL_XP(S.level);S.level++;lvlup=true;}if(lvlup){toast('🎉 Level up! Lvl '+S.level);confettiBurst();}}
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
function lotBuild(rec,type){const lot=lotOf(rec);lot.built=true;lot.unlocked=true;lot.type=type;lot.name=TYPES[type].name;lot.lvl=1;lot.stock=0;lot.t=Date.now();lot.cond=100;lot.broke=false;lot.rev=0;lot.exp=0;
  if(!S.collected)S.collected=[];if(S.collected.indexOf(type)<0){S.collected.push(type);toast('🎉 New shop collected: '+TYPES[type].name+'!');}
  renderPlot(rec);applyMode(mode);}
/* ---- inside the store: 3D interior + docked management panel ---- */
function storeTopHTML(rec){const lot=lotOf(rec);const em=eventMult(lot);
  const gMin=grossPerMin(lot)*condMult(lot)*em, netMin=Math.max(0,gMin-gMin*SUPPLY_RATE-(gMin>0?rentPerMin(lot):0));
  const cond=Math.round(condOf(lot)), cc=lot.broke?'#ff6a5a':cond>=COND_WARN?'#7ad03a':cond>=COND_LOW?'#E3C05A':'#ff9a4a', cl=lot.broke?'BROKEN':cond>=COND_WARN?'Good':cond>=COND_LOW?'Worn':'Failing';
  const stock=Math.floor(lot.stock||0);
  let h='';
  if(em>1)h+='<div style="background:rgba(227,192,90,.16);border:1px solid rgba(227,192,90,.4);border-radius:8px;padding:5px 10px;margin-bottom:7px;font-size:12px;color:#E3C05A;font-weight:700">'+(lot.ev&&lot.ev.type==='rush'?'🎉 Customer rush':'✨ Lucky Hour')+' — earning ×'+em+'!</div>';
  h+='<div style="display:flex;align-items:center;gap:8px;margin:0 0 7px"><span style="font-size:11px;color:#9AA79A">Equipment</span><div style="flex:1;height:9px;background:rgba(255,255,255,.12);border-radius:6px;overflow:hidden"><i style="display:block;height:100%;width:'+(lot.broke?100:cond)+'%;background:'+cc+'"></i></div><b style="font-size:12px;color:'+cc+'">'+cl+'</b></div>';
  h+='<div style="display:flex;gap:8px">'+
     '<div class="bg3-mini"><div class="k">Profit /min</div><div class="v" style="color:#7ad03a">'+netMin.toFixed(1)+'</div></div>'+
     '<div class="bg3-mini"><div class="k">In register</div><div class="v">'+stock+'</div></div></div>';
  return h;}
function storeDetailHTML(rec){const lot=lotOf(rec);const em=eventMult(lot);
  const gMin=grossPerMin(lot)*condMult(lot)*em, supMin=gMin*SUPPLY_RATE, rentMin=(gMin>0?rentPerMin(lot):0), netMin=Math.max(0,gMin-supMin-rentMin);
  const rev=Math.round(lot.rev||0), exp=Math.round(lot.exp||0), prof=rev-exp;
  let h='<div class="bg3-stat"><span>Earning</span><b>'+gMin.toFixed(1)+' Y/min</b></div>';
  h+='<div class="bg3-stat"><span>– Supplies (15%)</span><b style="color:#ef8fb0">'+(supMin>0?'-'+supMin.toFixed(1):'0.0')+'</b></div>';
  h+='<div class="bg3-stat"><span>– Rent</span><b style="color:#ef8fb0">'+(rentMin>0?'-'+rentMin.toFixed(1):'0.0')+'</b></div>';
  h+='<div class="bg3-stat" style="border-bottom:none"><span style="color:#F5F1E6"><b>= Profit</b></span><b style="color:#7ad03a">'+netMin.toFixed(1)+' Y/min</b></div>';
  h+='<div style="display:flex;gap:8px;margin:8px 0 2px">'+
     '<div class="bg3-mini"><div class="k">Revenue today</div><div class="v">'+rev+'</div></div>'+
     '<div class="bg3-mini"><div class="k">Expenses</div><div class="v" style="color:#ef8fb0">'+exp+'</div></div>'+
     '<div class="bg3-mini"><div class="k">Profit</div><div class="v" style="color:#7ad03a">'+prof+'</div></div></div>';
  return h;}
function openStoreManage(rec){const lot=lotOf(rec);const t=TYPES[lot.type];
  const upC=upgradeCost(lot), repC=repairCost(lot), stock=Math.floor(lot.stock||0), cond=Math.round(condOf(lot));
  let h='<h3>'+t.emoji+' '+t.name+' <span style="font-size:12px;color:#9AA79A;font-family:Work Sans">Lvl '+lot.lvl+'</span></h3>';
  h+=storeTopHTML(rec);
  h+='<div id="bg3det" style="display:none;margin-top:4px">'+storeDetailHTML(rec)+'</div>';
  h+='<button class="bg3-link" id="bg3dett">Business details ▾</button>';
  if(lot.broke){
    h+='<p style="color:#ff9a4a;font-size:12px;margin:8px 0 0">Equipment is broken — customers can\'t be served until you repair it.</p>';
    h+='<button class="bg3-btn" id="bg3rep" '+(S.coins>=repC?'':'disabled')+'>🔧 Repair · Y '+repC+'</button>';
  } else {
    if(stock>=1) h+='<button class="bg3-btn" id="bg3col" style="background:linear-gradient(180deg,#7ad03a,#4fae2a);color:#0c1a08">💰 Collect register · '+stock+' Y</button>';
    h+='<div style="display:flex;gap:8px">';
    if(cond<100) h+='<button class="bg3-btn" id="bg3rep" style="flex:1;background:rgba(227,192,90,.14);color:#E3C05A;border:1px solid rgba(227,192,90,.4)" '+(S.coins>=repC?'':'disabled')+'>🔧 Tune-up ·Y'+repC+'</button>';
    h+='<button class="bg3-btn" id="bg3up" style="flex:1" '+(S.coins>=upC?'':'disabled')+'>⬆ Upgrade ·Y'+upC+'</button>';
    h+='</div>';
  }
  openModal(h);
  const dett=ui.modalbody.querySelector('#bg3dett');if(dett)dett.onclick=()=>{const d=ui.modalbody.querySelector('#bg3det');if(!d)return;const open=d.style.display!=='none';d.style.display=open?'none':'block';dett.textContent='Business details '+(open?'▾':'▴');};
  const col=ui.modalbody.querySelector('#bg3col');if(col)col.onclick=()=>{collect(rec);closeModal();};
  const rep=ui.modalbody.querySelector('#bg3rep');if(rep)rep.onclick=()=>{if(S.coins<repC)return;S.coins-=repC;lot.exp=(lot.exp||0)+repC;lot.broke=false;lot.cond=100;toast('Repaired '+t.name+'!');updateCoin(rec);themeInterior(rec);startServing(rec);refreshUI();saveSoon();closeModal();};
  const up=ui.modalbody.querySelector('#bg3up');if(up)up.onclick=()=>{if(S.coins<upC)return;S.coins-=upC;lot.lvl++;gainXP(8);renderPlot(rec);applyMode(mode);toast('Upgraded to Lvl '+lot.lvl);themeInterior(rec);startServing(rec);refreshUI();saveSoon();closeModal();};
}
function refreshServeHUD(){if(ui.served)ui.served.textContent=(S.servedToday||0);}
function enterStore(rec){if(insideRec)return;fade(()=>{insideRec=rec;themeInterior(rec);interiorGroup.visible=true;intAngle=0;updateIntCam();
  const lot=lotOf(rec),t=TYPES[lot.type];if(ui.storeTitle)ui.storeTitle.innerHTML=t.emoji+' '+lot.name+' <span style="font-size:11px;color:#9AA79A">Lvl '+lot.lvl+'</span>';
  if(ui.store)ui.store.classList.add('on');ui.wrap.classList.add('bg3-inside');refreshServeHUD();startServing(rec);});}
function exitStore(){if(!insideRec)return;fade(()=>{stopServing();insideRec=null;interiorGroup.visible=false;clearGroup(interiorGroup);intClickable.length=0;if(ui.store)ui.store.classList.remove('on');ui.wrap.classList.remove('bg3-inside');updateCam();});}

/* ---- active customer-serving loop: the shop is a place you play ---- */
const QUEUE_MAX=6, PATIENCE=10, COMBO_WINDOW=3500, SERVE_Z=-1.7, DOOR_Z=4.6;
let queue=[], leaving=[], projectiles=[], spawnT=0, servingRec=null, combo=0, comboT=0, patSprite=null, patAcc=0, comboHideT=null;
function slotPos(i){return {x:-0.4, z:SERVE_Z+i*1.3};}
function saleValue(lot){return Math.max(3,Math.round(grossPerMin(lot)*condMult(lot)*eventMult(lot)*1.5*eventPerk()));}
function makeWantBubble(emoji){const c=document.createElement('canvas');c.width=96;c.height=112;const x=c.getContext('2d');x.clearRect(0,0,96,112);
  x.fillStyle='rgba(255,253,246,.97)';rr(x,10,6,76,64,18);x.fill();x.strokeStyle='#e0be5e';x.lineWidth=4;rr(x,10,6,76,64,18);x.stroke();
  x.fillStyle='rgba(255,253,246,.97)';x.beginPath();x.moveTo(40,68);x.lineTo(58,68);x.lineTo(46,86);x.closePath();x.fill();
  x.font='42px serif';x.textAlign='center';x.textBaseline='middle';x.fillText(emoji,48,38);
  const tx=new THREE.CanvasTexture(c);const m=new THREE.SpriteMaterial({map:tx,transparent:true,depthTest:false});const s=new THREE.Sprite(m);s.scale.set(1.5,1.75,1);return s;}
function makePatienceBar(){const c=document.createElement('canvas');c.width=100;c.height=18;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false}));s.userData.canvas=c;s.scale.set(1.6,0.29,1);s.visible=false;return s;}
function drawPatience(spr,frac){const c=spr.userData.canvas,x=c.getContext('2d');x.clearRect(0,0,100,18);
  x.fillStyle='rgba(0,0,0,.5)';rr(x,1,1,98,16,8);x.fill();
  const col=frac>0.5?'#7ad03a':frac>0.25?'#E6C020':'#ff5a4a',w=Math.max(4,Math.round(96*frac));x.fillStyle=col;rr(x,2,2,w,14,7);x.fill();
  spr.material.map.needsUpdate=true;}
function startServing(rec){stopServing();servingRec=rec;spawnT=0.8;combo=0;comboT=0;refreshServeHUD();patSprite=makePatienceBar();interiorGroup.add(patSprite);spawnCustomer();spawnCustomer();spawnCustomer();}
function stopServing(){queue=[];leaving=[];projectiles=[];servingRec=null;patSprite=null;combo=0;if(ui.combo)ui.combo.classList.remove('on');}
function spawnCustomer(){const rec=servingRec;if(!rec)return;const lot=lotOf(rec);if(lot.broke||queue.length>=QUEUE_MAX)return;
  const seed=(Math.floor(performance.now()/97)+queue.length)%SHIRTS.length;
  const p=makePerson(seed);const slot=queue.length;const sp=slotPos(slot);
  p.position.set(sp.x,0,DOOR_Z);p.rotation.y=Math.PI;p.userData={station:'serve'};interiorGroup.add(p);
  const want=makeWantBubble(TYPES[lot.type].emoji);want.position.set(sp.x,2.3,DOOR_Z);want.visible=true;want.userData={station:'serve'};interiorGroup.add(want);
  const cust={mesh:p,want:want,slot:slot,state:'walking',t:PATIENCE};p.userData.cust=cust;
  queue.push(cust);intClickable.push(p);intClickable.push(want);}
function serveFront(){const rec=servingRec;if(!rec)return;const lot=lotOf(rec);if(lot.broke){toast('🔧 Repair the equipment to serve');return;}
  const front=queue[0];if(!front||front.state==='leaving')return;
  const now=performance.now();
  combo=(now-comboT<COMBO_WINDOW)?combo+1:1;comboT=now;
  const cmult=1+Math.min(combo-1,5)*0.2;                 // x1 → x2 for a 6-chain
  const base=saleValue(lot);
  const frac=Math.max(0,Math.min(1,front.t/PATIENCE));
  const tip=Math.round(base*0.7*frac);                   // serve fast → bigger tip
  const total=Math.round((base+tip)*cmult);
  S.coins+=total;S.earnedToday=(S.earnedToday||0)+total;S.servedToday=(S.servedToday||0)+1;gainXP(1);
  flyCoins(front.mesh);floatText(front.mesh,'+'+total+' Y'+(tip>0?' 💛':''),'#8ede4a');
  flyProduct(TYPES[lot.type].emoji,front.mesh);popHearts(front.mesh);if(combo>=2)showCombo(combo);
  front.state='leaving';if(front.want)front.want.visible=false;
  queue.shift();leaving.push(front);queue.forEach((c,i)=>c.slot=i);
  addEventPoints(1);refreshServeHUD();refreshUI();saveSoon();refreshDailyBadges();}
function showCombo(n){if(!ui.combo)return;ui.combo.textContent='🔥 '+n+'× COMBO!';ui.combo.classList.remove('pop');void ui.combo.offsetWidth;ui.combo.classList.add('on','pop');clearTimeout(comboHideT);comboHideT=setTimeout(()=>ui.combo.classList.remove('on'),1400);}
function popHearts(mesh){if(!ui.wrap||!mesh)return;const p=worldToScreen(mesh);for(let i=0;i<2;i++){const d=document.createElement('div');d.className='bg3-heart';d.textContent=i?'⭐':'💛';d.style.left=(p.x+(i?14:-14))+'px';d.style.top=(p.y-42)+'px';ui.wrap.appendChild(d);requestAnimationFrame(()=>{d.style.transform='translate(-50%,-42px)';d.style.opacity='0';});setTimeout(()=>d.remove(),720);}}
function floatText(fromMesh,txt,color){if(!ui.wrap||!fromMesh)return;const p=worldToScreen(fromMesh);const d=document.createElement('div');d.className='bg3-float';d.textContent=txt;d.style.color=color||'#7ad03a';d.style.left=p.x+'px';d.style.top=(p.y-30)+'px';ui.wrap.appendChild(d);
  requestAnimationFrame(()=>{d.style.transform='translate(-50%,-46px)';d.style.opacity='0';});setTimeout(()=>d.remove(),820);}
function flyProduct(emoji,toMesh){if(!toMesh)return;const m=new THREE.SpriteMaterial({map:emojiTex(emoji),transparent:true,depthTest:false});const s=new THREE.Sprite(m);s.scale.set(0.9,0.9,1);
  s.position.set(0,2.2,-3.2);interiorGroup.add(s);const to=toMesh.position.clone();to.y=1.6;projectiles.push({spr:s,from:s.position.clone(),to:to,t:0});}
function removeMesh(mesh){if(mesh&&mesh.parent)mesh.parent.remove(mesh);const i=intClickable.indexOf(mesh);if(i>=0)intClickable.splice(i,1);}
function tickServing(dt){const rec=servingRec;if(!rec)return;const lot=lotOf(rec);const now=performance.now();
  if(combo>0&&now-comboT>COMBO_WINDOW)combo=0; // combo cools off if you stop serving
  if(!lot.broke){spawnT-=dt;const interval=(eventMult(lot)>1?1.1:1.9);if(spawnT<=0){spawnCustomer();spawnT=interval;}}
  for(let i=0;i<queue.length;i++){const c=queue[i];const sp=slotPos(c.slot);
    const dx=sp.x-c.mesh.position.x,dz=sp.z-c.mesh.position.z,d=Math.hypot(dx,dz);
    if(d>0.06){const step=Math.min(3.6*dt,d);c.mesh.position.x+=dx/d*step;c.mesh.position.z+=dz/d*step;if(c.state!=='waiting')c.state='walking';}
    else if(c.state!=='waiting'){c.state='waiting';}
    c.mesh.position.y=(c.state==='walking')?Math.abs(Math.sin(now/130+i))*0.05:0;
    if(c.want){c.want.position.set(c.mesh.position.x,2.25+Math.sin(now/300+i)*0.06,c.mesh.position.z);c.want.visible=(c.state!=='leaving');}
    if(i===0&&c.state==='waiting'){c.t-=dt;if(c.t<=0){combo=0;if(ui.combo)ui.combo.classList.remove('on');if(c.want)c.want.visible=false;queue.shift();leaving.push(c);queue.forEach((q,j)=>q.slot=j);}}
  }
  // patience bar over the front customer
  if(patSprite){const f=queue[0];if(f&&f.state==='waiting'){patSprite.visible=true;patSprite.position.set(f.mesh.position.x,2.98,f.mesh.position.z);patAcc+=dt;if(patAcc>0.12){patAcc=0;drawPatience(patSprite,Math.max(0,f.t/PATIENCE));}}else patSprite.visible=false;}
  for(let k=leaving.length-1;k>=0;k--){const c=leaving[k];c.mesh.rotation.y=0;c.mesh.position.z+=4.4*dt;if(c.want)c.want.visible=false;
    if(c.mesh.position.z>DOOR_Z+1.5){removeMesh(c.mesh);if(c.want)removeMesh(c.want);leaving.splice(k,1);}}
  for(let k=projectiles.length-1;k>=0;k--){const pr=projectiles[k];pr.t+=dt*3.2;const u=Math.min(1,pr.t);
    pr.spr.position.lerpVectors(pr.from,pr.to,u);pr.spr.position.y+=Math.sin(u*Math.PI)*0.7;
    if(u>=1){if(pr.spr.parent)pr.spr.parent.remove(pr.spr);projectiles.splice(k,1);}}
}
function fade(mid){const f=ui.fade;if(!f){if(mid)mid();return;}f.classList.add('on');setTimeout(()=>{if(mid)mid();setTimeout(()=>f.classList.remove('on'),70);},240);}
const IC=new THREE.Vector3(0,400,0);
function updateIntCam(){camera.position.set(IC.x+Math.sin(intAngle)*intDist,IC.y+5.6,IC.z+Math.cos(intAngle)*intDist+7);camera.lookAt(IC.x,IC.y+1.4,IC.z-1.6);if(sky)sky.position.x=IC.x;}
function updateIntCoin(rec){if(!rec.intCoin)return;const lot=lotOf(rec);const n=Math.floor(lot.stock||0);const t=coinTex(n);if(rec.intCoin.material.map&&rec.intCoin.material.map.dispose)rec.intCoin.material.map.dispose();rec.intCoin.material.map=t;rec.intCoin.material.needsUpdate=true;rec.intCoin.visible=n>=1;}
function themeInterior(rec){const lot=lotOf(rec);const t=TYPES[lot.type];const g=interiorGroup;clearGroup(g);intClickable.length=0;
  // interior lighting (only active while this group is visible)
  g.add(new THREE.AmbientLight(0xeaf0ff,0.8));
  const pl=new THREE.PointLight(0xfff0d0,1.15,90,2);pl.position.set(0,6.8,3);g.add(pl);
  const floor=new THREE.Mesh(new THREE.BoxGeometry(14,0.4,13),std({color:0x8a6a45,roughness:.9}));floor.position.set(0,-0.2,0);floor.receiveShadow=true;g.add(floor);
  const rug=new THREE.Mesh(new THREE.BoxGeometry(6,0.06,5),std({color:t.awn,roughness:.9}));rug.position.set(0,0.04,1.4);g.add(rug);
  const wallMat=std({color:t.pal.fac,roughness:.97});
  g.add(mesh(new THREE.BoxGeometry(14,7,0.4),wallMat,0,3.3,-6.2));
  g.add(mesh(new THREE.BoxGeometry(0.4,7,13),wallMat,-7,3.3,0));
  g.add(mesh(new THREE.BoxGeometry(0.4,7,13),wallMat,7,3.3,0));
  g.add(mesh(new THREE.BoxGeometry(14,1.5,0.5),std({color:t.pal.trim}),0,0.75,-6.0));
  const st=signTex(t.name,t.emoji,'#E3C05A');const sm=std({map:st,emissiveMap:st,emissive:0xffffff,emissiveIntensity:.75,transparent:true});
  g.add(mesh(new THREE.PlaneGeometry(6,6*72/256),sm,0,5.1,-5.98));
  // shelves stocked with product
  for(let r=0;r<2;r++){g.add(mesh(new THREE.BoxGeometry(8.4,0.2,0.7),std({color:t.pal.trim}),0,2.2+r*1.5,-5.5));
    for(let c=0;c<5;c++)g.add(mesh(new THREE.PlaneGeometry(0.72,0.72),std({map:emojiTex(t.emoji),transparent:true}),-3.2+c*1.6,2.58+r*1.5,-5.28));}
  // counter + register toward the back, below the shelves (tap to collect)
  const counter=mesh(new THREE.BoxGeometry(6,1.7,1.4),std({color:t.pal.trim,roughness:.7}),0,0.85,-3.4);counter.userData={rec,station:'register'};counter.castShadow=true;g.add(counter);intClickable.push(counter);
  g.add(mesh(new THREE.BoxGeometry(6.3,0.22,1.7),std({color:0x2a2018}),0,1.75,-3.4));
  const reg=mesh(new THREE.BoxGeometry(1.1,0.8,0.9),std({color:0x33383f,emissive:0x2a3a5a,emissiveIntensity:.25}),-1.8,2.15,-3.4);reg.userData={rec,station:'register'};g.add(reg);intClickable.push(reg);
  const ct=coinTex(Math.floor(lot.stock||0));const cm=new THREE.SpriteMaterial({map:ct,transparent:true,depthTest:false});const spr=new THREE.Sprite(cm);spr.scale.set(2.4,1.2,1);spr.position.set(-1.8,3.2,-3.4);spr.userData={rec,station:'register'};g.add(spr);intClickable.push(spr);rec.intCoin=spr;updateIntCoin(rec);
  // equipment machine (tap to fix)
  const eq=mesh(new THREE.BoxGeometry(1.9,2.4,1.5),std({color:lot.broke?0x7a2e28:0x545a63,metalness:.35,roughness:.5}),5.2,1.2,-3.8);eq.userData={rec,station:'equip'};eq.castShadow=true;g.add(eq);intClickable.push(eq);
  g.add(mesh(new THREE.PlaneGeometry(1.1,1.1),std({map:emojiTex(lot.broke?'🔧':'⚙️'),transparent:true}),5.2,1.4,-3.03));
  // shopkeeper behind the counter (customers arrive live via the serving loop)
  const keep=makePerson(rec.i+2);keep.position.set(1.4,0,-4.5);keep.rotation.y=0;g.add(keep);rec.intKeeper=keep;
}
function mesh(geo,mat,x,y,z){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);return m;}
function updateCoin(rec){if(!rec.coin)return;const lot=lotOf(rec);let t,vis;
  if(lot.broke){t=repairTex();vis=true;} else {const n=Math.floor(lot.stock||0);t=coinTex(n);vis=n>=1;}
  if(rec.coin.material.map&&rec.coin.material.map.dispose)rec.coin.material.map.dispose();
  rec.coin.material.map=t;rec.coin.material.needsUpdate=true;rec.coin.visible=vis;}

/* ---------------- daily / streak ---------------- */
function ensureDaily(){const td=todayStr();if(S.lastDay===td)return;
  if(S.lastDay===yStr())S.streak=(S.streak||0)+1;else S.streak=1;S.lastDay=td;
  eachLot(l=>{if(l.built){l.rev=0;l.exp=0;}}); // reset daily books city-wide
  S.servedToday=0;S.collectsToday=0;S.earnedToday=0;S.goals=rollGoals();
  S.spins=Math.min(SPIN_MAX,(S.spins||0)+15); // free daily spins to bring you back
  const bonus=Math.min(120,20*S.streak);S.coins+=bonus;toast('Daily +'+bonus+' Y · streak '+S.streak);refreshUI();saveSoon();if(typeof refreshDailyBadges==='function')refreshDailyBadges();}

/* ---------------- guided coach tour ---------------- */
let tourIdx=0;
const TOUR=[
  {title:'Welcome to your block! 🏙️',body:"Let's take a quick tour. You'll run little shops, collect coins, and grow a whole city."},
  {world:()=>{const rec=plots.find(r=>lotOf(r).built&&r.d===S.district);return rec&&rec.coin?worldToScreen(rec.coin):null;},title:'Collect & step inside',body:'Tap a shop to go inside and run it — collect earnings, upgrade, and repair. Or tap its coin bubble to grab coins fast.'},
  {world:()=>{const ni=nextUnlockIndex(S.district);if(ni<0)return null;const rec=plots.find(r=>r.d===S.district&&r.i===ni);return rec?worldToScreen(rec.group):null;},title:'Open new shops',body:'Spend coins on an empty lot to open a new shop. More shops means more coins!'},
  {sel:'.bg3-travel',title:'Explore the city',body:'Use these arrows to travel between districts — tap ＋ to unlock brand-new ones. The city never ends.'},
  {sel:'#bg3rivals',title:'Beat your rivals',body:'Open the leaderboard to raid rival tycoons for coins and climb your way to #1.'},
  {title:"You're all set! 🎉",body:'Tap, build, travel, and grow your block. Have fun!'}
];
function startTour(){if(!ui.tour)return;closeModal();tourIdx=0;ui.tour.classList.add('on');tourStep(0);}
function tourStep(i){const steps=TOUR;if(i>=steps.length){endTour(true);return;}tourIdx=Math.max(0,i);const st=steps[tourIdx];
  const wr=ui.wrap.getBoundingClientRect();let rect=null;
  if(st.sel){const el=ui.wrap.querySelector(st.sel);if(el){const r=el.getBoundingClientRect();rect={x:r.left-wr.left,y:r.top-wr.top,w:r.width,h:r.height};}}
  else if(st.world){const p=st.world();if(p&&isFinite(p.x))rect={x:p.x-62,y:p.y-46,w:124,h:92};}
  const spot=ui.tourSpot;
  if(rect){spot.style.display='block';spot.style.left=(rect.x-6)+'px';spot.style.top=(rect.y-6)+'px';spot.style.width=(rect.w+12)+'px';spot.style.height=(rect.h+12)+'px';}
  else spot.style.display='none';
  const card=ui.tourCard;card.querySelector('.tt').textContent=st.title;card.querySelector('.tb').textContent=st.body;card.querySelector('.tstep').textContent=(tourIdx+1)+' / '+steps.length;
  card.querySelector('.tback').style.visibility=tourIdx>0?'visible':'hidden';card.querySelector('.tnext').textContent=(tourIdx===steps.length-1)?"Let's go!":'Next';
  card.style.display='block';const cw=Math.min(300,wr.width-32);card.style.width=cw+'px';const ch=card.offsetHeight||150;
  let cx,cy;
  if(rect){cx=Math.max(12,Math.min(rect.x+rect.w/2-cw/2,wr.width-cw-12));cy=rect.y+rect.h+16;if(cy+ch>wr.height-14)cy=Math.max(12,rect.y-ch-16);}
  else {cx=(wr.width-cw)/2;cy=Math.max(16,(wr.height-ch)/2);}
  card.style.left=cx+'px';card.style.top=cy+'px';}
function endTour(done){if(ui.tour)ui.tour.classList.remove('on');if(done){S.tut=1;saveSoon();}}

/* ---------------- random events (rush / tip / restock / lucky hour) ---------------- */
const EV_CFG={rush:['🎉','RUSH ×3','#E3242B'],tip:['💝','TIP!','#E05aa0'],restock:['📦','RESTOCK','#c98a3a']};
function evTex(ev){const cfg=EV_CFG[ev.type]||EV_CFG.rush;
  const c=document.createElement('canvas');c.width=176;c.height=76;const x=c.getContext('2d');x.clearRect(0,0,176,76);
  x.fillStyle='rgba(8,11,9,.9)';rr(x,4,10,168,44,22);x.fill();x.strokeStyle=cfg[2];x.lineWidth=3;rr(x,4,10,168,44,22);x.stroke();
  x.font='28px serif';x.textAlign='left';x.textBaseline='middle';x.fillText(cfg[0],16,33);
  x.fillStyle='#f6efdd';x.font='800 21px Georgia';x.fillText(cfg[1],56,34);
  return new THREE.CanvasTexture(c);}
function updateEventSprite(rec){if(!rec.evSprite)return;const lot=lotOf(rec);const ev=lot.ev;
  const active=ev&&(ev.until||0)>Date.now();
  if(active){const t=evTex(ev);if(rec.evSprite.material.map&&rec.evSprite.material.map.dispose)rec.evSprite.material.map.dispose();rec.evSprite.material.map=t;rec.evSprite.material.needsUpdate=true;rec.evSprite.visible=true;}
  else {if(ev)lot.ev=null;rec.evSprite.visible=false;}}
function claimEvent(rec){const lot=lotOf(rec);const ev=lot.ev;if(!ev||(ev.until||0)<Date.now())return false;
  if(ev.type==='tip'){S.coins+=ev.amt;gainXP(3);toast('💝 Happy customer! +'+ev.amt+' Y');}
  else if(ev.type==='restock'){lot.stock=Math.min(storageCap(lot),(lot.stock||0)+ev.amt);lot.cond=Math.min(100,condOf(lot)+18);toast('📦 Restocked '+lot.name+'! +'+ev.amt+' Y in stock');}
  else return false; // rush is auto-applied, not "claimed"
  lot.ev=null;updateEventSprite(rec);updateCoin(rec);refreshUI();saveSoon();return true;}
let evTO;
function scheduleEvent(){clearTimeout(evTO);const t=55000+Math.random()*70000;evTO=setTimeout(()=>{spawnEvent();scheduleEvent();},t);}
function spawnEvent(){const now=Date.now();const elig=[];
  plots.forEach(rec=>{const l=lotOf(rec);if(l.built&&!l.broke&&!(l.ev&&(l.ev.until||0)>now))elig.push(rec);});
  if(!elig.length)return;
  const rec=elig[Math.floor(Math.random()*elig.length)];const lot=lotOf(rec);const roll=Math.random();
  if(roll<0.55){lot.ev={type:'rush',mult:3,until:now+70000};toast('🎉 Customer rush at '+lot.name+' — earning ×3 for a bit!');}
  else if(roll<0.80){lot.ev={type:'tip',amt:Math.max(20,Math.round(grossPerMin(lot)*8)),until:now+90000};}
  else {lot.ev={type:'restock',amt:Math.max(25,Math.round(grossPerMin(lot)*12)),until:now+90000};}
  updateEventSprite(rec);saveSoon();}
let luckyTO;
function scheduleLucky(){clearTimeout(luckyTO);const t=(10+Math.random()*9)*60000;luckyTO=setTimeout(()=>{startLucky();scheduleLucky();},t);}
function startLucky(){S.lucky=Date.now()+120000;toast('✨ Lucky Hour! The whole city earns ×2 for 2 minutes!');updateLuckyUI();saveSoon();}
function updateLuckyUI(){if(!ui.lucky)return;const on=(S.lucky||0)>Date.now();ui.lucky.style.display=on?'flex':'none';
  if(on)ui.lucky.querySelector('b').textContent=fmtSec(S.lucky-Date.now());}
function fmtSec(ms){ms=Math.max(0,ms);const s=Math.round(ms/1000);return s>=60?('✨ ×2 '+Math.floor(s/60)+':'+String(s%60).padStart(2,'0')):('✨ ×2 0:'+String(s).padStart(2,'0'));}

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

/* ---------------- daily return loop: goals, spin, welcome-back ---------------- */
const GOAL_DEFS={serve:{icon:'🛎️',label:n=>'Serve '+n+' customers'},collect:{icon:'💰',label:n=>'Collect '+n+' times'},earn:{icon:'🪙',label:n=>'Earn '+n+' coins'}};
function rollGoals(){const lv=S.level||1;return {day:todayStr(),items:[
  {type:'serve',target:10+lv*3,reward:40+lv*15,claimed:false},
  {type:'collect',target:4+Math.floor(lv/2),reward:35+lv*10,claimed:false},
  {type:'earn',target:120+lv*60,reward:40+lv*15,claimed:false}]};}
function ensureGoals(){if(!S.goals||S.goals.day!==todayStr())S.goals=rollGoals();}
function goalProg(g){return g.type==='serve'?(S.servedToday||0):g.type==='collect'?(S.collectsToday||0):(S.earnedToday||0);}
function goalDone(g){return goalProg(g)>=g.target;}
function goalsClaimable(){return S.goals?S.goals.items.filter(g=>goalDone(g)&&!g.claimed).length:0;}
function goalLabel(g){const d=GOAL_DEFS[g.type];return d?d.icon+' '+d.label(g.target):g.type;}
function refreshDailyBadges(){if(ui.goalsBadge){const n=goalsClaimable();ui.goalsBadge.style.display=n>0?'flex':'none';ui.goalsBadge.textContent=n;}
  if(ui.spinBtn)ui.spinBtn.classList.toggle('avail',spinAvailable());}
function openGoals(){ensureGoals();
  let h='<h3>🦉 Biz Buddy\'s to-do list</h3><p>Finish these today for bonus coins — fresh goals every morning!</p><div class="bg3-goals">';
  S.goals.items.forEach((g,i)=>{const p=goalProg(g),done=p>=g.target,pct=Math.min(100,Math.round(p/g.target*100));
    h+='<div class="bg3-goal"><div class="gtop"><span class="gl">'+goalLabel(g)+'</span><span class="gr">+'+g.reward+' Y</span></div>'+
       '<div class="gbar"><i style="width:'+pct+'%"></i></div>'+
       '<div class="gbot"><span>'+Math.min(p,g.target)+' / '+g.target+'</span>'+
       (g.claimed?'<span class="gdone">✓ Claimed</span>':(done?'<button class="gclaim" data-i="'+i+'">Claim</button>':'<span class="gmuted">keep going…</span>'))+'</div></div>';});
  h+='</div>';openModal(h);
  ui.modalbody.querySelectorAll('.gclaim').forEach(b=>b.onclick=()=>{const g=S.goals.items[+b.getAttribute('data-i')];if(!g||g.claimed||!goalDone(g))return;g.claimed=true;S.coins+=g.reward;S.earnedToday=(S.earnedToday||0)+g.reward;gainXP(6);confettiBurst();toast('🎯 Goal done! +'+g.reward+' Y');refreshUI();saveSoon();refreshDailyBadges();openGoals();});}
const SPIN_PRIZES=[{t:'coins',v:50,label:'50',color:'#7ad03a'},{t:'coins',v:150,label:'150',color:'#E3C05A'},{t:'coins',v:80,label:'80',color:'#37A6C9'},{t:'lucky',label:'2× Hr',color:'#8a5aff'},{t:'coins',v:300,label:'300',color:'#E05aa0'},{t:'tickets',v:3,label:'3⚔',color:'#2f9e57'},{t:'coins',v:120,label:'120',color:'#E6A020'},{t:'coins',v:600,label:'600',color:'#E3242B'}];
function spinAvailable(){return S.spinDay!==todayStr();}
function openSpin(){if(!spinAvailable()){openModal('<h3>🎡 Daily Spin</h3><p>You\'ve already spun today. Come back tomorrow for another free spin!</p>');return;}
  const N=SPIN_PRIZES.length,step=360/N;let grad=[],labels='';
  SPIN_PRIZES.forEach((p,i)=>{grad.push(p.color+' '+(i*step)+'deg '+((i+1)*step)+'deg');const a=(i+0.5)*step;labels+='<div class="bg3-wlabel" style="transform:translate(-50%,-50%) rotate('+a+'deg) translateY(-66px) rotate('+(-a)+'deg)">'+p.label+'</div>';});
  openModal('<h3>🎡 Daily Spin</h3><p>One free spin every day — good luck!</p><div class="bg3-wheelwrap"><div class="bg3-wpin"></div><div class="bg3-wheel" id="bg3wheel" style="background:conic-gradient('+grad.join(',')+')">'+labels+'</div></div><button class="bg3-btn" id="bg3spinb">SPIN!</button>');
  const wheel=ui.modalbody.querySelector('#bg3wheel'),btn=ui.modalbody.querySelector('#bg3spinb');let spun=false;
  btn.onclick=()=>{if(spun)return;spun=true;btn.disabled=true;btn.textContent='Spinning…';
    const idx=Math.floor(Math.random()*N);const target=360*5+(360-((idx+0.5)*step));
    wheel.style.transition='transform 3.4s cubic-bezier(.16,.84,.3,1)';wheel.style.transform='rotate('+target+'deg)';
    S.spinDay=todayStr();saveSoon();
    setTimeout(()=>{awardSpin(SPIN_PRIZES[idx]);refreshDailyBadges();btn.textContent='Come back tomorrow!';},3500);};}
function awardSpin(p){
  if(p.t==='coins'){S.coins+=p.v;S.earnedToday=(S.earnedToday||0)+p.v;toast('🎉 You won '+p.v+' Y!');}
  else if(p.t==='lucky'){S.lucky=Date.now()+120000;updateLuckyUI();toast('🎉 You won a Lucky Hour! ×2 for 2 min');}
  else if(p.t==='tickets'){S.raid.tickets=Math.min(RAID_MAX_TICKETS,(S.raid.tickets||0)+p.v);toast('🎉 You won '+p.v+' raid tickets!');}
  confettiBurst();refreshUI();saveSoon();}
function collectAll(){let total=0;plots.forEach(rec=>{const l=lotOf(rec);const amt=Math.floor(l.stock||0);if(l.built&&amt>=1){l.stock-=amt;total+=amt;updateCoin(rec);}});
  if(total>0){S.coins+=total;S.earnedToday=(S.earnedToday||0)+total;S.collectsToday=(S.collectsToday||0)+1;gainXP(Math.min(30,total));toast('💰 Collected '+total+' Y!');refreshUI();saveSoon();refreshDailyBadges();}}
function welcomeBack(){const now=Date.now();const away=now-(S.lastSeen||now);S.lastSeen=now;
  if(away<120000||!S.districts)return;
  let waiting=0,shops=0;eachLot(l=>{if(l.built){waiting+=Math.floor(l.stock||0);shops++;}});
  const mins=Math.floor(away/60000);const cust=Math.max(1,Math.round(mins*0.4*Math.max(1,shops)));
  const h='<h3>👋 Welcome back!</h3><p>While you were away'+(mins>0?(' (~'+(mins>=60?Math.floor(mins/60)+'h':mins+'m')+')'):'')+', your shops kept working.</p>'+
    '<div style="display:flex;gap:8px;margin:6px 0 10px">'+
    '<div class="bg3-mini"><div class="k">Waiting to collect</div><div class="v" style="color:#E3C05A">'+waiting+'</div></div>'+
    '<div class="bg3-mini"><div class="k">Customers stopped by</div><div class="v">'+cust+'</div></div></div>'+
    (waiting>0?'<button class="bg3-btn" id="bg3colall">💰 Collect all · '+waiting+' Y</button>':'<button class="bg3-btn" id="bg3okb">Let\'s go!</button>');
  openModal(h);
  const ca=ui.modalbody.querySelector('#bg3colall');if(ca)ca.onclick=()=>{collectAll();closeModal();};
  const ok=ui.modalbody.querySelector('#bg3okb');if(ok)ok.onclick=closeModal;}

/* ---------------- live events & seasons: always something happening ---------------- */
const EVENTS=[
  {id:'grand',name:'Grand Opening',emoji:'🎉',color:'#E3242B'},
  {id:'summer',name:'Summer Festival',emoji:'🎪',color:'#E6A020'},
  {id:'rush',name:'Rush Weekend',emoji:'⚡',color:'#8a5aff'},
  {id:'sweet',name:'Sweet Treats Fair',emoji:'🍰',color:'#E05aa0'}];
const EV_TIERS=[{pts:12,rw:120},{pts:35,rw:350},{pts:75,rw:750},{pts:150,rw:1600}];
const EV_PERIOD=3*864e5; // a fresh event every 3 days
function eventIndex(){return Math.floor(Date.now()/EV_PERIOD);}
function currentEvent(){return EVENTS[eventIndex()%EVENTS.length];}
function eventEndsIn(){return (eventIndex()+1)*EV_PERIOD-Date.now();}
function ensureEvent(){const ev=currentEvent();if(!S.event||S.event.id!==ev.id)S.event={id:ev.id,points:0,claimed:[]};if(!S.event.claimed)S.event.claimed=[];}
function addEventPoints(n){ensureEvent();S.event.points=(S.event.points||0)+n;refreshEventUI();}
function eventPerk(){return 1.25;}
function fmtDur(ms){ms=Math.max(0,ms);const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),d=Math.floor(h/24);return d>0?(d+'d '+(h%24)+'h'):(h+'h '+m+'m');}
function eventClaimable(){ensureEvent();const p=S.event.points||0;return EV_TIERS.some((t,i)=>p>=t.pts&&S.event.claimed.indexOf(i)<0);}
function refreshEventUI(){if(!ui.event)return;ensureEvent();const ev=currentEvent();
  ui.event.querySelector('b').textContent=ev.emoji+' '+ev.name;ui.event.querySelector('i').textContent='ends '+fmtDur(eventEndsIn());
  ui.event.classList.toggle('ready',eventClaimable());}
function openEvent(){ensureEvent();const ev=currentEvent();const pts=S.event.points||0;
  let h='<h3>'+ev.emoji+' '+ev.name+'</h3><p>Limited-time event — ends in <b>'+fmtDur(eventEndsIn())+'</b>! Every sale gets <b style="color:#7ad03a">+25%</b>. Earn event points by serving customers and collecting, then grab the prizes.</p>';
  h+='<div class="bg3-stat"><span>Your event points</span><b style="color:#E3C05A">'+pts+'</b></div><div class="bg3-etiers">';
  EV_TIERS.forEach((t,i)=>{const got=pts>=t.pts;const claimed=S.event.claimed.indexOf(i)>=0;const special=i===EV_TIERS.length-1;const pct=Math.min(100,Math.round(pts/t.pts*100));
    h+='<div class="bg3-etier'+(got?' reached':'')+'"><div class="et-l"><div class="et-pts">'+(special?'🏆 ':'')+t.pts+' points</div><div class="et-bar"><i style="width:'+pct+'%"></i></div></div>'+
      '<div class="et-r">+'+t.rw+' Y '+(claimed?'<span class="et-claimed">✓</span>':(got?'<button class="et-claim" data-i="'+i+'">Claim</button>':'<span class="et-lock">🔒</span>'))+'</div></div>';});
  h+='</div>';openModal(h);
  ui.modalbody.querySelectorAll('.et-claim').forEach(b=>b.onclick=()=>{const i=+b.getAttribute('data-i');const t=EV_TIERS[i];if((S.event.points||0)<t.pts||S.event.claimed.indexOf(i)>=0)return;S.event.claimed.push(i);S.coins+=t.rw;S.earnedToday=(S.earnedToday||0)+t.rw;confettiBurst();toast('🎪 Event prize! +'+t.rw+' Y');refreshUI();saveSoon();refreshEventUI();openEvent();});}

/* ---------------- spin-to-win slot machine + collectible stickers ---------------- */
const SPIN_MAX=50, SPIN_REFILL=4*60*1000;
const SYM=[{k:'coin',e:'🪙',w:34},{k:'bag',e:'💰',w:15},{k:'star',e:'⭐',w:15},{k:'raid',e:'⚔️',w:11},{k:'shield',e:'🛡️',w:11},{k:'sticker',e:'🃏',w:9},{k:'jackpot',e:'💎',w:5}];
const SYM_TOTAL=SYM.reduce((a,s)=>a+s.w,0);
const STICKERS=[{id:'cupcake',e:'🧁'},{id:'lemon',e:'🍋'},{id:'sneaker',e:'👟'},{id:'book',e:'📚'},{id:'flower',e:'🌸'},{id:'pizza',e:'🍕'},{id:'coffee',e:'☕'},{id:'game',e:'🎮'},{id:'gold',e:'🌟'}];
function spinsNow(){const now=Date.now();if(S.spins<SPIN_MAX){const g=Math.floor((now-(S.spinsT||now))/SPIN_REFILL);if(g>0){S.spins=Math.min(SPIN_MAX,S.spins+g);S.spinsT=(S.spins>=SPIN_MAX)?now:(S.spinsT+g*SPIN_REFILL);}}return S.spins;}
function spinsETA(){return S.spins>=SPIN_MAX?0:Math.max(0,SPIN_REFILL-(Date.now()-(S.spinsT||Date.now())));}
function pickSym(){let r=Math.random()*SYM_TOTAL;for(let i=0;i<SYM.length;i++){r-=SYM[i].w;if(r<=0)return SYM[i];}return SYM[0];}
function winSticker(){const s=STICKERS[Math.floor(Math.random()*STICKERS.length)];const had=(S.stickers[s.id]||0);S.stickers[s.id]=had+1;return {s:s,isNew:had===0};}
function stickersOwned(){return STICKERS.filter(s=>(S.stickers[s.id]||0)>0).length;}
function refreshSpinChip(){if(ui.slotEnergy){spinsNow();ui.slotEnergy.textContent=S.spins;}if(ui.slotBtn)ui.slotBtn.classList.toggle('avail',S.spins>0);}
function openSlots(){spinsNow();
  const h='<h3>🎰 Lucky Slots</h3><p>Every spin wins something — coins, jackpots, raids, shields or stickers! <b style="color:#E3C05A">⚡ '+S.spins+'/'+SPIN_MAX+'</b>'+(S.spins<SPIN_MAX?(' · +1 in '+fmtDur(spinsETA())):'')+'</p>'+
    '<div class="bg3-reels"><div class="bg3-reel" id="bg3r0">🪙</div><div class="bg3-reel" id="bg3r1">💰</div><div class="bg3-reel" id="bg3r2">⭐</div></div>'+
    '<div class="bg3-slotmsg" id="bg3slotmsg">Pull the lever!</div>'+
    '<button class="bg3-btn" id="bg3dospin" '+(S.spins>0?'':'disabled')+'>'+(S.spins>0?'SPIN! · ⚡1':'Out of spins — come back soon')+'</button>'+
    '<button class="bg3-link" id="bg3openstk">🃏 View sticker album ('+stickersOwned()+'/'+STICKERS.length+')</button>';
  openModal(h);
  const btn=ui.modalbody.querySelector('#bg3dospin'),msg=ui.modalbody.querySelector('#bg3slotmsg');
  const reels=[ui.modalbody.querySelector('#bg3r0'),ui.modalbody.querySelector('#bg3r1'),ui.modalbody.querySelector('#bg3r2')];
  ui.modalbody.querySelector('#bg3openstk').onclick=openStickers;
  let spinning=false;
  btn.onclick=()=>{if(spinning)return;spinsNow();if(S.spins<1){msg.textContent='No spins left — they refill over time!';return;}
    spinning=true;S.spins--;if(S.spins===SPIN_MAX-1)S.spinsT=Date.now();refreshSpinChip();saveSoon();
    btn.disabled=true;msg.textContent='Spinning…';
    const result=[pickSym(),pickSym(),pickSym()];
    reels.forEach((rl,i)=>{let n=0;const iv=setInterval(()=>{rl.textContent=SYM[Math.floor(Math.random()*SYM.length)].e;n++;},70);
      setTimeout(()=>{clearInterval(iv);rl.textContent=result[i].e;rl.classList.remove('land');void rl.offsetWidth;rl.classList.add('land');if(i===2){setTimeout(()=>{resolveSlots(result,msg);spinning=false;btn.disabled=S.spins<1;btn.textContent=S.spins>0?'SPIN! · ⚡1':'Out of spins — come back soon';},250);}},700+i*380);});
  };
}
function resolveSlots(result,msg){const cnt={};result.forEach(r=>cnt[r.k]=(cnt[r.k]||0)+1);const lv=S.level||1;let coins=0,parts=[];
  coins+=(cnt.coin||0)*(8+lv*2)+(cnt.bag||0)*(26+lv*6)+(cnt.star||0)*(14+lv*3)+(cnt.jackpot||0)*(60+lv*15);
  const three=result[0].k===result[1].k&&result[1].k===result[2].k;
  if(three&&result[0].k==='jackpot'){coins*=5;parts.push('💎 JACKPOT!');}
  else if(three){coins=Math.round(coins*2.2);parts.push('3 in a row!');}
  if((cnt.raid||0)>=2){const r=RIVALS[Math.floor(Math.random()*RIVALS.length)];const rw=Math.round(rivalWorth(r)*0.02)+30;coins+=rw;parts.push('⚔️ Raided '+r.name+' +'+rw);}
  if((cnt.shield||0)>=2){S.raid.shieldUntil=Date.now()+SHIELD_DUR;parts.push('🛡️ Shield up 1h');}
  if((cnt.sticker||0)>=1){for(let i=0;i<cnt.sticker;i++){const w=winSticker();parts.push((w.isNew?'🃏 NEW sticker ':'🃏 sticker ')+w.s.e);}}
  coins=Math.max(5,Math.round(coins));
  S.coins+=coins;S.earnedToday=(S.earnedToday||0)+coins;
  if(coins>=(300+lv*80)||three||(cnt.jackpot||0))confettiBurst();
  msg.innerHTML='<b style="color:#8ede4a">+'+coins+' Y</b>'+(parts.length?(' · '+parts.join(' · ')):'');
  refreshUI();saveSoon();refreshDailyBadges();}
function openStickers(){const owned=stickersOwned(),all=owned>=STICKERS.length;
  let h='<h3>🃏 Sticker Album <span style="font-size:12px;color:#E3C05A">'+owned+'/'+STICKERS.length+'</span></h3><p>Win stickers from the slot machine. Complete the set for a big prize!</p><div class="bg3-collect" style="grid-template-columns:repeat(3,1fr)">';
  STICKERS.forEach(s=>{const n=S.stickers[s.id]||0;h+='<div class="bg3-ccell'+(n>0?' got':'')+'" style="aspect-ratio:1;font-size:30px;position:relative">'+(n>0?s.e:'❔')+(n>1?'<span style="position:absolute;bottom:2px;right:5px;font-size:11px;color:#E3C05A;font-weight:800">x'+n+'</span>':'')+'</div>';});
  h+='</div>';
  if(all&&!S.stickerClaimed)h+='<button class="bg3-btn" id="bg3stkreward">🏆 Set complete! Claim +2500 Y</button>';
  else if(all)h+='<p style="text-align:center;color:#7ad03a;font-weight:700;margin-top:8px">🏆 Set complete — legendary collector!</p>';
  h+='<button class="bg3-link" id="bg3backslots">‹ Back to slots</button>';
  openModal(h);
  const rw=ui.modalbody.querySelector('#bg3stkreward');if(rw)rw.onclick=()=>{S.coins+=2500;S.stickerClaimed=true;confettiBurst();toast('🏆 Sticker set complete! +2500 Y');refreshUI();saveSoon();openStickers();};
  const bk=ui.modalbody.querySelector('#bg3backslots');if(bk)bk.onclick=openSlots;}

/* ---------------- career rank journey: the thing you climb toward ---------------- */
const RANKS=[
  {name:'Lemonade Stand',icon:'🍋',worth:0},
  {name:'Corner Shop',icon:'🏪',worth:1500},
  {name:'Market Street',icon:'🛍️',worth:6000},
  {name:'Shopping Plaza',icon:'🏬',worth:18000},
  {name:'Business Park',icon:'🏢',worth:45000},
  {name:'Mall Mogul',icon:'🎡',worth:110000},
  {name:'City Tycoon',icon:'👑',worth:260000},
  {name:'Legendary Mogul',icon:'🌟',worth:650000}];
function currentRank(){const w=playerWorth();let r=0;for(let i=0;i<RANKS.length;i++){if(w>=RANKS[i].worth)r=i;}return r;}
function rankReward(i){return 200+i*350;}
function checkRank(){if(S.rank==null)S.rank=currentRank();const cr=currentRank();if(cr<=S.rank)return;
  S.rank=cr;const R=RANKS[cr];const rw=rankReward(cr);S.coins+=rw;confettiBurst();
  if(ui.modal&&!ui.modal.classList.contains('on')){
    openModal('<h3>'+R.icon+' Rank up!</h3><p>Your business grew into a <b>'+R.name+'</b>! Keep building to climb even higher.</p><div class="bg3-stat" style="border:none"><span>Milestone reward</span><b style="color:#7ad03a">+'+rw+' Y</b></div><button class="bg3-btn" id="bg3rankok">Awesome!</button>');
    const b=ui.modalbody.querySelector('#bg3rankok');if(b)b.onclick=closeModal;
  } else { toast(R.icon+' Rank up: '+R.name+'! +'+rw+' Y'); }
  saveSoon();}
function careerHTML(){const cr=currentRank(),R=RANKS[cr],next=RANKS[cr+1],w=playerWorth();
  let h='<div class="bg3-career"><div class="cr-ic">'+R.icon+'</div><div class="cr-mid"><div class="cr-name">'+R.name+'</div>';
  if(next){const pct=Math.max(0,Math.min(100,Math.round((w-R.worth)/(next.worth-R.worth)*100)));
    h+='<div class="cr-bar"><i style="width:'+pct+'%"></i></div><div class="cr-next">Net worth Y '+w.toLocaleString()+' · next: '+next.icon+' '+next.name+'</div>';}
  else h+='<div class="cr-next">🌟 Top rank reached — you\'re a legend!</div>';
  h+='</div></div>';return h;}

/* ---------------- make it yours: name, decorate, collect ---------------- */
const DECOR=[{key:'planters',name:'Flower planters',emoji:'🌷',cost:150},{key:'lights',name:'String lights',emoji:'✨',cost:400},{key:'banner',name:'Welcome banner',emoji:'🎊',cost:500},{key:'fountain',name:'Fountain',emoji:'⛲',cost:900}];
const BADNAME=/(f+u+c+k|sh[i1]t|b[i1]tch|cunt|d[i1]ck|p[o0]rn|\bsex\b|nazi|rape|penis|vagina)/i;
function ensureCollected(){if(!S.collected)S.collected=[];eachLot(l=>{if(l.built&&l.type&&S.collected.indexOf(l.type)<0)S.collected.push(l.type);});}
function openMyBlock(){ensureCollected();const have=S.collected||[];const nm=(S.cityName||'').replace(/"/g,'&quot;');
  let h='<h3>🎨 My City</h3>';
  h+=careerHTML();
  h+='<div class="bg3-sec">City name</div>';
  h+='<div style="display:flex;gap:6px;margin:2px 0 12px"><input id="bg3cname" maxlength="18" placeholder="Name your city…" value="'+nm+'" style="flex:1;background:rgba(255,255,255,.08);border:1px solid rgba(227,192,90,.4);border-radius:9px;color:#F5F1E6;padding:9px 11px;font-size:14px"><button class="bg3-btn" id="bg3savename" style="width:auto;margin:0;padding:9px 15px">Save</button></div>';
  h+='<div class="bg3-sec">Decorate your block</div><div class="bg3-decor">';
  DECOR.forEach(d=>{const owned=S.decor&&S.decor[d.key];h+='<div class="bg3-dcell'+(owned?' owned':'')+'"><div class="e">'+d.emoji+'</div><div class="n">'+d.name+'</div>'+(owned?'<div class="own">✓ Placed</div>':'<button class="bg3-dbuy" data-k="'+d.key+'" '+(S.coins>=d.cost?'':'disabled')+'>Y '+d.cost+'</button>')+'</div>';});
  h+='</div>';
  h+='<div class="bg3-sec">Shop collection <b style="color:#E3C05A;float:right">'+have.length+' / '+TYPE_ORDER.length+'</b></div><div class="bg3-collect">';
  TYPE_ORDER.forEach(k=>{const t=TYPES[k];const got=have.indexOf(k)>=0;h+='<div class="bg3-ccell'+(got?' got':'')+'" title="'+t.name+'">'+(got?t.emoji:'❔')+'</div>';});
  h+='</div>';
  const allShops=have.length>=TYPE_ORDER.length;
  if(allShops&&!S.collectClaimed)h+='<button class="bg3-btn" id="bg3colreward">🏆 Collection complete! Claim +1000 Y</button>';
  else if(allShops)h+='<p style="text-align:center;color:#7ad03a;font-size:13px;font-weight:700;margin-top:8px">🏆 Full collection — nice work!</p>';
  openModal(h);
  const sv=ui.modalbody.querySelector('#bg3savename');if(sv)sv.onclick=()=>{const v=(ui.modalbody.querySelector('#bg3cname').value||'').trim().slice(0,18);if(v&&BADNAME.test(v)){toast('Please pick a friendlier name');return;}S.cityName=v;toast('City name saved!');if(S.decor&&S.decor.banner){buildCity();applyMode(mode);}saveSoon();};
  ui.modalbody.querySelectorAll('.bg3-dbuy').forEach(b=>b.onclick=()=>{const k=b.getAttribute('data-k');const d=DECOR.find(z=>z.key===k);if(!d||S.coins<d.cost)return;S.coins-=d.cost;S.decor=S.decor||{};S.decor[k]=true;toast(d.emoji+' '+d.name+' placed!');buildCity();applyMode(mode);refreshUI();saveSoon();openMyBlock();});
  const cr=ui.modalbody.querySelector('#bg3colreward');if(cr)cr.onclick=()=>{S.coins+=1000;S.collectClaimed=true;confettiBurst();toast('🏆 Collection reward! +1000 Y');refreshUI();saveSoon();openMyBlock();};
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
    const gSec=grossPerMin(l)*condMult(l)*eventMult(l)/60*dt;   // gross this frame (0 when broke; boosted during rush/lucky)
    const supSec=gSec*SUPPLY_RATE, rentSec=(gSec>0?rentPerMin(l)/60*dt:0);
    const netSec=Math.max(0,gSec-supSec-rentSec);
    const cap=storageCap(l); l.stock=Math.min(cap,(l.stock||0)+netSec);
    l.rev=(l.rev||0)+gSec; l.exp=(l.exp||0)+supSec+rentSec; l.t=Date.now();
  });
  // animate the coin counter (count-up) toward the real balance
  if(ui.coins){const target=Math.floor(S.coins);if(shownCoins!==target){const diff=target-shownCoins;shownCoins+=(Math.abs(diff)<2)?diff:diff*Math.min(1,dt*6);if(Math.abs(target-shownCoins)<1)shownCoins=target;ui.coins.textContent=Math.round(shownCoins).toLocaleString();}}
  const ts=now/1000;
  if(insideRec){
    // active shop life: serve the customer line
    const rec=insideRec;if(rec.intKeeper)rec.intKeeper.position.y=Math.abs(Math.sin(ts*1.6))*0.04;
    if(rec.intCoin)rec.intCoin.position.y=3.2+Math.sin(ts*2)*0.1;
    tickServing(dt);
    coinAcc+=dt;if(coinAcc>0.5){coinAcc=0;updateIntCoin(rec);updateLuckyUI();}
  } else {
    // stroll the customers along the sidewalk
    for(let w=0;w<walkers.length;w++){const wk=walkers[w];wk.x+=wk.dir*wk.sp*dt;
      if(wk.x>wk.max){wk.x=wk.max;wk.dir=-1;}else if(wk.x<wk.min){wk.x=wk.min;wk.dir=1;}
      wk.m.position.x=wk.x;wk.m.rotation.y=wk.dir>0?Math.PI/2:-Math.PI/2;
      wk.m.position.y=Math.abs(Math.sin(now/150+w))*0.05;}
    // smooth travel between districts
    if(traveling||Math.abs(focusX-focusXTarget)>0.01){focusX+=(focusXTarget-focusX)*Math.min(1,dt*3.2);if(Math.abs(focusX-focusXTarget)<0.05){focusX=focusXTarget;traveling=false;}updateCam();}
    // update coin bubbles ~2/sec + bob (coin + event bubbles)
    coinAcc+=dt;
    plots.forEach(rec=>{if(rec.coin)rec.coin.position.y=(rec.coinBaseY||8)+Math.sin(ts*2+rec.i)*0.12;
      if(rec.evSprite&&rec.evSprite.visible)rec.evSprite.position.y=(rec.evBaseY||9)+Math.sin(ts*2.6+rec.i)*0.16;});
    if(coinAcc>0.5){coinAcc=0;plots.forEach(rec=>{if(rec.coin)updateCoin(rec);if(rec.evSprite)updateEventSprite(rec);});updateLuckyUI();}
  }
  renderer.render(scene,camera);requestAnimationFrame(tick);
}
function resize(){if(!ui.canvaswrap)return;const w=ui.canvaswrap.clientWidth||800,h=ui.canvaswrap.clientHeight||500;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
function toggleFs(){ui.wrap.classList.toggle('fs');setTimeout(resize,60);}

/* ---------------- public API ---------------- */
function mount(el){host=el||document.getElementById('blockMount');if(!host)return;
  load();buildScene();buildUI();bindInput();resize();refreshUI();ensureDaily();
  shownCoins=Math.floor(S.coins);if(ui.coins)ui.coins.textContent=shownCoins.toLocaleString();
  window.addEventListener('resize',resize);
  // re-check day/night every few minutes
  setInterval(()=>applyMode(autoMode()),120000);
  scheduleIncoming(); // rivals start trying to raid after a couple minutes
  scheduleEvent();    // rushes / tips / restocks
  scheduleLucky();    // occasional city-wide lucky hour
  updateLuckyUI();
  ensureGoals();ensureEvent();refreshDailyBadges();refreshEventUI();refreshSpinChip();
  setTimeout(()=>{ if(!S.tut){startTour();} else { welcomeBack(); } },900); // welcome-back after tour on first run
  setInterval(()=>{S.lastSeen=Date.now();save();},20000); // heartbeat so away-time is known next visit
  setInterval(refreshEventUI,30000); // keep the event countdown fresh
  setInterval(refreshSpinChip,15000); // slot energy refills over time
  window.addEventListener('beforeunload',()=>{S.lastSeen=Date.now();save();});
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
