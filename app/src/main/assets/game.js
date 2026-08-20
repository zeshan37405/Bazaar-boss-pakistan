import * as THREE from "./three.module.min.js";
import {
  PRODUCTS,PRICE_REFERENCE,copy,productById,eventForDay,createState,shelfCapacity,marketPrice,retailPrice,marketTrend,
  buyWarehouse,takeCrate,restockShelf,createOrder,takeShelfItems,completeSale,missSale,
  dailyTarget,serveTarget,spawnDelay,checkoutDuration,staffCheckoutDuration,startNextDay,
  upgradeCost,buyUpgrade,recordQueue,cashierHireCost,cashierWage,hireCashier
} from "./sim.js";

const TEXT=window.BAZAAR_TEXT;
const SAVE_KEY="bazaarBoss3DStateV1";
const LEGACY_KEY="bazaarBossPakistanV1";
const $=id=>document.getElementById(id);
const clamp=THREE.MathUtils.clamp;
const rand=(min,max)=>min+Math.random()*(max-min);
const PRODUCT_SHELVES={
  flour:{x:-7,z:-5,side:-1},rice:{x:-7,z:0,side:-1},ghee:{x:-7,z:5,side:-1},
  oil:{x:7,z:-5,side:1},biscuit:{x:7,z:0,side:1},toffee:{x:7,z:5,side:1}
};
const EVENT_TEXT={
  normal:["eventNormal","eventNormalD"],wedding:["eventWedding","eventWeddingD"],
  ration:["eventRation","eventRationD"],school:["eventSchool","eventSchoolD"],
  inflation:["eventInflation","eventInflationD"],rush:["eventRush","eventRushD"]
};
const COLORS=[0x4f80c9,0xdf684d,0x4c9b72,0xd28a38,0x8d68ba,0x379eae,0xd55e8a];
const SKINS=[0x6f432c,0x8d5524,0xb87952,0xd39a73,0xedb98d,0xf1c7a5];

let state=loadState();
let carrying=state.carrying?copy(state.carrying):null;
let scene,camera,renderer,player,playerShadow,marketMarker,cashierMesh,cashierLabel,checkoutSign;
let started=false,currentPanel=null,currentZone=null,dayPopupTimer=null;
let cameraYaw=0,cameraPitch=.38,walkTime=0,spawnClock=1.8,worldTime=0;
let scan=null,audioContext=null,cashierCooldown=.8;
const shelves=new Map();
const packageTextureCache=new Map();
const blockers=[];
const zones=[];
const customers=[];
const checkoutQueue=[];
const worldLabels=[];
const movingDecor=[];
const keys={};
const joystick={x:0,y:0,id:null};

function loadJson(key){
  try{return JSON.parse(localStorage.getItem(key)||"null")}catch(error){return null}
}

function loadState(){return createState(loadJson(SAVE_KEY),loadJson(LEGACY_KEY))}
function save(){state.carrying=carrying?copy(carrying):null;localStorage.setItem(SAVE_KEY,JSON.stringify(state))}

function t(key,data={}){
  const language=TEXT[state.lang]||TEXT.ur;
  const value=language[key]||TEXT.ur[key]||key;
  return String(value).replace(/\{(\w+)\}/g,(_,name)=>data[name]??"");
}

function productName(id){
  const item=productById(id);
  return item.n[state.lang]||item.n.ur;
}

function productUnit(id){
  const item=productById(id);
  return item.unit[state.lang]||item.unit.ur;
}

function localNumber(value){
  const locale=state.lang==="en"?"en-PK":state.lang==="hi"?"hi-IN":"ur-PK";
  return Math.round(Number(value)||0).toLocaleString(locale);
}

function money(value){return `₨${Math.round(Number(value)||0).toLocaleString("en-PK")}`}

function applyLanguage(){
  document.documentElement.lang=state.lang;
  document.documentElement.dir=state.lang==="en"?"ltr":"rtl";
  document.querySelectorAll("[data-t]").forEach(element=>{element.textContent=t(element.dataset.t)});
  document.querySelectorAll("[data-ta]").forEach(element=>{element.setAttribute("aria-label",t(element.dataset.ta));element.title=t(element.dataset.ta)});
  document.querySelectorAll("[data-start-lang]").forEach(button=>button.classList.toggle("active",button.dataset.startLang===state.lang));
  $("startBtn").textContent=state.seen3DIntro?t("continue"):t("start");
  updateHUD();
  refreshAllShelfVisuals();
  refreshCheckoutSign();
  updateWorldLabelText();
  if(currentPanel)renderPanel(currentPanel);
}

function toast(message,duration=1500){
  const element=$("toast");
  element.textContent=message;
  element.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>element.classList.add("hidden"),duration);
}

function tone(kind="coin"){
  if(!state.sound)return;
  try{
    const Audio=window.AudioContext||window.webkitAudioContext;
    audioContext=audioContext||new Audio();
    if(audioContext.state==="suspended")audioContext.resume();
    const oscillator=audioContext.createOscillator();
    const gain=audioContext.createGain();
    oscillator.type=kind==="miss"?"sawtooth":"sine";
    oscillator.frequency.setValueAtTime(kind==="coin"?650:kind==="up"?810:190,audioContext.currentTime);
    if(kind==="coin")oscillator.frequency.exponentialRampToValueAtTime(930,audioContext.currentTime+.11);
    gain.gain.setValueAtTime(.045,audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.15);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();oscillator.stop(audioContext.currentTime+.16);
  }catch(error){}
  if(navigator.vibrate)navigator.vibrate(kind==="miss"?[35,35,35]:25);
}

function standard(color,roughness=.78){return new THREE.MeshStandardMaterial({color,roughness,metalness:.03})}
function basic(color){return new THREE.MeshBasicMaterial({color})}

function enableShadows(mesh){
  mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}

function box(parent,size,position,color,material=null){
  const mesh=enableShadows(new THREE.Mesh(new THREE.BoxGeometry(size[0],size[1],size[2]),material||standard(color)));
  mesh.position.set(position[0],position[1],position[2]);
  parent.add(mesh);
  return mesh;
}

function cylinder(parent,radius,height,position,color,segments=12){
  const mesh=enableShadows(new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,segments),standard(color)));
  mesh.position.set(position[0],position[1],position[2]);
  parent.add(mesh);
  return mesh;
}

function fakeShadow(parent,radius=.48){
  const mesh=new THREE.Mesh(new THREE.CircleGeometry(radius,18),new THREE.MeshBasicMaterial({color:0x183238,transparent:true,opacity:.19,depthWrite:false}));
  mesh.rotation.x=-Math.PI/2;mesh.position.y=.018;parent.add(mesh);return mesh;
}

function textTexture(lines,{background="#176b56",accent="#f5bd3c",foreground="#fffdf2"}={}){
  const canvas=document.createElement("canvas");canvas.width=768;canvas.height=320;
  const context=canvas.getContext("2d");
  context.fillStyle=background;context.fillRect(0,0,canvas.width,canvas.height);
  context.strokeStyle=accent;context.lineWidth=18;context.strokeRect(9,9,canvas.width-18,canvas.height-18);
  context.textAlign="center";context.textBaseline="middle";context.direction=state.lang==="en"?"ltr":"rtl";
  lines.forEach((line,index)=>{
    context.fillStyle=index===lines.length-1?accent:foreground;
    context.font=index===0?"900 74px Arial, sans-serif":index===1?"700 43px Arial, sans-serif":"800 39px Arial, sans-serif";
    context.fillText(String(line),canvas.width/2,74+index*88,canvas.width-70);
  });
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer?Math.min(4,renderer.capabilities.getMaxAnisotropy()):1;
  return texture;
}

function labelledPlane(width,height,lines,options={}){
  const texture=textTexture(lines,options);
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
  mesh.userData.texture=texture;return mesh;
}

