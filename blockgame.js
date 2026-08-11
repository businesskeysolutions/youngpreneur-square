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
function fresh(){return {v:2,coins:120,xp:0,level:1,streak:0,lastDay:'',tut:0,
  visited:{day:'',refs:{}},tokens:{},pid:uuid(),pname:'',
  lots:[{built:true,unlocked:true,type:'bakery',name:'Bakery',lvl:1,stock:0,t:Date.now(),cond:100,broke:false,rev:0,exp:0},
        {built:false,unlocked:false},{built:false,unlocked:false},{built:false,unlocked:false},{built:false,unlocked:false}]};}
let S=fresh();
function load(){try{const raw=localStorage.getItem(LS);if(raw){const o=JSON.parse(raw);if(o&&o.lots){S=Object.assign(fresh(),o);}}}catch(e){}
  while(S.lots.length<NLOTS)S.lots.push({built:false,unlocked:false});
  // backfill new business fields on older saves
  S.lots.forEach(l=>{if(l.built){if(l.cond==null)l.cond=100;l.broke=!!l.broke;l.rev=l.rev||0;l.exp=l.exp||0;}});
  // offline accrual + wear (cap wear to 1h so returning players aren't punished)
  const now=Date.now();S.lots.forEach(l=>{if(l.built){l.t=l.t||now;const el=Math.max(0,(now-l.t)/1000);
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
  buildGround();
  layoutPlots();
  applyMode(autoMode());
  camAngle=0.5; updateCam();
}
let starPts,moon;
function buildGround(){
  // sidewalk / block base
  const baseW=NLOTS*5+6;
  // large ground plane so there is no black void in front of / around the block
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(240,240),std({color:0x20242c,roughness:1}));
  ground.rotation.x=-Math.PI/2;ground.position.set(0,-0.62,40);ground.receiveShadow=true;worldGroup.add(ground);
  const walk=new THREE.Mesh(new THREE.BoxGeometry(baseW,1,10),std({color:0x6f6a60,roughness:.96}));walk.position.set(0,-0.5,0);walk.receiveShadow=true;worldGroup.add(walk);
  const curb=new THREE.Mesh(new THREE.BoxGeometry(baseW,0.5,0.6),std({color:0x8a8478}));curb.position.set(0,-0.25,5.2);worldGroup.add(curb);
  const road=new THREE.Mesh(new THREE.BoxGeometry(baseW+20,0.4,16),std({color:0x2a2f36,roughness:.98}));road.position.set(0,-0.55,14);road.receiveShadow=true;worldGroup.add(road);
  // dashes
  for(let x=-baseW/2;x<baseW/2;x+=4){const d=new THREE.Mesh(new THREE.BoxGeometry(2,0.02,0.3),std({color:0xE3C05A,emissive:0xE3C05A,emissiveIntensity:.4}));d.position.set(x+1,-0.34,14);worldGroup.add(d);emisMats.push(d.material);}
  // a couple of streetlamps
  [-baseW/2+2,baseW/2-2].forEach(x=>{const pole=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,7,8),std({color:0x2a3038}));pole.position.set(x,3,4.4);worldGroup.add(pole);
    const glo=new THREE.Mesh(new THREE.SphereGeometry(.4,10,10),std({color:0xfff2c0,emissive:0xffdf8a,emissiveIntensity:1}));glo.position.set(x,6.6,4.4);worldGroup.add(glo);emisMats.push(glo.material);
    const L=new THREE.PointLight(0xffd98a,.0,16,2);L.position.set(x,6.4,4.4);worldGroup.add(L);lamps.push(L);});
}
function plotX(i){return (i-(NLOTS-1)/2)*5;}