function buildWorld(){
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x78c6df);
  scene.fog=new THREE.Fog(0x9fd3df,24,48);
  camera=new THREE.PerspectiveCamera(44,innerWidth/innerHeight,.1,90);
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.35));
  renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.08;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute("aria-label","3D supermarket");
  $("game").prepend(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xeafaff,0x8d724d,2.25));
  const sun=new THREE.DirectionalLight(0xfff4d2,2.15);sun.position.set(-8,16,12);sun.castShadow=true;
  sun.shadow.mapSize.set(768,768);sun.shadow.camera.left=-13;sun.shadow.camera.right=13;sun.shadow.camera.top=15;sun.shadow.camera.bottom=-15;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xaad5ff,.75);fill.position.set(10,7,-8);scene.add(fill);

  const floor=new THREE.Mesh(new THREE.PlaneGeometry(18,23),standard(0xf1d6a5));
  floor.rotation.x=-Math.PI/2;floor.position.z=-.1;floor.receiveShadow=true;scene.add(floor);
  const aisle=new THREE.Mesh(new THREE.PlaneGeometry(7.5,18),standard(0xf9ead0));
  aisle.rotation.x=-Math.PI/2;aisle.position.set(0,.012,-.4);scene.add(aisle);
  addFloorTiles();
  buildWalls();
  buildOutside();
  buildShelves();
  buildMarketArea();
  buildCheckout();
  buildDecoration();
  player=createHumanoid(0x247d68,0xd39a73,true,{style:"owner"});
  player.position.set(0,0,8.5);scene.add(player);
  playerShadow=player.userData.shadow;
  addWorldLabel("interact",()=>new THREE.Vector3(0,3.6,-10.55),()=>t("storeName"));
  addWorldLabel("interact",()=>new THREE.Vector3(0,2.8,10.8),()=>t("entranceLabel"));
  refreshCashierCharacter();
  camera.position.set(0,7.2,19.2);
  camera.lookAt(0,1.1,5);
}

function addFloorTiles(){
  const lineMaterial=new THREE.LineBasicMaterial({color:0xd1ae78,transparent:true,opacity:.35});
  for(let z=-10;z<=10;z+=2){
    const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-8.8,.025,z),new THREE.Vector3(8.8,.025,z)]);
    scene.add(new THREE.Line(geometry,lineMaterial));
  }
  for(let x=-8;x<=8;x+=2){
    const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x,.026,-11),new THREE.Vector3(x,.026,11)]);
    scene.add(new THREE.Line(geometry,lineMaterial));
  }
}

function buildWalls(){
  const wallMat=standard(0xfff3d9);
  box(scene,[18,3.4,.3],[0,1.7,-11],0,wallMat);
  box(scene,[.3,3.4,22],[-8.85,1.7,0],0,wallMat);
  box(scene,[.3,3.4,22],[8.85,1.7,0],0,wallMat);
  box(scene,[5.7,3.4,.22],[-6,1.7,11],0,wallMat);
  box(scene,[5.7,3.4,.22],[6,1.7,11],0,wallMat);
  box(scene,[18,.3,.3],[0,3.35,-11],0x176b56);
  box(scene,[.35,.28,22],[-8.78,3.3,0],0xd44a3d);
  box(scene,[.35,.28,22],[8.78,3.3,0],0xd44a3d);
  for(let z=-9;z<11;z+=4){
    box(scene,[.12,2.6,.12],[-8.62,1.35,z],0x176b56);
    box(scene,[.12,2.6,.12],[8.62,1.35,z],0x176b56);
  }
  const signCanvas=document.createElement("canvas");signCanvas.width=512;signCanvas.height=150;
  const context=signCanvas.getContext("2d");
  context.fillStyle="#176b56";context.fillRect(0,0,512,150);
  context.strokeStyle="#f5bd3c";context.lineWidth=14;context.strokeRect(7,7,498,136);
  context.fillStyle="#fff8df";context.textAlign="center";context.font="900 54px Arial";context.fillText("BAZAAR BOSS",256,73);
  context.fillStyle="#f5bd3c";context.font="700 25px Arial";context.fillText("PAKISTAN • SUPERMARKET 3D",256,115);
  const texture=new THREE.CanvasTexture(signCanvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(7,2.05),new THREE.MeshBasicMaterial({map:texture}));
  sign.position.set(0,3.35,-10.8);scene.add(sign);
}

function buildOutside(){
  const road=new THREE.Mesh(new THREE.PlaneGeometry(26,17),standard(0x6d7477));
  road.rotation.x=-Math.PI/2;road.position.set(0,-.02,19.4);scene.add(road);
  const curb=box(scene,[26,.18,1],[0,.08,12.25],0xd9c095);
  for(let x=-10;x<=10;x+=4)box(scene,[1.9,.035,.12],[x,.02,17],0xf4d354,basic(0xf4d354));
  const buildingColors=[0xef8466,0x5aa9b6,0xf0bd58,0x8b75ad,0x68a76f];
  for(let i=0;i<7;i++){
    const group=new THREE.Group();
    const x=-15+i*5;
    const height=rand(4,7);
    box(group,[4.3,height,3],[0,height/2,0],buildingColors[i%buildingColors.length]);
    box(group,[4.5,.32,3.2],[0,height+.14,0],0xf3e5c2);
    for(let row=0;row<2;row++)for(let col=-1;col<=1;col++)box(group,[.7,.7,.08],[col*1.15,1.4+row*1.35,-1.53],0x9dd9df,basic(0x9dd9df));
    group.position.set(x,0,27);scene.add(group);
  }
  for(const x of [-7.7,7.7]){
    const tree=new THREE.Group();
    cylinder(tree,.18,2.2,[0,1.1,0],0x7c5230,9);
    const crown=new THREE.Mesh(new THREE.DodecahedronGeometry(1.15,0),standard(0x3f8d58));crown.position.y=2.5;tree.add(crown);
    tree.position.set(x,0,13.3);scene.add(tree);
  }
  const cart=new THREE.Group();
  box(cart,[2,.85,1],[0,.65,0],0xe24f3e);box(cart,[2.3,.17,1.25],[0,1.13,0],0xf3c644);
  for(const x of [-.72,.72])cylinder(cart,.28,.18,[x,.28,.56],0x27343a,12).rotation.z=Math.PI/2;
  cart.position.set(-5.6,0,15);scene.add(cart);
}

function buildShelves(){
  for(const item of PRODUCTS){
    const layout=PRODUCT_SHELVES[item.id];
    const group=new THREE.Group();
    const backX=layout.side*.43;
    box(group,[.16,2.45,2.75],[backX,1.25,0],0x7a482f);
    for(const y of [.35,1.12,1.88])box(group,[.92,.12,2.86],[0,y,0],0xa96a3e);
    for(const z of [-1.35,1.35])box(group,[.12,2.5,.12],[0,1.25,z],0x75452f);
    box(group,[.96,.18,2.9],[0,2.48,0],item.color);
    group.position.set(layout.x,0,layout.z);scene.add(group);
    const entry={id:item.id,group,holders:new THREE.Group(),signHolder:new THREE.Group(),layout};
    group.add(entry.holders,entry.signHolder);shelves.set(item.id,entry);
    blockers.push({minX:layout.x-1.05,maxX:layout.x+1.05,minZ:layout.z-1.65,maxZ:layout.z+1.65});
    zones.push({kind:"shelf",id:item.id,x:layout.side<0?-5.55:5.55,z:layout.z,icon:item.emoji});
    addWorldLabel("shelf",()=>new THREE.Vector3(layout.x-layout.side*.78,3.22,layout.z),()=>`${item.emoji} ${productName(item.id)} • ${money(retailPrice(state,item.id))} • ${t("shelfStock",{stock:localNumber(state.shelfStock[item.id]),cap:localNumber(shelfCapacity(state))})}`);
    refreshShelfVisual(item.id);
  }
}

function packageLabelTexture(item){
  const key=`${state.lang}-${item.id}`;
  if(packageTextureCache.has(key))return packageTextureCache.get(key);
  const canvas=document.createElement("canvas");canvas.width=256;canvas.height=180;
  const context=canvas.getContext("2d");context.fillStyle="#fff8df";context.fillRect(0,0,256,180);
  context.fillStyle=`#${item.color.toString(16).padStart(6,"0")}`;context.fillRect(0,0,256,30);
  context.fillStyle="#17323a";context.textAlign="center";context.textBaseline="middle";context.direction=state.lang==="en"?"ltr":"rtl";
  context.font="900 33px Arial, sans-serif";context.fillText(productName(item.id),128,83,230);
  context.font="700 22px Arial, sans-serif";context.fillText(productUnit(item.id),128,133,230);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;packageTextureCache.set(key,texture);return texture;
}

function createProductPackage(item){
  const group=new THREE.Group();
  if(item.shape==="bag"){
    const bag=enableShadows(new THREE.Mesh(new THREE.SphereGeometry(.27,12,9),standard(item.color)));bag.scale.set(1,.92,.55);group.add(bag);
    cylinder(group,.045,.12,[0,.29,0],0x8a5a35,8);
  }else if(item.shape==="tin"){
    cylinder(group,.23,.46,[0,0,0],item.color,16);
    cylinder(group,.235,.025,[0,.24,0],0xe9e1c9,16);
  }else if(item.shape==="bottle"){
    cylinder(group,.16,.38,[0,-.03,0],item.color,14);
    cylinder(group,.085,.14,[0,.23,0],0xf2c557,12);
    cylinder(group,.09,.055,[0,.33,0],0x2f7d43,12);
  }else if(item.shape==="packet"){
    box(group,[.38,.45,.16],[0,0,0],item.color);
    box(group,[.39,.08,.165],[0,.06,0],0xf5bd3c);
  }else{
    const pouch=box(group,[.36,.44,.15],[0,0,0],item.color);
    pouch.geometry.translate(0,-.01,0);
    for(const x of [-.11,0,.11]){
      const sweet=new THREE.Mesh(new THREE.SphereGeometry(.045,7,5),standard(x===0?0xf5bd3c:0x63b9d3));sweet.position.set(x,.07,.09);group.add(sweet);
    }
  }
  const label=new THREE.Mesh(new THREE.PlaneGeometry(.31,.22),new THREE.MeshBasicMaterial({map:packageLabelTexture(item),side:THREE.DoubleSide}));
  label.position.set(0,-.01,.285);group.add(label);
  return group;
}

function refreshShelfSign(id){
  const entry=shelves.get(id);if(!entry)return;
  while(entry.signHolder.children.length){
    const old=entry.signHolder.children[0];entry.signHolder.remove(old);old.userData.texture?.dispose();old.material?.dispose();old.geometry?.dispose();
  }
  const item=productById(id);
  const sign=labelledPlane(2.55,1.03,[`${item.emoji} ${productName(id)}`,productUnit(id),`${t("sellingPrice",{price:localNumber(retailPrice(state,id))})}`],{background:"#173f39",accent:`#${item.color.toString(16).padStart(6,"0")}`});
  sign.position.set(entry.layout.side<0?.57:-.57,2.92,0);sign.rotation.y=entry.layout.side<0?Math.PI/2:-Math.PI/2;entry.signHolder.add(sign);
}

function refreshShelfVisual(id){
  const entry=shelves.get(id);if(!entry)return;
  while(entry.holders.children.length)entry.holders.remove(entry.holders.children[0]);
  const item=productById(id);
  const count=Math.min(state.shelfStock[id],18);
  for(let index=0;index<count;index++){
    const row=Math.floor(index/6),column=index%6;
    const packageMesh=createProductPackage(item);
    packageMesh.scale.setScalar(.84);
    packageMesh.position.set(entry.layout.side<0?.41:-.41,.63+row*.77,-1.05+column*.42);
    packageMesh.rotation.y=entry.layout.side<0?Math.PI/2:-Math.PI/2;
    entry.holders.add(packageMesh);
  }
  refreshShelfSign(id);
}

function refreshAllShelfVisuals(){for(const item of PRODUCTS)refreshShelfVisual(item.id)}

function buildMarketArea(){
  const market=new THREE.Group();
  box(market,[3.4,1.2,1.45],[0,.6,0],0x6f3d29);
  box(market,[3.6,.18,1.65],[0,1.25,0],0xf0b63b);
  box(market,[1.05,.8,.06],[0,1.85,-.72],0x7545a4);
  for(let i=-1;i<=1;i++){
    const sack=new THREE.Mesh(new THREE.CylinderGeometry(.29,.36,.76,10),standard(PRODUCTS[i+2].color));
    sack.position.set(i*.75,1.72,.15);market.add(sack);
  }
  market.position.set(-6,0,8.55);scene.add(market);
  blockers.push({minX:-8.2,maxX:-3.85,minZ:7.55,maxZ:9.6});
  zones.push({kind:"market",x:-3.55,z:8.75,icon:"🧺"});
  addWorldLabel("interact",()=>new THREE.Vector3(-6,2.95,8.55),()=>`🧺 ${t("supplyLabel")}`);

  const rack=new THREE.Group();
  box(rack,[1.25,2.5,3],[0,1.25,0],0x765039);
  for(const y of [.35,1.15,1.95])box(rack,[1.5,.14,3.2],[0,y,0],0xb27645);
  for(let i=0;i<5;i++)box(rack,[.75,.55,.75],[0,.68+(i%2)*.8,-1.05+(i%3)*1.03],PRODUCTS[i].color);
  rack.rotation.y=Math.PI/2;rack.position.set(-5.5,0,-10.05);scene.add(rack);
  blockers.push({minX:-7.3,maxX:-3.7,minZ:-10.75,maxZ:-9.1});
  zones.push({kind:"stockroom",x:-5.5,z:-8.35,icon:"📦"});
  addWorldLabel("interact",()=>new THREE.Vector3(-5.5,2.9,-9.65),()=>`📦 ${t("stockroom")}`);

  const marker=new THREE.Group();
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.72,.08,8,28),new THREE.MeshBasicMaterial({color:0xb86cef}));ring.rotation.x=Math.PI/2;ring.position.y=.06;marker.add(ring);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.4,.7,2.6,16,1,true),new THREE.MeshBasicMaterial({color:0xc97cff,transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false}));beam.position.y=1.3;marker.add(beam);
  marker.position.set(-3.55,0,8.75);scene.add(marker);marketMarker=marker;
}

function buildCheckout(){
  const counter=new THREE.Group();
  box(counter,[3.6,1.25,1.35],[0,.63,0],0xc66e36);
  box(counter,[3.8,.18,1.55],[0,1.32,0],0x773c25);
  box(counter,[1.45,.14,.85],[-.55,1.48,0],0x263d45);
  for(const z of [-.28,0,.28])box(counter,[.08,.025,.22],[-.55,1.565,z],0xcfd8d5,basic(0xcfd8d5));
  box(counter,[.72,.72,.16],[.77,1.85,-.15],0x263d45);
  box(counter,[.56,.48,.04],[.77,1.85,-.24],0x6fd2c8,basic(0x6fd2c8));
  box(counter,[.65,.38,.5],[1.2,1.55,.12],0xddd9ce);
  const scannerGlow=box(counter,[.32,.035,.34],[-.08,1.565,0],0x78e5da,basic(0x78e5da));scannerGlow.userData.scanner=true;
  checkoutSign=new THREE.Group();counter.add(checkoutSign);
  counter.position.set(5.8,0,8.5);scene.add(counter);
  blockers.push({minX:3.6,maxX:8.1,minZ:7.45,maxZ:9.55});
  zones.push({kind:"checkout",x:3.15,z:8.45,icon:"🧾"});
  addWorldLabel("interact",()=>new THREE.Vector3(5.8,2.65,8.5),()=>`🧾 ${t("checkoutLabel")}`);
  addWorldLabel("customer",()=>new THREE.Vector3(3.45,2.4,6.85),()=>checkoutQueue.length?`${t("queueLabel")}: ${localNumber(checkoutQueue.length)}`:t("queueLabel"));
  for(let index=0;index<6;index++){
    const marker=new THREE.Mesh(new THREE.RingGeometry(.3,.38,20),new THREE.MeshBasicMaterial({color:index?0xf0b83d:0x2cb78b,transparent:true,opacity:.55,side:THREE.DoubleSide}));
    marker.rotation.x=-Math.PI/2;marker.position.set(3.15,.035,6.85-index*1.02);scene.add(marker);
  }
  refreshCheckoutSign();
}