function layoutPlots(){
  for(let i=0;i<NLOTS;i++){
    const g=new THREE.Group();g.position.set(plotX(i),0,0);worldGroup.add(g);
    const rec={group:g,i:i,building:null,coin:null,coinTex:null,base:null};
    plots.push(rec);
    renderPlot(rec);
  }
}
function clearGroup(g){for(let k=g.children.length-1;k>=0;k--){const o=g.children[k];g.remove(o);o.traverse&&o.traverse(n=>{if(n.geometry)n.geometry.dispose();if(n.material){(Array.isArray(n.material)?n.material:[n.material]).forEach(m=>m.dispose&&m.dispose());}});}}
function renderPlot(rec){
  const g=rec.group;clearGroup(g);
  // remove this plot's clickables/emis references by rebuilding arrays lazily (kept simple: not pruning globals)
  const lot=S.lots[rec.i];
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
  // warm point light at the storefront for night glow
  const L=new THREE.PointLight(0xffd98a,0,7,2);L.position.set(0,2.6,d/2+1);g.add(L);lamps.push(L);
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
  const next=nextUnlockIndex();
  const isNext=(idx===next);
  // dashed fence posts
  const col=isNext?0xE3C05A:0x5a6a5a;
  for(let s=-1;s<=1;s+=2){const p=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,1.2,6),std({color:col,emissive:isNext?0xE3C05A:0x000000,emissiveIntensity:isNext?.4:0}));p.position.set(s*1.8,0.7,d0);g.add(p);}
  const sign=makeLotSign(idx,isNext);sign.position.set(0,1.9,d0);g.add(sign);
  sign.userData={rec,lot:true,isNext};clickable.push(sign);
  // clickable pad
  const pad=g.children.find(c=>c.geometry&&c.geometry.type==='BoxGeometry');
  if(pad){pad.userData={rec,lot:true,isNext};clickable.push(pad);}
  rec.building=null;rec.coin=null;
}
const d0=2.4;
function makeLotSign(idx,isNext){const c=document.createElement('canvas');c.width=256;c.height=128;const x=c.getContext('2d');
  x.fillStyle=isNext?'#14231a':'#0e1512';rr(x,4,4,248,120,14);x.fill();x.strokeStyle=isNext?'#E3C05A':'#4a5a4a';x.lineWidth=5;rr(x,4,4,248,120,14);x.stroke();
  x.textAlign='center';x.fillStyle=isNext?'#E3C05A':'#7a8a7a';
  if(isNext){x.font='800 30px Georgia';x.fillText('OPEN LOT',128,44);x.font='800 40px Georgia';x.fillStyle='#f6efdd';x.fillText('Y '+LOT_COST[idx],128,92);}
  else{x.font='800 30px Georgia';x.fillText('LOCKED',128,58);x.font='700 20px "Work Sans",Arial';x.fillText('reach the lot before it',128,92);}
  const t=new THREE.CanvasTexture(c);const m=std({map:t,emissiveMap:t,emissive:0xffffff,emissiveIntensity:.5,transparent:true});emisMats.push(m);
  return new THREE.Mesh(new THREE.PlaneGeometry(3,1.5),m);}
function nextUnlockIndex(){for(let i=0;i<NLOTS;i++){if(!S.lots[i].built)return i;}return -1;}
function makeGlass(){const c=document.createElement('canvas');c.width=32;c.height=32;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,32,32);g.addColorStop(0,'#d6ecff');g.addColorStop(1,'#8fb8e6');x.fillStyle=g;x.fillRect(0,0,32,32);return new THREE.CanvasTexture(c);}
const emojiCache={};
function emojiTex(e){if(emojiCache[e])return emojiCache[e];const c=document.createElement('canvas');c.width=64;c.height=64;const x=c.getContext('2d');x.font='48px serif';x.textAlign='center';x.textBaseline='middle';x.fillText(e,32,36);const t=new THREE.CanvasTexture(c);emojiCache[e]=t;return t;}