function refreshCheckoutSign(){
  if(!checkoutSign)return;
  while(checkoutSign.children.length){
    const old=checkoutSign.children[0];checkoutSign.remove(old);old.userData.texture?.dispose();old.material?.dispose();old.geometry?.dispose();
  }
  const sign=labelledPlane(2.5,.76,["🧾",t("checkoutLabel")],{background:"#742f27",accent:"#f5bd3c"});
  sign.position.set(0,2.5,-.7);checkoutSign.add(sign);
}

function removeCashier(){
  if(cashierMesh){scene.remove(cashierMesh);cashierMesh=null}
  if(cashierLabel){
    const index=worldLabels.indexOf(cashierLabel);if(index>=0)worldLabels.splice(index,1);
    cashierLabel.element.remove();cashierLabel=null;
  }
}

function refreshCashierCharacter(){
  if(!scene)return;
  removeCashier();
  if(!state.staff.cashier)return;
  cashierMesh=createHumanoid(0x245b88,SKINS[3],false,{style:"cashier"});
  cashierMesh.position.set(6.35,0,9.72);cashierMesh.rotation.y=Math.PI;scene.add(cashierMesh);
  cashierLabel=addWorldLabel("interact",()=>cashierMesh.position.clone().add(new THREE.Vector3(0,3.05,0)),()=>`👨‍💼 ${t("cashierLabel")} • ${localNumber(state.staff.cashier)}/2`);
}

function buildDecoration(){
  for(const x of [-3,0,3]){
    const lamp=new THREE.Group();
    cylinder(lamp,.035,1.15,[0,3.8,0],0x4b5658,8);
    const shade=new THREE.Mesh(new THREE.ConeGeometry(.52,.38,12,1,true),standard(0xf3c34b));shade.position.y=3.2;shade.rotation.x=Math.PI;lamp.add(shade);
    const glow=new THREE.PointLight(0xffd485,.45,5);glow.position.y=3.0;lamp.add(glow);
    lamp.position.set(x,0,-2);scene.add(lamp);
  }
  for(const z of [-8,8]){
    const banner=new THREE.Group();
    for(let i=-3;i<=3;i++){
      const triangle=new THREE.Mesh(new THREE.ConeGeometry(.22,.55,3),basic(i%2?0xe34c43:0x176b56));
      triangle.position.set(i*.75,3.05,0);triangle.rotation.z=Math.PI;banner.add(triangle);
    }
    banner.position.z=z;scene.add(banner);
  }
  for(const z of [-5,3]){
    const fan=new THREE.Group();
    cylinder(fan,.055,.7,[0,3.85,0],0x59676b,8);
    const rotor=new THREE.Group();rotor.position.y=3.48;
    cylinder(rotor,.13,.12,[0,0,0],0x34474d,12);
    for(let blade=0;blade<4;blade++){
      const angle=blade*Math.PI/2;
      const arm=box(rotor,[1.2,.05,.2],[Math.cos(angle)*.57,0,Math.sin(angle)*.57],0xd8c9a7);arm.rotation.y=-angle;
    }
    fan.add(rotor);fan.position.set(0,0,z);scene.add(fan);movingDecor.push(rotor);
  }
}

function createHumanoid(clothes=0x367ab7,skin=0xefb486,isPlayer=false,appearance={}){
  const group=new THREE.Group();
  const shadow=fakeShadow(group,isPlayer ? .52 : .44);
  const style=appearance.style||"customer";
  const kind=appearance.kind??Math.floor(Math.random()*4);
  const trousers=style==="cashier"?0x1d2f44:isPlayer?0xf1e4c9:[0x273d55,0x493a36,0x2d5147,0x4b4260][kind];
  const hairColor=[0x211a17,0x3d2b23,0x17191a,0x553929][kind];

  const makeLeg=x=>{
    const limb=new THREE.Group();limb.position.set(x,1.02,0);group.add(limb);
    cylinder(limb,.14,.48,[0,-.23,0],trousers,10);
    cylinder(limb,.125,.46,[0,-.66,.015],trousers,10);
    const shoe=box(limb,[.28,.15,.43],[0,-.93,.1],style==="cashier"?0x161b20:0x342b28);shoe.geometry.translate(0,0,.04);
    return limb;
  };
  const leftLeg=makeLeg(-.21),rightLeg=makeLeg(.21);

  const body=enableShadows(new THREE.Mesh(new THREE.CylinderGeometry(.41,.49,1.02,14),standard(clothes,.68)));
  body.position.y=1.48;group.add(body);
  const hem=enableShadows(new THREE.Mesh(new THREE.CylinderGeometry(.49,.54,.28,14),standard(clothes,.7)));hem.position.y=.91;group.add(hem);
  if(isPlayer){
    const waistcoat=box(group,[.66,.78,.12],[0,1.5,.43],0x173f39);waistcoat.rotation.x=-.03;
    box(group,[.045,.62,.025],[0,1.48,.505],0xf5bd3c,basic(0xf5bd3c));
  }
  if(style==="cashier"){
    box(group,[.62,.22,.06],[0,1.56,.48],0xf3f6f4);
    box(group,[.2,.13,.025],[.18,1.63,.525],0xf5bd3c,basic(0xf5bd3c));
  }

  const makeArm=x=>{
    const limb=new THREE.Group();limb.position.set(x,1.83,0);group.add(limb);
    cylinder(limb,.125,.42,[0,-.2,0],clothes,10);
    cylinder(limb,.1,.42,[0,-.57,.015],skin,10);
    const hand=enableShadows(new THREE.Mesh(new THREE.SphereGeometry(.115,10,7),standard(skin,.76)));hand.position.set(0,-.82,.02);limb.add(hand);
    return limb;
  };
  const leftArm=makeArm(-.55),rightArm=makeArm(.55);

  if(style==="customer"&&kind===3){
    const scarf=enableShadows(new THREE.Mesh(new THREE.SphereGeometry(.41,14,10),standard(0x8c5ca7,.72)));scarf.scale.set(1,1.14,.9);scarf.position.y=2.21;group.add(scarf);
  }
  const head=enableShadows(new THREE.Mesh(new THREE.SphereGeometry(.34,18,13),standard(skin,.72)));head.scale.set(.93,1.05,.96);head.position.y=2.22;group.add(head);
  if(!(style==="customer"&&kind===3)){
    const hair=enableShadows(new THREE.Mesh(new THREE.SphereGeometry(.355,16,10,0,Math.PI*2,0,Math.PI*.55),standard(hairColor,.9)));hair.position.y=2.34;group.add(hair);
    if(kind===1){
      const backHair=box(group,[.5,.48,.14],[0,2.15,-.27],hairColor);backHair.rotation.x=.08;
    }
  }
  if(style==="cashier"){
    cylinder(group,.31,.11,[0,2.55,0],0x173f66,14);
    box(group,[.42,.04,.22],[0,2.56,.23],0x173f66);
  }else if(isPlayer){
    const cap=enableShadows(new THREE.Mesh(new THREE.CylinderGeometry(.25,.34,.25,16),standard(0xf4eee0)));cap.position.y=2.52;group.add(cap);
  }

  for(const x of [-.115,.115]){
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.042,9,6),basic(0xffffff));eye.position.set(x,2.27,.316);group.add(eye);
    const pupil=new THREE.Mesh(new THREE.SphereGeometry(.021,8,5),basic(0x171b1c));pupil.position.set(x,2.27,.352);group.add(pupil);
  }
  const nose=enableShadows(new THREE.Mesh(new THREE.ConeGeometry(.052,.13,8),standard(skin,.75)));nose.rotation.x=Math.PI/2;nose.position.set(0,2.17,.365);group.add(nose);
  const mouth=box(group,[.14,.025,.025],[0,2.07,.343],0x8f403b,basic(0x8f403b));mouth.rotation.z=kind%2?.08:-.05;
  for(const x of [-.35,.35]){
    const ear=new THREE.Mesh(new THREE.SphereGeometry(.07,8,5),standard(skin));ear.scale.set(.5,1,.55);ear.position.set(x,2.22,0);group.add(ear);
  }

  group.traverse(child=>{if(child.isMesh){child.castShadow=true;child.receiveShadow=true}});
  group.userData={leftLeg,rightLeg,leftArm,rightArm,body,hem,head,shadow,bodyBaseY:1.48,hemBaseY:.91,moving:false,phase:Math.random()*6,style};
  return group;
}

function addWorldLabel(cssClass,position,text){
  const element=document.createElement("div");element.className=`world-label ${cssClass}`;
  $("worldLabels").appendChild(element);
  const label={element,position,text};worldLabels.push(label);return label;
}

function updateWorldLabelText(){for(const label of worldLabels)label.element.textContent=label.text()}

function updateLabels(){
  if(!camera||!started)return;
  const width=innerWidth,height=innerHeight;
  for(const label of worldLabels){
    const point=label.position().clone();point.project(camera);
    const visible=point.z>-1&&point.z<1&&Math.abs(point.x)<1.2&&Math.abs(point.y)<1.25;
    label.element.style.opacity=visible?"1":"0";
    if(visible){label.element.style.left=`${(point.x*.5+.5)*width}px`;label.element.style.top=`${(-point.y*.5+.5)*height}px`}
  }
}

function makeCustomer(){
  const order=createOrder(state);
  const kind=Math.floor(Math.random()*4);
  const mesh=createHumanoid(COLORS[Math.floor(Math.random()*COLORS.length)],SKINS[Math.floor(Math.random()*SKINS.length)],false,{style:"customer",kind});
  mesh.scale.setScalar(rand(.88,1.04));mesh.position.set(rand(-.35,.35),0,13.5);scene.add(mesh);
  const shelf=PRODUCT_SHELVES[order.product];
  const accessX=shelf.side<0?-5.55:5.55;
  const customer={mesh,order,phase:"enter",path:[new THREE.Vector3(0,0,10),new THREE.Vector3(0,0,shelf.z),new THREE.Vector3(accessX,0,shelf.z)],pathIndex:0,speed:rand(1.5,1.9),timer:0,waited:0,label:null};
  customer.label=addWorldLabel("customer",()=>customer.mesh.position.clone().add(new THREE.Vector3(0,2.75,0)),()=>customerLabelText(customer));
  customers.push(customer);
}

function customerLabelText(customer){
  if(customer.phase==="queue")return `${productById(customer.order.product).emoji} ${t("items",{quantity:localNumber(customer.order.quantity),item:productName(customer.order.product)})} • ${t("queueWait",{seconds:localNumber(Math.floor(customer.waited))})}`;
  if(customer.phase==="scanning")return `🧾 ${t("scanning")}`;
  return `${productById(customer.order.product).emoji} ${t("items",{quantity:localNumber(customer.order.quantity),item:productName(customer.order.product)})}`;
}

function setCustomerPath(customer,points,phase){customer.path=points;customer.pathIndex=0;customer.phase=phase}

function updateCustomer(customer,delta){
  if(["enter","toCheckout","leaving"].includes(customer.phase))moveCustomer(customer,delta);
  else if(customer.phase==="shopping"){
    const reach=Math.sin(worldTime*7)*.12;customer.mesh.userData.leftArm.rotation.x=-1.15+reach;customer.mesh.userData.rightArm.rotation.x=-1.05-reach;
    customer.timer-=delta;
    if(customer.timer<=0)finishShopping(customer);
  }else if(customer.phase==="queue"){
    const index=checkoutQueue.indexOf(customer);
    if(index<0)return;
    const target=new THREE.Vector3(3.15,0,6.9-index*1.05);
    moveToward(customer,target,delta*1.55);
    customer.waited+=delta;
    customer.label.element.textContent=customerLabelText(customer);
  }
}

function moveCustomer(customer,delta){
  const target=customer.path[customer.pathIndex];
  if(!target){customerPathFinished(customer);return}
  if(moveToward(customer,target,delta*customer.speed)){
    customer.pathIndex++;
    if(customer.pathIndex>=customer.path.length)customerPathFinished(customer);
  }
}

function moveToward(customer,target,distance){
  const current=customer.mesh.position;
  const dx=target.x-current.x,dz=target.z-current.z;
  const length=Math.hypot(dx,dz);
  if(length<.08){current.x=target.x;current.z=target.z;animateHumanoid(customer.mesh,false,0);return true}
  const step=Math.min(length,distance);current.x+=dx/length*step;current.z+=dz/length*step;
  customer.mesh.rotation.y=Math.atan2(dx,dz);
  animateHumanoid(customer.mesh,true,worldTime*6+customer.mesh.userData.phase);
  return length<=distance+.08;
}

function customerPathFinished(customer){
  if(customer.phase==="enter"){customer.phase="shopping";customer.timer=1.05;animateHumanoid(customer.mesh,false,0);return}
  if(customer.phase==="toCheckout"){
    customer.phase="queue";customer.waited=0;checkoutQueue.push(customer);recordQueue(state,checkoutQueue.length);save();updateHUD();updateWorldLabelText();return;
  }
  if(customer.phase==="leaving")removeCustomer(customer);
}

function finishShopping(customer){
  animateHumanoid(customer.mesh,false,0);
  const okay=takeShelfItems(state,customer.order);
  if(okay){
    refreshShelfVisual(customer.order.product);
    attachCustomerBasket(customer);
    setCustomerPath(customer,[new THREE.Vector3(0,0,customer.mesh.position.z),new THREE.Vector3(0,0,6.6),new THREE.Vector3(2.75,0,6.8)],"toCheckout");
    save();updateHUD();updateWorldLabelText();
  }else{
    const result=missSale(state,1);
    toast(t("shelfEmpty",{item:productName(customer.order.product)}),1900);tone("miss");
    sendCustomerOut(customer);finishDayIfNeeded(result);save();updateHUD();
  }
}

function attachCustomerBasket(customer){
  if(customer.mesh.getObjectByName("shopping-basket"))return;
  const basket=new THREE.Group();basket.name="shopping-basket";
  box(basket,[.65,.32,.42],[0,0,0],0xd14c3f);
  for(const x of [-.2,0,.2])box(basket,[.045,.36,.44],[x,0,0],0xf0b23b,basic(0xf0b23b));
  const handle=new THREE.Mesh(new THREE.TorusGeometry(.31,.035,7,18,Math.PI),standard(0x5c3828));handle.rotation.z=Math.PI;handle.position.y=.28;basket.add(handle);
  const item=createProductPackage(productById(customer.order.product));item.scale.setScalar(.7);item.position.set(0,.28,0);basket.add(item);
  basket.position.set(0,1.03,.5);basket.rotation.x=-.08;customer.mesh.add(basket);
}

function sendCustomerOut(customer){
  setCustomerPath(customer,[new THREE.Vector3(0,0,Math.max(8.8,customer.mesh.position.z)),new THREE.Vector3(0,0,13.6)],"leaving");
}

function removeCustomer(customer){
  const queueIndex=checkoutQueue.indexOf(customer);if(queueIndex>=0)checkoutQueue.splice(queueIndex,1);
  const index=customers.indexOf(customer);if(index>=0)customers.splice(index,1);
  const labelIndex=worldLabels.indexOf(customer.label);if(labelIndex>=0)worldLabels.splice(labelIndex,1);
  customer.label.element.remove();scene.remove(customer.mesh);
}

function clearCustomers(){
  scan=null;$("scanBox").classList.add("hidden");
  for(const customer of [...customers])removeCustomer(customer);
  checkoutQueue.length=0;
}

function animateHumanoid(mesh,moving,phase){
  const data=mesh.userData;if(!data?.leftLeg)return;
  const swing=moving?Math.sin(phase)*.48:0;
  data.leftLeg.rotation.x=swing;data.rightLeg.rotation.x=-swing;
  data.leftArm.rotation.x=-swing*.7;data.rightArm.rotation.x=swing*.7;
  const bounce=moving?Math.abs(Math.sin(phase*2))*.035:0;
  data.body.position.y=data.bodyBaseY+bounce;data.hem.position.y=data.hemBaseY+bounce;
}

function animateCashier(delta){
  if(!cashierMesh)return;
  const data=cashierMesh.userData;
  if(scan?.auto){
    const wave=Math.sin(worldTime*8)*.16;
    data.leftArm.rotation.x=-1.12+wave;data.rightArm.rotation.x=-.92-wave;
    data.leftArm.rotation.z=.18;data.rightArm.rotation.z=-.18;
  }else{
    data.leftArm.rotation.x+=(0-data.leftArm.rotation.x)*Math.min(1,delta*5);
    data.rightArm.rotation.x+=(0-data.rightArm.rotation.x)*Math.min(1,delta*5);
    data.leftArm.rotation.z*=Math.max(0,1-delta*5);data.rightArm.rotation.z*=Math.max(0,1-delta*5);
  }
}