/* ---------------- camera + modes ---------------- */
let camAngle=0.5, camDist=20, camH=11;
function updateCam(){const cz=6;camera.position.set(Math.sin(camAngle)*camDist, camH, Math.cos(camAngle)*camDist + cz);camera.lookAt(0,3.2,0);}
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
     '<div class="bg3-lvl"><div class="bg3-lvlrow"><span id="bg3lvl">Lvl 1</span><span id="bg3xp">0/50 XP</span></div><div class="bg3-bar"><i id="bg3xpbar"></i></div></div>'+
     '<button class="bg3-icon" id="bg3fs" title="Fullscreen">⤢</button>'+
   '</div>'+
   '<div class="bg3-toast" id="bg3toast"></div>'+
   '<div class="bg3-modal" id="bg3modal"><div class="bg3-box"><button class="bg3-x" id="bg3x">✕</button><div id="bg3modalbody"></div></div></div>';
  host.innerHTML='';host.appendChild(wrap);
  ui.wrap=wrap;ui.canvaswrap=wrap.querySelector('.bg3-canvaswrap');
  ui.coins=wrap.querySelector('#bg3coins b');ui.streak=wrap.querySelector('#bg3streak b');
  ui.lvl=wrap.querySelector('#bg3lvl');ui.xp=wrap.querySelector('#bg3xp');ui.xpbar=wrap.querySelector('#bg3xpbar');
  ui.toast=wrap.querySelector('#bg3toast');ui.modal=wrap.querySelector('#bg3modal');ui.modalbody=wrap.querySelector('#bg3modalbody');
  ui.canvaswrap.appendChild(cv);
  wrap.querySelector('#bg3x').onclick=closeModal;
  ui.modal.addEventListener('click',e=>{if(e.target===ui.modal)closeModal();});
  wrap.querySelector('#bg3fs').onclick=toggleFs;
  injectCSS();
}
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
.bg3-toast{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);background:rgba(8,11,9,.86);border:1px solid rgba(227,192,90,.35);color:#F5F1E6;font-size:13px;padding:9px 16px;border-radius:20px;opacity:0;transition:opacity .3s,transform .3s;z-index:8;pointer-events:none;white-space:nowrap}
.bg3-toast.on{opacity:1;transform:translateX(-50%) translateY(-4px)}
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
`;document.head.appendChild(s);}

function refreshUI(){
  ui.coins.textContent=Math.floor(S.coins).toLocaleString();
  ui.streak.textContent=S.streak||0;
  ui.lvl.textContent='Lvl '+S.level;
  const need=LEVEL_XP(S.level);ui.xp.textContent=Math.floor(S.xp)+'/'+need+' XP';
  ui.xpbar.style.width=Math.min(100,(S.xp/need)*100)+'%';
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
  const obj=hits[0].object;let o=obj;while(o&&!(o.userData&&o.userData.rec))o=o.parent;if(!o)return;const rec=o.userData.rec;const lot=S.lots[rec.i];
  ensureDaily();
  if(!lot.built){ openBuild(rec); return; }
  // tap the coin bubble to quick-collect; tap the building to open its dashboard
  if(rec.coin && obj===rec.coin && !lot.broke && Math.floor(lot.stock||0)>=1){ collect(rec); return; }
  openStore(rec);
}
function collect(rec){const lot=S.lots[rec.i];const amt=Math.floor(lot.stock||0);if(amt<1)return;
  lot.stock-=amt;S.coins+=amt;gainXP(amt);flyCoin(rec);toast('+'+amt+' Y');refreshUI();saveSoon();updateCoin(rec);}
function flyCoin(rec){ if(rec.coin){rec.coin.scale.set(3.1,1.6,1);setTimeout(()=>{if(rec.coin)rec.coin.scale.set(2.6,1.32,1);},120);} }
function gainXP(n){S.xp+=n;let lvlup=false;while(S.xp>=LEVEL_XP(S.level)){S.xp-=LEVEL_XP(S.level);S.level++;lvlup=true;}if(lvlup){toast('Level up! Lvl '+S.level);}}
function openBuild(rec){const idx=rec.i;const next=nextUnlockIndex();
  if(idx!==next){openModal('<h3>Locked lot</h3><p>Open the earlier lot first — lots unlock left to right.</p>');return;}
  const cost=LOT_COST[idx];
  let cells='';TYPE_ORDER.forEach(k=>{const t=TYPES[k];const locked=t.lvlReq>S.level;
    cells+='<div class="bg3-cell'+(locked?' lock':'')+'" data-k="'+k+'"><div class="e">'+t.emoji+'</div><div class="n">'+t.name+(locked?'<br>Lvl '+t.lvlReq:'')+'</div></div>';});
  openModal('<h3>Open a new shop</h3><p>Costs <b>Y '+cost+'</b> to open this lot. Pick what to build:</p><div class="bg3-grid">'+cells+'</div><div class="bg3-toast2" id="bg3sel" style="font-size:12px;color:#E3C05A;min-height:16px;margin-top:8px"></div><button class="bg3-btn" id="bg3build" disabled>Choose a shop</button>');
  let sel=null;const btn=ui.modalbody.querySelector('#bg3build');
  ui.modalbody.querySelectorAll('.bg3-cell').forEach(c=>c.onclick=()=>{if(c.classList.contains('lock'))return;sel=c.getAttribute('data-k');
    ui.modalbody.querySelectorAll('.bg3-cell').forEach(x=>x.style.outline='');c.style.outline='2px solid #E3C05A';
    const can=S.coins>=cost;btn.disabled=!can;btn.textContent=can?('Build '+TYPES[sel].name+' · Y '+cost):('Need Y '+cost);});
  btn.onclick=()=>{if(!sel||S.coins<cost)return;S.coins-=cost;const t=TYPES[sel];lotBuild(idx,sel);toast('Opened '+t.name+'!');closeModal();refreshUI();saveSoon();};
}
function lotBuild(idx,type){const lot=S.lots[idx];lot.built=true;lot.unlocked=true;lot.type=type;lot.name=TYPES[type].name;lot.lvl=1;lot.stock=0;lot.t=Date.now();lot.cond=100;lot.broke=false;lot.rev=0;lot.exp=0;renderPlot(plots[idx]);applyMode(mode);}
function openStore(rec){const lot=S.lots[rec.i];const t=TYPES[lot.type];
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
function updateCoin(rec){if(!rec.coin)return;const lot=S.lots[rec.i];let t,vis;
  if(lot.broke){t=repairTex();vis=true;} else {const n=Math.floor(lot.stock||0);t=coinTex(n);vis=n>=1;}
  if(rec.coin.material.map&&rec.coin.material.map.dispose)rec.coin.material.map.dispose();
  rec.coin.material.map=t;rec.coin.material.needsUpdate=true;rec.coin.visible=vis;}

/* ---------------- daily / streak ---------------- */
function ensureDaily(){const td=todayStr();if(S.lastDay===td)return;
  if(S.lastDay===yStr())S.streak=(S.streak||0)+1;else S.streak=1;S.lastDay=td;
  S.lots.forEach(l=>{if(l.built){l.rev=0;l.exp=0;}}); // reset daily books
  const bonus=Math.min(120,20*S.streak);S.coins+=bonus;toast('Daily +'+bonus+' Y · streak '+S.streak);refreshUI();saveSoon();}

/* ---------------- loop ---------------- */
let last=performance.now(),coinAcc=0;
function tick(now){const dt=Math.min(.1,(now-last)/1000);last=now;
  // accrue + wear + random breakdowns + per-shop books
  S.lots.forEach(l=>{ if(!l.built)return;
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