function countPendingCustomers(){return customers.filter(customer=>!["leaving"].includes(customer.phase)).length}

function updateSpawning(delta){
  if(state.dayComplete)return;
  spawnClock-=delta;
  const allocated=state.handledToday+countPendingCustomers();
  if(spawnClock<=0&&allocated<dailyTarget(state)){
    makeCustomer();spawnClock=spawnDelay(state)*rand(.78,1.08);updateWorldLabelText();
  }
}

function startScanning(auto=false){
  if(scan)return;
  const customer=checkoutQueue[0];
  if(!customer){if(!auto)toast(t("noCustomer"));return}
  checkoutQueue.shift();customer.phase="scanning";animateHumanoid(customer.mesh,false,0);
  scan={customer,elapsed:0,duration:auto?staffCheckoutDuration(state):checkoutDuration(state),auto};
  $("scanText").textContent=auto?t("autoScanning"):t("scanning");
  $("scanFill").style.width="0%";$("scanBox").classList.remove("hidden");
  tone("up");updateHUD();updateWorldLabelText();
}

function updateAutomaticCheckout(delta){
  if(!state.staff.cashier||state.dayComplete)return;
  if(scan){cashierCooldown=.65;return}
  cashierCooldown-=delta;
  if(cashierCooldown<=0&&checkoutQueue.length){startScanning(true);cashierCooldown=.65}
}

function updateScan(delta){
  if(!scan)return;
  scan.elapsed+=delta;
  const ratio=Math.min(1,scan.elapsed/scan.duration);$("scanFill").style.width=`${ratio*100}%`;
  if(ratio<1)return;
  const customer=scan.customer;const automatic=scan.auto;scan=null;$("scanBox").classList.add("hidden");
  const result=completeSale(state,customer.order);
  toast(t("saleDone",{price:money(customer.order.price).replace("₨","")}));tone("coin");
  if(state.tutorialStep===4){state.tutorialStep=5;toast(t("tutorialDone"),2300)}
  if(automatic)cashierCooldown=.65;
  sendCustomerOut(customer);finishDayIfNeeded(result);save();updateHUD();updateWorldLabelText();
}

function finishDayIfNeeded(result){
  if(!result)return;
  clearTimeout(dayPopupTimer);
  dayPopupTimer=setTimeout(showDaySummary,850);
}

function showDaySummary(){
  if(!state.dayComplete||!state.lastDay)return;
  closePanel();
  const summary=state.lastDay;
  $("dayResultIcon").textContent=summary.success?"🏆":"📋";
  $("dayTitle").textContent=t("dayComplete",{day:localNumber(summary.day)});
  $("dayResult").textContent=summary.success?t("goalWon",{reward:localNumber(summary.reward)}):t("goalLost");
  $("sumServed").textContent=localNumber(summary.served);
  $("sumMissed").textContent=localNumber(summary.missed);
  $("sumRevenue").textContent=money(summary.revenue);
  $("sumExpense").textContent=`−${money(summary.expense)}`;
  $("sumWage").textContent=summary.wage?`−${money(summary.wage)}`:money(0);
  $("sumQueue").textContent=localNumber(state.queueRecord||0);
  $("expenseWarning").classList.toggle("hidden",!summary.short);
  $("dayModal").classList.remove("hidden");
}

function nextDay(){
  clearCustomers();startNextDay(state);spawnClock=2.6;save();
  $("dayModal").classList.add("hidden");refreshAllShelfVisuals();updateHUD();updateWorldLabelText();tone("up");
}

function blocked(x,z){
  const radius=.42;
  if(x<-8.25+radius||x>8.25-radius||z<-10.45+radius||z>10.55-radius)return true;
  return blockers.some(rect=>x+radius>rect.minX&&x-radius<rect.maxX&&z+radius>rect.minZ&&z-radius<rect.maxZ);
}

function updatePlayer(delta){
  let inputX=joystick.x+(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0);
  let inputForward=-joystick.y+(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0);
  const magnitude=Math.hypot(inputX,inputForward);
  if(magnitude>.05){
    inputX/=Math.max(1,magnitude);inputForward/=Math.max(1,magnitude);
    const forwardX=Math.sin(cameraYaw),forwardZ=-Math.cos(cameraYaw);
    const rightX=Math.cos(cameraYaw),rightZ=Math.sin(cameraYaw);
    const dx=(rightX*inputX+forwardX*inputForward)*delta*3.2;
    const dz=(rightZ*inputX+forwardZ*inputForward)*delta*3.2;
    const nextX=player.position.x+dx,nextZ=player.position.z+dz;
    if(!blocked(nextX,player.position.z))player.position.x=nextX;
    if(!blocked(player.position.x,nextZ))player.position.z=nextZ;
    player.rotation.y=Math.atan2(dx,dz);
    walkTime+=delta*8.2;animateHumanoid(player,true,walkTime);
  }else animateHumanoid(player,false,0);
  updateCarriedCrate();
}

function updateCamera(delta){
  if(!player||!camera)return;
  const distance=state.cameraDistance,height=4.8+cameraPitch*5.2;
  const desired=new THREE.Vector3(player.position.x+Math.sin(cameraYaw)*distance,height,player.position.z+Math.cos(cameraYaw)*distance);
  camera.position.lerp(desired,1-Math.pow(.002,delta));
  const target=new THREE.Vector3(player.position.x,1.05,player.position.z-1.1);
  camera.lookAt(target);
}

function updateCarriedCrate(){
  if(!player)return;
  const old=player.getObjectByName("carried-crate");
  if(!carrying){if(old)player.remove(old);return}
  if(old&&old.userData.id===carrying.id)return;
  if(old)player.remove(old);
  const item=productById(carrying.id);const crate=new THREE.Group();crate.name="carried-crate";crate.userData.id=carrying.id;
  box(crate,[.78,.55,.62],[0,0,0],0x9c6338);
  box(crate,[.58,.38,.64],[0,.09,0],item.color);
  crate.position.set(0,1.18,.55);player.add(crate);
}

function updateInteractions(){
  let nearest=null,best=Infinity;
  for(const zone of zones){
    const distance=Math.hypot(player.position.x-zone.x,player.position.z-zone.z);
    if(distance<best){best=distance;nearest=zone}
  }
  currentZone=best<2.15?nearest:null;
  const button=$("actionBtn"),icon=$("actionIcon"),label=$("actionText");
  button.classList.toggle("disabled",!currentZone);
  if(!currentZone){icon.textContent="👣";label.textContent=t("walkCloser");return}
  icon.textContent=currentZone.icon;
  if(currentZone.kind==="market")label.textContent=t("openMarket");
  else if(currentZone.kind==="stockroom")label.textContent=t("openStockroom");
  else if(currentZone.kind==="checkout")label.textContent=t("checkout");
  else label.textContent=t("restock");
}

function interact(){
  if(!started||isPaused(false))return;
  if(!currentZone){toast(t("walkCloser"));return}
  if(currentZone.kind==="market"){
    if(state.tutorialStep===0)state.tutorialStep=1;
    save();updateHUD();openPanel("market");return;
  }
  if(currentZone.kind==="stockroom"){openPanel("stockroom");return}
  if(currentZone.kind==="checkout"){startScanning();return}
  if(currentZone.kind==="shelf")restockAtShelf(currentZone.id);
}

function restockAtShelf(id){
  if(!carrying){toast(t("notCarrying"));return}
  if(carrying.id!==id){toast(t("wrongShelf"));tone("miss");return}
  const item=productById(id);const result=restockShelf(state,carrying);
  if(!result.ok){toast(t(result.reason));return}
  toast(t("restocked",{amount:localNumber(result.amount),item:productName(id)}));tone("coin");
  if(result.empty)carrying=null;
  if(state.tutorialStep===3)state.tutorialStep=4;
  refreshShelfVisual(id);save();updateHUD();updateWorldLabelText();updateCarriedCrate();
}

function updateHUD(){
  if(!TEXT)return;
  $("cash").textContent=money(state.cash);$("rep").textContent=`${localNumber(state.rep)}%`;$("dayNo").textContent=localNumber(state.day);
  $("queueCount").textContent=localNumber(checkoutQueue.length+(scan?1:0));
  const event=eventForDay(state.day);const eventKeys=EVENT_TEXT[event.id]||EVENT_TEXT.normal;
  $("eventEmoji").textContent=event.emoji;$("eventTitle").textContent=t(eventKeys[0]);$("eventDesc").textContent=t(eventKeys[1]);
  const goal=serveTarget(state);$("missionText").textContent=t("goalText",{served:localNumber(state.servedToday),target:localNumber(goal)});
  $("missionFill").style.width=`${Math.min(100,state.servedToday/goal*100)}%`;
  const tutorialKey=state.tutorialStep>=5?"tutorialDone":`tutorial${state.tutorialStep}`;
  $("tutorialText").textContent=t(tutorialKey);$("tutorial").classList.toggle("hidden",state.tutorialStep>5);
  $("carrying").classList.toggle("hidden",!carrying);
  if(carrying)$("carryingText").textContent=t("carrying",{amount:localNumber(carrying.amount),item:productName(carrying.id)});
  const low=PRODUCTS.filter(item=>state.shelfStock[item.id]<=2).map(item=>productName(item.id));
  $("lowStock").classList.toggle("hidden",!low.length);
  if(low.length)$("lowStockText").textContent=t("lowStock",{items:low.join("، ")});
  $("staffBtn").classList.toggle("staff-active",Boolean(state.staff.cashier));
  if(marketMarker)marketMarker.visible=state.tutorialStep<=1;
}

function openPanel(type){currentPanel=type;renderPanel(type);$("modalShade").classList.remove("hidden")}
function closePanel(){currentPanel=null;$("modalShade").classList.add("hidden")}

function panelFrame(icon,title,html){$("panelIcon").textContent=icon;$("panelTitle").textContent=title;$("panelBody").innerHTML=html}

function renderPanel(type){
  if(type==="market")renderMarket();
  else if(type==="stockroom")renderStockroom();
  else if(type==="upgrades")renderUpgrades();
  else if(type==="staff")renderStaff();
  else renderSettings();
}

function renderMarket(){
  const cards=PRODUCTS.map(item=>{
    const price=marketPrice(state,item.id),trend=marketTrend(state,item.id),cost=price*3;
    return `<article class="product-card"><div class="product-art">${item.emoji}</div><div class="card-copy"><strong>${productName(item.id)}</strong><small>${t("packageUnit",{unit:productUnit(item.id)})}</small><small>${t("unitPrice",{price:localNumber(price)})} • ${t("sellingPrice",{price:localNumber(retailPrice(state,item.id))})}</small><small>${t("warehouseStock",{count:localNumber(state.warehouse[item.id])})}</small><i class="trend ${trend}">${t(trend)}</i></div><button class="card-btn" data-buy="${item.id}" ${state.cash<cost?"disabled":""}>${t("buyThree")}<br>${money(cost)}</button></article>`;
  }).join("");
  panelFrame("🧺",t("market"),`<p class="panel-note">${t("marketHint")}</p><p class="panel-note price-note">📊 ${t("priceReference",{date:PRICE_REFERENCE.asOf})}<br>🔄 ${t("priceChangesDaily")}</p><div class="card-list">${cards}</div>`);
  $("panelBody").querySelectorAll("[data-buy]").forEach(button=>button.addEventListener("click",()=>{
    const id=button.dataset.buy;const result=buyWarehouse(state,id,3);
    if(!result.ok){toast(t(result.reason));tone("miss");return}
    if(state.tutorialStep===1)state.tutorialStep=2;
    toast(t("bought",{amount:localNumber(result.amount),item:productName(id)}));tone("coin");save();updateHUD();renderMarket();
  }));
}

function renderStaff(){
  const level=state.staff.cashier,cost=cashierHireCost(state),wage=cashierWage(state),max=level>=2;
  const action=max?t("staffMaxed"):level?t("upgradeCashier"):t("hireCashier");
  const status=level?`<small class="active-staff">✓ ${t("automaticCheckout")}</small>`:"";
  const button=max?`<button class="card-btn green" disabled>${t("maxed")}</button>`:`<button class="card-btn green" id="hireCashierBtn" ${state.cash<cost?"disabled":""}>${action}<br>${money(cost)}</button>`;
  const card=`<article class="upgrade-card"><div class="product-art">👨‍💼</div><div class="card-copy"><strong>${t("cashier")}</strong><small>${t("cashierDesc")}</small><small>${t("cashierLevel",{level:localNumber(level)})}</small><small>${t("dailyWage",{wage:localNumber(wage)})}</small>${status}</div>${button}</article>`;
  panelFrame("👨‍💼",t("staff"),`<p class="panel-note">${t("staffHint")}</p><div class="card-list">${card}</div>`);
  const hireButton=$("hireCashierBtn");if(!hireButton)return;
  hireButton.addEventListener("click",()=>{
    const result=hireCashier(state);
    if(!result.ok){toast(t(result.reason));tone("miss");return}
    cashierCooldown=.5;refreshCashierCharacter();save();updateHUD();updateWorldLabelText();toast(t("staffHired"),2200);tone("up");renderStaff();
  });
}

function renderStockroom(){
  const available=PRODUCTS.filter(item=>state.warehouse[item.id]>0);
  let cards=available.map(item=>`<article class="product-card"><div class="product-art">${item.emoji}</div><div class="card-copy"><strong>${productName(item.id)}</strong><small>${t("warehouseStock",{count:localNumber(state.warehouse[item.id])})}</small></div><button class="card-btn green" data-pick="${item.id}" ${carrying?"disabled":""}>${t("pick")}</button></article>`).join("");
  if(!cards)cards=`<p class="panel-note">${t("warehouseEmpty")}</p>`;
  const carryNote=carrying?`<p class="panel-note">${t("carrying",{amount:localNumber(carrying.amount),item:productName(carrying.id)})}</p>`:"";
  panelFrame("📦",t("stockroom"),`${carryNote}<p class="panel-note">${t("stockroomHint")}</p><div class="card-list">${cards}</div>`);
  $("panelBody").querySelectorAll("[data-pick]").forEach(button=>button.addEventListener("click",()=>{
    if(carrying)return;
    const result=takeCrate(state,button.dataset.pick);
    if(!result.ok){toast(t(result.reason));return}
    carrying={id:result.id,amount:result.amount};
    if(state.tutorialStep===2)state.tutorialStep=3;
    toast(t("picked",{amount:localNumber(result.amount),item:productName(result.id)}));tone("up");save();updateHUD();updateCarriedCrate();closePanel();
  }));
}

function levelBars(level){return `<div class="level-bars">${[1,2,3].map(value=>`<i class="${value<=level?"on":""}"></i>`).join("")}</div>`}

function renderUpgrades(){
  const data={
    capacity:["🗄️","capacity","capacityDesc"],checkout:["⚡","checkoutSpeed","checkoutDesc"],decor:["✨","decor","decorDesc"]
  };
  const cards=Object.entries(data).map(([key,info])=>{
    const level=state.upgrades[key],max=level>=3,cost=upgradeCost(state,key);
    return `<article class="upgrade-card"><div class="product-art">${info[0]}</div><div class="card-copy"><strong>${t(info[1])}</strong><small>${t(info[2])}</small><small>${t("level",{level:localNumber(level)})}</small>${levelBars(level)}</div><button class="card-btn green" data-upgrade="${key}" ${max||state.cash<cost?"disabled":""}>${max?t("maxed"):`${t("upgrade")}<br>${money(cost)}`}</button></article>`;
  }).join("");
  panelFrame("⬆️",t("upgrades"),`<p class="panel-note">${t("upgradeHint")}</p><div class="card-list">${cards}</div>`);
  $("panelBody").querySelectorAll("[data-upgrade]").forEach(button=>button.addEventListener("click",()=>{
    const result=buyUpgrade(state,button.dataset.upgrade);
    if(!result.ok){toast(t(result.reason));tone("miss");return}
    toast(t("upgraded"));tone("up");save();refreshAllShelfVisuals();updateHUD();updateWorldLabelText();renderUpgrades();
  }));
}

function renderSettings(){
  const languageButtons=`<div class="choice-grid"><button data-lang="ur" class="${state.lang==="ur"?"active":""}">اردو</button><button data-lang="hi" class="${state.lang==="hi"?"active":""}">हिन्दी</button><button data-lang="en" class="${state.lang==="en"?"active":""}">English</button></div>`;
  const difficulties=["easy","normal","hard"].map(level=>`<button data-difficulty="${level}" class="${state.difficulty===level?"active":""}">${t(level)}</button>`).join("");
  const soundButtons=`<div class="choice-grid wide-choice"><button data-sound="on" class="${state.sound?"active":""}">${t("on")}</button><button data-sound="off" class="${!state.sound?"active":""}">${t("off")}</button></div>`;
  panelFrame("⚙️",t("settings"),`<section class="settings-section"><h3>${t("language")}</h3>${languageButtons}</section><section class="settings-section"><h3>${t("difficulty")}</h3><div class="choice-grid">${difficulties}</div></section><section class="settings-section"><h3>${t("sound")}</h3>${soundButtons}</section><button id="resetBtn" class="danger">${t("reset")}</button>`);
  $("panelBody").querySelectorAll("[data-lang]").forEach(button=>button.addEventListener("click",()=>{state.lang=button.dataset.lang;save();applyLanguage()}));
  $("panelBody").querySelectorAll("[data-difficulty]").forEach(button=>button.addEventListener("click",()=>{state.difficulty=button.dataset.difficulty;save();updateHUD();renderSettings()}));
  $("panelBody").querySelectorAll("[data-sound]").forEach(button=>button.addEventListener("click",()=>{state.sound=button.dataset.sound==="on";save();renderSettings();if(state.sound)tone("up")}));
  $("resetBtn").addEventListener("click",()=>{
    if(!confirm(t("resetConfirm")))return;
    localStorage.removeItem(SAVE_KEY);state=createState(null,null);carrying=null;clearCustomers();player.position.set(0,0,8.5);spawnClock=1.8;cashierCooldown=.8;refreshAllShelfVisuals();refreshCashierCharacter();save();closePanel();applyLanguage();updateCarriedCrate();
  });
}

function isPaused(includeStart=true){return (includeStart&&!started)||currentPanel!==null||!$("dayModal").classList.contains("hidden")}

function startGame(){
  state.seen3DIntro=true;save();started=true;
  $("startOverlay").classList.add("hidden");$("hud").classList.remove("hidden");$("controls").classList.remove("hidden");
  if(state.dayComplete)setTimeout(showDaySummary,350);
  tone("up");
}

function setupControls(){
  $("startBtn").addEventListener("click",startGame);
  document.querySelectorAll("[data-start-lang]").forEach(button=>button.addEventListener("click",()=>{state.lang=button.dataset.startLang;save();applyLanguage()}));
  $("settingsBtn").addEventListener("click",()=>openPanel("settings"));
  $("marketBtn").addEventListener("click",()=>{
    const distance=Math.hypot(player.position.x+3.55,player.position.z-8.75);
    if(distance<2.4){
      if(state.tutorialStep===0)state.tutorialStep=1;
      save();updateHUD();openPanel("market");
    }else{toast(t("walkCloser"));marketMarker.visible=true}
  });
  $("upgradesBtn").addEventListener("click",()=>openPanel("upgrades"));
  $("staffBtn").addEventListener("click",()=>openPanel("staff"));
  $("actionBtn").addEventListener("click",interact);
  $("panelClose").addEventListener("click",closePanel);
  $("modalShade").addEventListener("click",event=>{if(event.target===$("modalShade"))closePanel()});
  $("nextDayBtn").addEventListener("click",nextDay);

  const base=$("joystick"),nub=$("joystickNub");
  const moveJoystick=event=>{
    if(event.pointerId!==joystick.id)return;
    const rect=base.getBoundingClientRect(),centerX=rect.left+rect.width/2,centerY=rect.top+rect.height/2,max=rect.width*.34;
    let dx=event.clientX-centerX,dy=event.clientY-centerY;const length=Math.hypot(dx,dy);
    if(length>max){dx=dx/length*max;dy=dy/length*max}
    joystick.x=dx/max;joystick.y=dy/max;nub.style.transform=`translate(${dx}px,${dy}px)`;
  };
  base.addEventListener("pointerdown",event=>{joystick.id=event.pointerId;base.setPointerCapture(event.pointerId);moveJoystick(event);event.preventDefault()});
  base.addEventListener("pointermove",moveJoystick);
  const releaseJoystick=event=>{if(event.pointerId!==joystick.id)return;joystick.id=null;joystick.x=0;joystick.y=0;nub.style.transform="translate(0,0)"};
  base.addEventListener("pointerup",releaseJoystick);base.addEventListener("pointercancel",releaseJoystick);

  let drag=null,pinchDistance=0;
  const cameraPointers=new Map();
  renderer.domElement.addEventListener("pointerdown",event=>{
    if(!started||isPaused(false))return;
    cameraPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    renderer.domElement.setPointerCapture(event.pointerId);
    if(cameraPointers.size===1)drag={id:event.pointerId,x:event.clientX,y:event.clientY};
    if(cameraPointers.size===2){const points=[...cameraPointers.values()];pinchDistance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);drag=null}
  });
  renderer.domElement.addEventListener("pointermove",event=>{
    if(!cameraPointers.has(event.pointerId))return;
    cameraPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(cameraPointers.size>=2){
      const points=[...cameraPointers.values()],distance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);
      state.cameraDistance=clamp(state.cameraDistance-(distance-pinchDistance)*.018,8.8,14);pinchDistance=distance;event.preventDefault();return;
    }
    if(!drag||drag.id!==event.pointerId)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;drag.x=event.clientX;drag.y=event.clientY;
    cameraYaw-=dx*.009;cameraPitch=clamp(cameraPitch+dy*.003,.12,.72);event.preventDefault();
  });
  const endDrag=event=>{
    cameraPointers.delete(event.pointerId);
    if(cameraPointers.size===1){const [id,point]=cameraPointers.entries().next().value;drag={id,x:point.x,y:point.y}}
    else drag=null;
    save();
  };
  renderer.domElement.addEventListener("pointerup",endDrag);renderer.domElement.addEventListener("pointercancel",endDrag);
  renderer.domElement.addEventListener("wheel",event=>{state.cameraDistance=clamp(state.cameraDistance+Math.sign(event.deltaY)*.6,8.8,14);save();event.preventDefault()},{passive:false});
  addEventListener("keydown",event=>{keys[event.code]=true;if(event.code==="KeyE"||event.code==="Space"){event.preventDefault();interact()}if(event.code==="Escape")closePanel()});
  addEventListener("keyup",event=>{keys[event.code]=false});
  addEventListener("resize",onResize);
  document.addEventListener("visibilitychange",()=>{if(document.hidden){joystick.x=0;joystick.y=0}});
}

function onResize(){if(!camera||!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.35))}

function animate(time){
  requestAnimationFrame(animate);
  const delta=Math.min(.05,Math.max(.001,(time-(animate.last||time))/1000));animate.last=time;worldTime+=delta;
  if(marketMarker){marketMarker.rotation.y+=delta*.75;marketMarker.position.y=Math.sin(worldTime*2.2)*.08}
  for(const rotor of movingDecor)rotor.rotation.y+=delta*3.2;
  if(started&&!isPaused(false)){
    updatePlayer(delta);updateSpawning(delta);
    for(const customer of [...customers])updateCustomer(customer,delta);
    updateAutomaticCheckout(delta);updateScan(delta);animateCashier(delta);updateInteractions();
  }
  updateCamera(delta);updateLabels();renderer.render(scene,camera);
}

function initialize(){
  try{
    buildWorld();setupControls();applyLanguage();updateHUD();updateInteractions();updateCarriedCrate();
    $("loading").classList.add("hidden");
    requestAnimationFrame(animate);
  }catch(error){
    console.error(error);$("loading").classList.add("hidden");$("startOverlay").classList.add("hidden");$("webglError").classList.remove("hidden");
  }
}

initialize();
