import * as THREE from "./three.module.min.js";
import {
  PRODUCTS,PRICE_REFERENCE,BUSINESSES,copy,productById,brandById,eventForDay,createState,shelfCapacity,marketPrice,recommendedRetailPrice,retailPrice,changeRetailMarkup,priceAcceptanceChance,marketTrend,
  bargainPurchase,cargoCount,deliveryFee,dispatchTruck,advanceDelivery,labourWage,startUnloading,advanceUnloading,cameraRelativeVector,takeCrate,restockShelf,createOrder,takeShelfItems,completeSale,missSale,
  dailyTarget,serveTarget,spawnDelay,checkoutDuration,staffCheckoutDuration,startNextDay,xpForNextLevel,
  upgradeCost,buyUpgrade,recordQueue,cashierHireCost,cashierWage,hireCashier,restockerHireCost,restockerWage,hireRestocker,restockerTransfer,
  adjustCleanliness,buyBusiness,businessDailyIncome
} from "./sim.js";

const TEXT=window.BAZAAR_TEXT;
const SAVE_KEY="bazaarBoss3DStateV1";
const LEGACY_KEY="bazaarBossPakistanV1";
const $=id=>document.getElementById(id);
const clamp=THREE.MathUtils.clamp;
const rand=(min,max)=>min+Math.random()*(max-min);
const PRODUCT_SHELVES={
  flour:{x:-9.35,z:-7.6,side:-1},rice:{x:-9.35,z:-3.8,side:-1},sugar:{x:-9.35,z:0,side:-1},pulses:{x:-9.35,z:3.8,side:-1},salt:{x:-9.35,z:7.6,side:-1},
  ghee:{x:9.35,z:-7.6,side:1},oil:{x:9.35,z:-3.8,side:1},milk:{x:9.35,z:0,side:1},biscuit:{x:9.35,z:3.8,side:1},toffee:{x:9.35,z:7.6,side:1}
};
const EVENT_TEXT={
  normal:["eventNormal","eventNormalD"],wedding:["eventWedding","eventWeddingD"],
  ration:["eventRation","eventRationD"],school:["eventSchool","eventSchoolD"],
  inflation:["eventInflation","eventInflationD"],rush:["eventRush","eventRushD"],
  festival:["eventFestival","eventFestivalD"]
};
const COLORS=[0x315f91,0xa84236,0x2d7254,0x9b612e,0x68498b,0x1d7780,0xa33e68,0x4c5158];
const SKINS=[0x6f432c,0x8d5524,0xb87952,0xd39a73,0xedb98d,0xf1c7a5];
const CHARACTER_FILES={
  male:"models/quaternius/Superhero_Male_FullBody.gltf",
  female:"models/quaternius/Superhero_Female_FullBody.gltf",
  animations:"models/quaternius/UAL1_Standard.glb"
};
const CHARACTER_ACTIONS={
  idle:"Idle_Loop",walk:"Walk_Loop",run:"Sprint_Loop",push:"Push_Loop",pickup:"PickUp_Table",
  interact:"Interact",sit:"Sitting_Idle_Loop",checkout:"Sitting_Talking_Loop",drive:"Driving_Loop"
};

let state=loadState();
let carrying=state.carrying?copy(state.carrying):null;
let scene,camera,renderer,player,playerShadow,marketMarker,marketVendor,cashierMesh,cashierLabel,restockerMesh,restockerLabel,checkoutSign,mandiSignHolder,deliveryTruck,truckCargoGroup,truckDriver,serviceArea;
let started=false,currentPanel=null,currentZone=null,dayPopupTimer=null;
let cameraYaw=0,cameraPitch=.38,walkTime=0,spawnClock=1.8,worldTime=0;
let scan=null,ownerCheckoutSession=null,ownerCheckoutDelay=0,audioContext=null,cashierCooldown=.8,truckArrivalHold=0,restockerCooldown=2.5,restockerJob=null,autosaveClock=0,labelRefreshClock=0,nextPersonId=1,giveWayToastAt=0;
const characterAssets={ready:false,male:null,female:null,clips:new Map()};
const animatedCharacters=new Set();
const shelves=new Map();
const packageTextureCache=new Map();
const surfaceTextureCache=new Map();
const blockers=[];
const zones=[];
const customers=[];
const checkoutQueue=[];
const worldLabels=[];
const movingDecor=[];
const trashItems=[];
const labourerMeshes=[];
const labourerLabels=[];
const keys={};
const joystick={x:0,y:0,id:null};

function loadGltf(loader,path){
  return new Promise((resolve,reject)=>loader.load(path,resolve,undefined,reject));
}

function prepareCharacterAsset(gltf){
  gltf.scene.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(gltf.scene);
  const height=Math.max(.01,bounds.max.y-bounds.min.y);
  return {scene:gltf.scene,scale:2.68/height,minY:bounds.min.y};
}

async function loadCharacterAssets(){
  const loader=new GLTFLoader();
  const [male,female,animationLibrary]=await Promise.all([
    loadGltf(loader,CHARACTER_FILES.male),loadGltf(loader,CHARACTER_FILES.female),loadGltf(loader,CHARACTER_FILES.animations)
  ]);
  characterAssets.male=prepareCharacterAsset(male);
  characterAssets.female=prepareCharacterAsset(female);
  characterAssets.clips=new Map(animationLibrary.animations.map(clip=>[clip.name,clip]));
  for(const name of Object.values(CHARACTER_ACTIONS)){
    if(!characterAssets.clips.has(name))throw new Error(`Missing character animation: ${name}`);
  }
  characterAssets.ready=true;
}

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

function brandName(id,brandId){
  const item=productById(id),brand=brandById(item,brandId);
  return brand.n[state.lang]||brand.n.ur;
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
  refreshMandiSign();
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

function texturedMaterial(path,{repeat=[1,1],roughness=.82,color=0xffffff,metalness=.02}={}){
  const key=`${path}:${repeat.join("x")}`;
  let texture=surfaceTextureCache.get(key);
  if(!texture){
    texture=new THREE.TextureLoader().load(path,undefined,undefined,()=>{});
    texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.repeat.set(repeat[0],repeat[1]);texture.anisotropy=renderer?Math.min(4,renderer.capabilities.getMaxAnisotropy()):1;
    surfaceTextureCache.set(key,texture);
  }
  return new THREE.MeshStandardMaterial({map:texture,color,roughness,metalness});
}

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
  const canvas=document.createElement("canvas");canvas.width=768;canvas.height=lines.length>=4?400:320;
  const context=canvas.getContext("2d");
  context.fillStyle=background;context.fillRect(0,0,canvas.width,canvas.height);
  context.strokeStyle=accent;context.lineWidth=18;context.strokeRect(9,9,canvas.width-18,canvas.height-18);
  context.textAlign="center";context.textBaseline="middle";context.direction=state.lang==="en"?"ltr":"rtl";
  const top=lines.length>=4?62:74,gap=lines.length>=4?87:88;
  lines.forEach((line,index)=>{
    context.fillStyle=index===lines.length-1?accent:foreground;
    context.font=index===0?"900 70px Arial, sans-serif":index===1?"800 39px Arial, sans-serif":"800 34px Arial, sans-serif";
    context.fillText(String(line),canvas.width/2,top+index*gap,canvas.width-64);
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
  scene.fog=new THREE.Fog(0x9fd3df,34,76);
  camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,150);
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.35));
  renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.08;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute("aria-label","Bazaar Boss supermarket");
  $("game").prepend(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xeafaff,0x8d724d,2.25));
  const sun=new THREE.DirectionalLight(0xfff4d2,2.15);sun.position.set(-8,16,12);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-18;sun.shadow.camera.right=18;sun.shadow.camera.top=28;sun.shadow.camera.bottom=-18;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xaad5ff,.75);fill.position.set(10,7,-8);scene.add(fill);

  const floor=new THREE.Mesh(new THREE.PlaneGeometry(24,23),texturedMaterial("textures/floor-terrazzo.webp",{repeat:[6,6],roughness:.82}));
  floor.rotation.x=-Math.PI/2;floor.position.z=-.1;floor.receiveShadow=true;scene.add(floor);
  const aisle=new THREE.Mesh(new THREE.PlaneGeometry(14.5,18),new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:.13,roughness:.7}));
  aisle.rotation.x=-Math.PI/2;aisle.position.set(0,.018,-.4);scene.add(aisle);
  addFloorTiles();
  buildWalls();
  buildOutside();
  buildShelves();
  buildMarketArea();
  buildCheckout();
  buildManagementDesk();
  buildDecoration();
  player=createHumanoid(0x247d68,0xd39a73,true,{style:"owner"});
  player.position.set(0,0,8.5);scene.add(player);
  playerShadow=player.userData.shadow;
  addWorldLabel("interact",()=>new THREE.Vector3(0,3.6,-10.55),()=>t("storeName"));
  addWorldLabel("interact",()=>new THREE.Vector3(0,2.8,10.8),()=>t("entranceLabel"));
  refreshCashierCharacter();
  refreshRestockerCharacter();
  refreshServiceBusinesses();
  camera.position.set(0,11.2,27.5);
  camera.lookAt(0,1.1,5);
}

function addFloorTiles(){
  const lineMaterial=new THREE.LineBasicMaterial({color:0xd1ae78,transparent:true,opacity:.35});
  for(let z=-10;z<=10;z+=2){
    const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-8.8,.025,z),new THREE.Vector3(8.8,.025,z)]);
    scene.add(new THREE.Line(geometry,lineMaterial));
  }
  for(let x=-11;x<=11;x+=2){
    const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x,.026,-11),new THREE.Vector3(x,.026,11)]);
    scene.add(new THREE.Line(geometry,lineMaterial));
  }
}

function buildWalls(){
  const wallMat=texturedMaterial("textures/wall-plaster.webp",{repeat:[5,2],roughness:.92});
  box(scene,[24,3.8,.3],[0,1.9,-11],0,wallMat);
  box(scene,[.3,3.8,22],[-11.85,1.9,0],0,wallMat);
  box(scene,[.3,3.8,22],[11.85,1.9,0],0,wallMat);
  box(scene,[9,3.8,.22],[-7.5,1.9,11],0,wallMat);
  box(scene,[9,3.8,.22],[7.5,1.9,11],0,wallMat);
  box(scene,[24,.3,.3],[0,3.75,-11],0x176b56);
  box(scene,[.35,.28,22],[-11.78,3.72,0],0xd44a3d);
  box(scene,[.35,.28,22],[11.78,3.72,0],0xd44a3d);
  for(let z=-9;z<11;z+=4){
    box(scene,[.12,2.9,.12],[-11.62,1.48,z],0x176b56);
    box(scene,[.12,2.9,.12],[11.62,1.48,z],0x176b56);
  }
  const signCanvas=document.createElement("canvas");signCanvas.width=512;signCanvas.height=150;
  const context=signCanvas.getContext("2d");
  context.fillStyle="#176b56";context.fillRect(0,0,512,150);
  context.strokeStyle="#f5bd3c";context.lineWidth=14;context.strokeRect(7,7,498,136);
  context.fillStyle="#fff8df";context.textAlign="center";context.font="900 54px Arial";context.fillText("BAZAAR BOSS",256,73);
  context.fillStyle="#f5bd3c";context.font="700 25px Arial";context.fillText("PAKISTAN • SUPERMARKET",256,115);
  const texture=new THREE.CanvasTexture(signCanvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(7,2.05),new THREE.MeshBasicMaterial({map:texture}));
  sign.position.set(0,3.35,-10.8);scene.add(sign);
}

function buildOutside(){
  const road=new THREE.Mesh(new THREE.PlaneGeometry(34,17),texturedMaterial("textures/road-asphalt.webp",{repeat:[8,4],roughness:.96}));
  road.rotation.x=-Math.PI/2;road.position.set(0,-.02,19.4);scene.add(road);
  const curb=box(scene,[26,.18,1],[0,.08,12.25],0xd9c095);
  for(let x=-14;x<=14;x+=4)box(scene,[1.9,.035,.12],[x,.02,17],0xf4d354,basic(0xf4d354));
  const buildingColors=[0xef8466,0x5aa9b6,0xf0bd58,0x8b75ad,0x68a76f];
  for(let i=0;i<8;i++){
    const group=new THREE.Group();
    const x=-17.5+i*5;
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
  buildServiceArea();
}

function buildServiceArea(){
  serviceArea=new THREE.Group();scene.add(serviceArea);

  const vending=new THREE.Group();vending.userData.key="vending";
  box(vending,[1.05,2.15,.8],[0,1.08,0],0x236d7b);box(vending,[.76,1.15,.04],[0,1.36,-.425],0x8bd4da,basic(0x8bd4da));
  for(let row=0;row<3;row++)for(let col=0;col<3;col++)box(vending,[.16,.24,.05],[-.22+col*.22,.95+row*.3,-.46],COLORS[(row*3+col)%COLORS.length]);
  box(vending,[.25,.25,.05],[.27,.42,-.46],0x27383e);vending.position.set(2.5,0,23.2);serviceArea.add(vending);

  const fruit=new THREE.Group();fruit.userData.key="fruitStand";
  box(fruit,[2.55,.82,1.15],[0,.61,0],0x85512f);box(fruit,[2.8,.16,1.45],[0,1.11,0],0x2c8060);
  for(const x of [-.85,-.42,0,.42,.85])for(const z of [-.3,.15]){
    const produce=new THREE.Mesh(new THREE.SphereGeometry(.16,12,9),standard((Math.round((x+1)*10)+Math.round(z*10))%2?0xd64a37:0xe9b62d));
    produce.position.set(x,1.32,z);fruit.add(produce);
  }
  for(const x of [-1.08,1.08])cylinder(fruit,.28,.17,[x,.27,.48],0x25292b,14).rotation.z=Math.PI/2;
  fruit.position.set(6.8,0,23.15);serviceArea.add(fruit);

  const food=new THREE.Group();food.userData.key="foodCart";
  box(food,[2.8,1.65,1.45],[0,1.12,0],0xc84d3d);box(food,[2.95,.16,1.6],[0,2.0,0],0xf0bd3c);
  box(food,[1.5,.76,.04],[0,1.35,-.75],0xfff2d2,basic(0xfff2d2));box(food,[.78,.55,.05],[.82,.65,-.76],0x263c45);
  for(const x of [-1.13,1.13])cylinder(food,.34,.2,[x,.34,.62],0x22272a,16).rotation.z=Math.PI/2;
  food.position.set(11,0,23.05);serviceArea.add(food);

  addWorldLabel("interact",()=>new THREE.Vector3(2.5,2.8,23.2),()=>state.businesses.vending?`🥤 ${t("vending")}`:`🔒 ${t("vending")}`);
  addWorldLabel("interact",()=>new THREE.Vector3(6.8,2.7,23.15),()=>state.businesses.fruitStand?`🍎 ${t("fruitStand")}`:`🔒 ${t("fruitStand")}`);
  addWorldLabel("interact",()=>new THREE.Vector3(11,2.8,23.05),()=>state.businesses.foodCart?`🌭 ${t("foodCart")}`:`🔒 ${t("foodCart")}`);
}

function refreshServiceBusinesses(){
  if(!serviceArea)return;
  for(const business of serviceArea.children)business.visible=Boolean(state.businesses?.[business.userData.key]);
  updateWorldLabelText();
}

function buildShelves(){
  const wood=texturedMaterial("textures/shelf-wood.webp",{repeat:[2,1],roughness:.66,color:0xd9b18c});
  for(const item of PRODUCTS){
    const layout=PRODUCT_SHELVES[item.id];
    const group=new THREE.Group();
    const backX=layout.side*.43;
    box(group,[.16,2.45,2.75],[backX,1.25,0],0,wood);
    for(const y of [.35,1.12,1.88])box(group,[.92,.12,2.86],[0,y,0],0,wood);
    for(const z of [-1.35,1.35])box(group,[.12,2.5,.12],[0,1.25,z],0,wood);
    box(group,[.96,.18,2.9],[0,2.48,0],item.color);
    group.position.set(layout.x,0,layout.z);scene.add(group);
    const entry={id:item.id,group,holders:new THREE.Group(),signHolder:new THREE.Group(),layout};
    group.add(entry.holders,entry.signHolder);shelves.set(item.id,entry);
    blockers.push({minX:layout.x-1.05,maxX:layout.x+1.05,minZ:layout.z-1.65,maxZ:layout.z+1.65});
    zones.push({kind:"shelf",id:item.id,x:layout.side<0?-7.75:7.75,z:layout.z,icon:item.emoji});
    addWorldLabel("shelf",()=>new THREE.Vector3(layout.x-layout.side*.78,3.22,layout.z),()=>`${item.emoji} ${productName(item.id)} • ${money(retailPrice(state,item.id))} • ${t("shelfStock",{stock:localNumber(state.shelfStock[item.id]),cap:localNumber(shelfCapacity(state))})}`);
    refreshShelfVisual(item.id);
  }
}

function packageLabelTexture(item,brandId){
  const brand=brandById(item,brandId);
  const key=`${state.lang}-${item.id}-${brand.id}`;
  if(packageTextureCache.has(key))return packageTextureCache.get(key);
  const canvas=document.createElement("canvas");canvas.width=512;canvas.height=512;
  const context=canvas.getContext("2d"),gradient=context.createLinearGradient(0,0,512,512);
  gradient.addColorStop(0,"#fffdf7");gradient.addColorStop(1,"#eee6d5");context.fillStyle=gradient;context.fillRect(0,0,512,512);
  context.fillStyle=brand.color;context.fillRect(0,0,512,132);
  context.fillStyle=brand.accent;context.fillRect(0,132,512,16);context.fillRect(0,470,512,42);
  context.textAlign="center";context.textBaseline="middle";context.direction=state.lang==="en"?"ltr":"rtl";
  context.fillStyle="#ffffff";context.font="900 53px Arial, sans-serif";context.fillText(brandName(item.id,brand.id),256,65,465);
  context.fillStyle=brand.accent;context.beginPath();context.arc(67,194,34,0,Math.PI*2);context.fill();
  context.fillStyle="#ffffff";context.font="900 29px Arial";context.fillText(brandName(item.id,brand.id).trim().slice(0,1),67,195);
  context.fillStyle="#17323a";context.font="900 57px Arial, sans-serif";context.fillText(productName(item.id),256,239,445);
  context.font="60px Arial";context.fillText(item.emoji,256,331);
  context.font="800 32px Arial, sans-serif";context.fillText(productUnit(item.id),256,405,430);
  context.fillStyle="#4a5759";context.font="700 18px Arial";context.fillText("PAKISTAN • QUALITY PACK",256,451,430);
  context.fillStyle="#1e2729";for(let x=397;x<474;x+=7)context.fillRect(x,169,(x%3)+2,48);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;packageTextureCache.set(key,texture);return texture;
}

function createProductPackage(item,brandId=item.brands[0].id){
  const group=new THREE.Group();
  const brand=brandById(item,brandId),displayColor=new THREE.Color(brand.color).getHex();
  if(item.shape==="bag"){
    const bag=enableShadows(new THREE.Mesh(new THREE.SphereGeometry(.27,16,12),standard(displayColor)));bag.scale.set(1,.92,.55);group.add(bag);
    cylinder(group,.045,.12,[0,.29,0],0x8a5a35,8);
  }else if(item.shape==="tin"){
    cylinder(group,.23,.46,[0,0,0],displayColor,20);
    cylinder(group,.235,.025,[0,.24,0],0xe9e1c9,16);
  }else if(item.shape==="bottle"){
    cylinder(group,.16,.38,[0,-.03,0],displayColor,18);
    cylinder(group,.085,.14,[0,.23,0],0xf2c557,12);
    cylinder(group,.09,.055,[0,.33,0],0x2f7d43,12);
  }else if(item.shape==="carton"){
    box(group,[.36,.52,.19],[0,-.01,0],displayColor);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(.22,.16,4),standard(displayColor));roof.rotation.y=Math.PI/4;roof.position.y=.33;group.add(roof);
    cylinder(group,.035,.13,[.11,.39,0],0xf3f0e5,8);
  }else if(item.shape==="packet"){
    box(group,[.38,.45,.16],[0,0,0],displayColor);
    box(group,[.39,.08,.165],[0,.06,0],0xf5bd3c);
  }else{
    const pouch=box(group,[.36,.46,.15],[0,0,0],displayColor);pouch.geometry.translate(0,-.01,0);
    if(item.id==="toffee")for(const x of [-.11,0,.11]){
      const sweet=new THREE.Mesh(new THREE.SphereGeometry(.045,7,5),standard(x===0?0xf5bd3c:0x63b9d3));sweet.position.set(x,.07,.09);group.add(sweet);
    }
  }
  const frontZ=(item.shape==="tin"||item.shape==="bottle") ? 0.242 : item.shape==="bag" ? 0.16 : 0.086;
  const label=new THREE.Mesh(new THREE.PlaneGeometry(.32,.3),new THREE.MeshBasicMaterial({map:packageLabelTexture(item,brand.id),side:THREE.DoubleSide,transparent:true}));
  label.position.set(0,-.015,frontZ);group.add(label);
  return group;
}

function refreshShelfSign(id){
  const entry=shelves.get(id);if(!entry)return;
  while(entry.signHolder.children.length){
    const old=entry.signHolder.children[0];entry.signHolder.remove(old);old.userData.texture?.dispose();old.material?.dispose();old.geometry?.dispose();
  }
  const item=productById(id);
  const brands=item.brands.map(brand=>brandName(id,brand.id)).join(" • ");
  const sign=labelledPlane(2.62,1.34,[`${item.emoji} ${productName(id)}`,brands,productUnit(id),`${t("sellingPrice",{price:localNumber(retailPrice(state,id))})}`],{background:"#173f39",accent:`#${item.color.toString(16).padStart(6,"0")}`});
  sign.position.set(entry.layout.side<0?.57:-.57,3.02,0);sign.rotation.y=entry.layout.side<0?Math.PI/2:-Math.PI/2;entry.signHolder.add(sign);
}

function refreshShelfVisual(id){
  const entry=shelves.get(id);if(!entry)return;
  while(entry.holders.children.length)entry.holders.remove(entry.holders.children[0]);
  const item=productById(id);
  const count=Math.min(state.shelfStock[id],18);
  for(let index=0;index<count;index++){
    const row=Math.floor(index/6),column=index%6;
    const packageMesh=createProductPackage(item,item.brands[index%item.brands.length].id);
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
  box(market,[3.8,1.2,1.65],[0,.6,0],0x6f3d29);
  box(market,[4.1,.18,1.9],[0,1.25,0],0xf0b63b);
  box(market,[3.9,.16,2.2],[0,3.05,0],0x176b56);
  for(const x of [-1.5,-.75,0,.75,1.5])box(market,[.42,.08,2.35],[x,2.92,0],x%1.5?0xf5bd3c:0xd84c3f);
  for(const x of [-1.82,1.82])cylinder(market,.065,1.75,[x,2.12,0],0x49372d,8);
  mandiSignHolder=new THREE.Group();market.add(mandiSignHolder);refreshMandiSign();
  for(let i=-1;i<=1;i++){
    const sack=new THREE.Mesh(new THREE.CylinderGeometry(.29,.36,.76,10),standard(PRODUCTS[i+2].color));
    sack.position.set(i*.75,1.72,.15);market.add(sack);
  }
  market.position.set(-5.9,0,23.15);scene.add(market);
  blockers.push({minX:-8.25,maxX:-3.7,minZ:22.05,maxZ:24.25});
  zones.push({kind:"market",x:-3.45,z:21.55,icon:"🤝"});
  addWorldLabel("interact",()=>new THREE.Vector3(-5.9,4.05,23.15),()=>`🤝 ${t("supplyLabel")}`);
  marketVendor=createHumanoid(0x73502f,SKINS[2],false,{style:"vendor",kind:2});marketVendor.position.set(-5.9,0,21.75);marketVendor.rotation.y=0;scene.add(marketVendor);
  addWorldLabel("interact",()=>marketVendor.position.clone().add(new THREE.Vector3(0,2.9,0)),()=>`🧔 ${t("vendorLabel")}`);

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
  marker.position.set(-3.45,0,21.55);scene.add(marker);marketMarker=marker;

  buildDeliveryTruck();
}

function refreshMandiSign(){
  if(!mandiSignHolder)return;
  while(mandiSignHolder.children.length){const old=mandiSignHolder.children[0];mandiSignHolder.remove(old);old.userData.texture?.dispose();old.material?.dispose();old.geometry?.dispose()}
  const sign=labelledPlane(3.45,.72,["PAKISTAN",t("market")],{background:"#5d2f21",accent:"#f5bd3c"});sign.position.set(0,3.5,-.86);mandiSignHolder.add(sign);
}

function buildDeliveryTruck(){
  const truck=new THREE.Group();
  box(truck,[1.9,.72,2.25],[0,.82,.5],0x2d7d66);
  box(truck,[1.72,1.48,1.25],[0,1.18,-1.18],0xe1aa2e);
  box(truck,[1.45,.6,.08],[0,1.48,-1.825],0x9ed7df,basic(0x9ed7df));
  box(truck,[1.75,.12,2.05],[0,1.2,.55],0x6e4a35);
  box(truck,[.12,.68,2.1],[-.88,1.5,.55],0x97623a);box(truck,[.12,.68,2.1],[.88,1.5,.55],0x97623a);
  box(truck,[1.8,.68,.12],[0,1.5,1.55],0x97623a);
  for(const x of [-.96,.96])for(const z of [-1.05,1.05]){
    const wheel=cylinder(truck,.36,.22,[x,.43,z],0x1c2225,18);wheel.rotation.z=Math.PI/2;
    cylinder(truck,.14,.235,[x,.43,z],0xb9b1a2,14).rotation.z=Math.PI/2;
  }
  truckCargoGroup=new THREE.Group();truckCargoGroup.position.set(0,1.52,.45);truck.add(truckCargoGroup);
  truckDriver=createHumanoid(0x425a70,SKINS[2],false,{style:"driver",kind:2});
  truckDriver.scale.setScalar(.43);truckDriver.position.set(.38,.62,-1.3);truckDriver.rotation.y=Math.PI;setSeatedPose(truckDriver,true);setCharacterAction(truckDriver,CHARACTER_ACTIONS.drive);truck.add(truckDriver);
  truck.position.set(4.35,0,23.4);scene.add(truck);deliveryTruck=truck;
  addWorldLabel("interact",()=>deliveryTruck.position.clone().add(new THREE.Vector3(0,3.1,0)),()=>`🚚 ${t("truckLabel")} • ${t("truckDriverLabel")} • ${localNumber(cargoCount(truckDeliveryCargo()))}`);
  refreshTruckCargo();
}

function refreshTruckCargo(){
  if(!truckCargoGroup)return;
  while(truckCargoGroup.children.length)truckCargoGroup.remove(truckCargoGroup.children[0]);
  const cargo=truckDeliveryCargo();
  let index=0;
  for(const item of PRODUCTS){
    const visible=Math.min(3,cargo[item.id]||0);
    for(let count=0;count<visible&&index<12;count++,index++){
      const crate=box(truckCargoGroup,[.48,.42,.48],[-.56+(index%3)*.56,.22+Math.floor(index/6)*.44,-.42+(Math.floor(index/3)%2)*.72],item.color);
      crate.rotation.y=(index%2)*.08;
    }
  }
}

function truckDeliveryCargo(){
  return state.delivery.active||state.delivery.arrived||state.delivery.unloading?state.delivery.cargo:state.truckCargo;
}

function updateDeliveryTruck(delta){
  if(!deliveryTruck)return;
  const marketZ=23.4,storeZ=13.45;
  if(state.delivery.active){
    const result=advanceDelivery(state,delta);
    const ratio=result?.arrived?1:(result?.ratio??0);
    deliveryTruck.position.set(4.35,0,THREE.MathUtils.lerp(marketZ,storeZ,ratio));
    deliveryTruck.rotation.y=0;
    $("deliveryFill").style.width=`${ratio*100}%`;
    $("deliveryText").textContent=t("deliveryStatus",{seconds:localNumber(Math.max(0,Math.ceil((1-ratio)*state.delivery.duration))) });
    if(result?.arrived){
      refreshTruckCargo();toast(t("deliveryArrived"),3000);tone("up");save();updateHUD();updateWorldLabelText();
      if(currentPanel==="stockroom")renderStockroom();
      if(currentPanel==="transport")renderTransport();
    }
  }else if(state.delivery.unloading){
    deliveryTruck.position.set(4.35,0,storeZ);
    ensureLabourerModels();updateLabourerModels(delta);
    const result=advanceUnloading(state,delta);
    if(result?.complete){
      truckArrivalHold=2.5;clearLabourerModels();refreshTruckCargo();toast(t("unloadingComplete"),2800);tone("up");save();updateHUD();updateWorldLabelText();
      if(currentPanel==="stockroom")renderStockroom();
      if(currentPanel==="transport")renderTransport();
    }
  }else if(state.delivery.arrived){
    deliveryTruck.position.set(4.35,0,storeZ);
  }else if(truckArrivalHold>0){
    truckArrivalHold-=delta;deliveryTruck.position.set(4.35,0,storeZ);
  }else deliveryTruck.position.set(4.35,0,marketZ);
}

function clearLabourerModels(){
  for(const mesh of labourerMeshes){unregisterCharacter(mesh);scene.remove(mesh)}
  labourerMeshes.length=0;
  for(const label of labourerLabels){const index=worldLabels.indexOf(label);if(index>=0)worldLabels.splice(index,1);label.element.remove()}
  labourerLabels.length=0;
}

function createStockCrate(item,name="carried-crate"){
  const crate=new THREE.Group();crate.name=name;crate.userData.id=item.id;
  box(crate,[.78,.55,.62],[0,0,0],0x9c6338);
  box(crate,[.58,.38,.64],[0,.09,0],item.color);
  const pack=createProductPackage(item,item.brands[0].id);pack.scale.setScalar(.72);pack.position.set(0,.16,.34);crate.add(pack);
  return crate;
}

function ensureLabourerModels(){
  const needed=state.delivery.unloading?state.delivery.labourers:0;
  if(labourerMeshes.length===needed)return;
  clearLabourerModels();
  for(let index=0;index<needed;index++){
    const mesh=createHumanoid(index?0x316fa0:0xc66a32,SKINS[(index+1)%SKINS.length],false,{style:"labourer",kind:index+1});
    mesh.scale.setScalar(.94);mesh.userData.labourerIndex=index;mesh.userData.labourPathIndex=0;
    const crate=createStockCrate(PRODUCTS[(state.day+index)%PRODUCTS.length],"labour-crate");crate.scale.setScalar(.9);setHeldObject(mesh,crate,"both");
    scene.add(mesh);labourerMeshes.push(mesh);
    labourerLabels.push(addWorldLabel("customer",()=>mesh.position.clone().add(new THREE.Vector3(0,2.9,0)),()=>mesh.userData.giveWayUntil>worldTime?`🙏 ${t("pleaseGiveWay")}`:`📦 ${t("dailyLabourer")} ${localNumber(index+1)}`));
  }
}

function updateLabourerModels(delta){
  if(!state.delivery.unloading)return;
  for(const mesh of labourerMeshes){
    const index=mesh.userData.labourerIndex||0,offset=index?.38:-.38;
    const route=[new THREE.Vector3(4.35+offset,0,13.2),new THREE.Vector3(4.35+offset,0,11.65),new THREE.Vector3(1.15+offset,0,11.15),new THREE.Vector3(offset,0,8.6),new THREE.Vector3(offset,0,-7.55),new THREE.Vector3(-3.18,0,-8.25+offset)];
    const pathIndex=mesh.userData.labourPathIndex||0,target=route[pathIndex];
    if(!target){animateHumanoid(mesh,false,0);continue}
    if(pathIndex===0&&mesh.position.lengthSq()===0)mesh.position.copy(target);
    const speed=state.delivery.labourers===2?4.6:3.05;
    if(moveToward({mesh,speed},target,delta*speed))mesh.userData.labourPathIndex=pathIndex+1;
  }
}

function buildCheckout(){
  const counter=new THREE.Group();
  box(counter,[3.6,1.25,1.35],[0,.63,0],0xc66e36);
  box(counter,[3.8,.18,1.55],[0,1.32,0],0x773c25);
  box(counter,[1.45,.14,.85],[-.55,1.48,0],0x263d45);
  for(const z of [-.28,0,.28])box(counter,[.08,.025,.22],[-.55,1.565,z],0xcfd8d5,basic(0xcfd8d5));
  box(counter,[.72,.72,.16],[.77,1.85,-.15],0x263d45);
  box(counter,[.56,.48,.04],[.77,1.85,-.24],0x6fd2c8,basic(0x6fd2c8));
  box(counter,[.54,.38,.12],[-1.12,1.78,-.14],0x263d45);
  box(counter,[.43,.25,.025],[-1.12,1.78,-.21],0x71c9c1,basic(0x71c9c1));
  box(counter,[.72,.055,.34],[-.74,1.57,.48],0xdad9d3);
  for(let x=-.98;x<=-.5;x+=.12)for(let z=.39;z<=.56;z+=.085)box(counter,[.075,.018,.05],[x,1.606,z],0x39474b,basic(0x39474b));
  box(counter,[.65,.38,.5],[1.2,1.55,.12],0xddd9ce);
  const scannerGlow=box(counter,[.32,.035,.34],[-.08,1.565,0],0x78e5da,basic(0x78e5da));scannerGlow.userData.scanner=true;
  checkoutSign=new THREE.Group();counter.add(checkoutSign);
  counter.position.set(4.95,0,9.2);scene.add(counter);
  buildChair(4.18,10.35,0x176b56);buildChair(5.68,10.35,0x245b88);
  blockers.push({minX:2.72,maxX:7.25,minZ:8.12,maxZ:10.82});
  zones.push({kind:"checkout",x:2.25,z:9.0,icon:"🧾"});
  addWorldLabel("interact",()=>new THREE.Vector3(4.95,2.65,9.2),()=>`🧾 ${t("checkoutLabel")}`);
  addWorldLabel("customer",()=>new THREE.Vector3(2.35,2.4,7.55),()=>checkoutQueue.length?`${t("queueLabel")}: ${localNumber(checkoutQueue.length)}`:t("queueLabel"));
  for(let index=0;index<6;index++){
    const marker=new THREE.Mesh(new THREE.RingGeometry(.3,.38,20),new THREE.MeshBasicMaterial({color:index?0xf0b83d:0x2cb78b,transparent:true,opacity:.55,side:THREE.DoubleSide}));
    marker.rotation.x=-Math.PI/2;marker.position.set(2.25,.035,7.55-index*1.02);scene.add(marker);
  }
  refreshCheckoutSign();
}

function buildManagementDesk(){
  const desk=new THREE.Group();
  box(desk,[3.2,.14,1.05],[0,1.14,0],0, texturedMaterial("textures/shelf-wood.webp",{repeat:[2,1],roughness:.62,color:0xc89972}));
  for(const x of [-1.35,1.35])box(desk,[.14,1.15,.85],[x,.57,0],0x44382f);
  box(desk,[1.15,.76,.12],[0,1.72,-.22],0x263d45);box(desk,[.95,.56,.035],[0,1.72,-.29],0x59a8aa,basic(0x59a8aa));
  box(desk,[.72,.055,.35],[0,1.25,.32],0xd8d5ca);for(let x=-.28;x<=.28;x+=.14)for(let z=.21;z<=.41;z+=.1)box(desk,[.09,.018,.055],[x,1.286,z],0x354146,basic(0x354146));
  const sign=labelledPlane(2.55,.62,["💻",t("management")],{background:"#24596a",accent:"#f5bd3c"});sign.position.set(0,2.55,.02);desk.add(sign);
  desk.position.set(0,0,-9.75);scene.add(desk);
  blockers.push({minX:-1.8,maxX:1.8,minZ:-10.55,maxZ:-8.95});
  zones.push({kind:"management",x:0,z:-8.25,icon:"💻"});
  addWorldLabel("interact",()=>new THREE.Vector3(0,3.05,-9.65),()=>`💻 ${t("management")}`);
}

function buildChair(x,z,color){
  const chair=new THREE.Group();
  box(chair,[.68,.14,.68],[0,.72,0],color);
  box(chair,[.68,.82,.12],[0,1.1,.29],color);
  cylinder(chair,.08,.58,[0,.37,0],0x434b4c,10);
  for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
    const leg=box(chair,[.07,.08,.52],[Math.sin(angle)*.22,.1,Math.cos(angle)*.22],0x434b4c);leg.rotation.y=angle;
  }
  for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5])cylinder(chair,.07,.06,[Math.sin(angle)*.46,.07,Math.cos(angle)*.46],0x252a2c,10).rotation.z=Math.PI/2;
  chair.position.set(x,0,z);scene.add(chair);
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
  if(cashierMesh){unregisterCharacter(cashierMesh);scene.remove(cashierMesh);cashierMesh=null}
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
  cashierMesh.position.set(5.68,-.17,10.29);cashierMesh.rotation.y=Math.PI;setSeatedPose(cashierMesh,true);scene.add(cashierMesh);
  cashierLabel=addWorldLabel("interact",()=>cashierMesh.position.clone().add(new THREE.Vector3(0,3.05,0)),()=>`👨‍💼 ${t("cashierLabel")} • ${localNumber(state.staff.cashier)}/2`);
}

function removeRestocker(){
  if(restockerMesh){unregisterCharacter(restockerMesh);scene.remove(restockerMesh);restockerMesh=null}
  if(restockerLabel){
    const index=worldLabels.indexOf(restockerLabel);if(index>=0)worldLabels.splice(index,1);
    restockerLabel.element.remove();restockerLabel=null;
  }
  restockerJob=null;
}

function refreshRestockerCharacter(){
  if(!scene)return;
  removeRestocker();
  if(!state.staff.restocker)return;
  restockerMesh=createHumanoid(0xb46c35,SKINS[1],false,{style:"restocker",kind:1});
  restockerMesh.position.set(-3.1,0,-8.15);restockerMesh.rotation.y=Math.PI;scene.add(restockerMesh);
  restockerLabel=addWorldLabel("interact",()=>restockerMesh.position.clone().add(new THREE.Vector3(0,3.05,0)),()=>restockerMesh.userData.giveWayUntil>worldTime?`🙏 ${t("pleaseGiveWay")}`:`📦 ${t("restocker")} • ${restockerJob?t("staffWorking"):t("ready")}`);
}

function updateRestocker(delta){
  if(!restockerMesh||state.dayComplete)return;
  if(!restockerJob){
    restockerCooldown-=delta;
    if(restockerCooldown>0)return;
    const item=PRODUCTS.filter(candidate=>(state.warehouse[candidate.id]||0)>0&&state.shelfStock[candidate.id]<shelfCapacity(state))
      .sort((a,b)=>state.shelfStock[a.id]-state.shelfStock[b.id])[0];
    if(!item){restockerCooldown=2.5;animateHumanoid(restockerMesh,false,0);return}
    const layout=PRODUCT_SHELVES[item.id];
    restockerJob={id:item.id,phase:"toShelf",timer:.9,target:new THREE.Vector3(layout.side<0?-7.75:7.75,0,layout.z)};
    const crate=createStockCrate(item,"restocker-crate");crate.scale.setScalar(.86);setHeldObject(restockerMesh,crate,"both");
    updateWorldLabelText();
  }
  if(restockerJob.phase==="toShelf"){
    const done=moveToward({mesh:restockerMesh},restockerJob.target,delta*(state.staff.restocker===2?2.35:1.85));
    if(done)restockerJob.phase="stocking";
    return;
  }
  if(restockerJob.phase==="stocking"){
    setCharacterAction(restockerMesh,CHARACTER_ACTIONS.interact,1.08);restockerJob.timer-=delta;
    if(restockerJob.timer>0)return;
    const before=state.storeLevel,result=restockerTransfer(state,restockerJob.id);
    if(result.ok){refreshShelfVisual(restockerJob.id);if(state.storeLevel>before)toast(t("levelUp",{level:localNumber(state.storeLevel)}),2300);save();updateHUD();updateWorldLabelText()}
    clearHeldObject(restockerMesh);
    restockerJob.phase="return";restockerJob.target=new THREE.Vector3(-3.1,0,-8.15);return;
  }
  if(moveToward({mesh:restockerMesh},restockerJob.target,delta*2.1)){
    restockerJob=null;restockerCooldown=state.staff.restocker===2?2.2:4.2;updateWorldLabelText();
  }
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

function setCharacterAction(mesh,name,speed=1){
  const data=mesh?.userData;
  if(!data?.rigged||!data.mixer)return;
  const clip=characterAssets.clips.get(name)||characterAssets.clips.get(CHARACTER_ACTIONS.idle);
  if(!clip)return;
  let action=data.actions.get(clip.name);
  if(!action){action=data.mixer.clipAction(clip,data.model);data.actions.set(clip.name,action)}
  action.setEffectiveTimeScale(speed);
  if(data.currentAction===action)return;
  const previous=data.currentAction;
  data.currentAction=action;
  action.enabled=true;action.reset();action.setLoop(THREE.LoopRepeat,Infinity);action.fadeIn(.18).play();
  if(previous)previous.fadeOut(.18);
}

function forceCharacterAction(mesh,name,duration=.8){
  if(!mesh?.userData?.rigged)return;
  mesh.userData.forcedAction=name;mesh.userData.forcedActionUntil=worldTime+duration;setCharacterAction(mesh,name,1.06);
}

function unregisterCharacter(mesh){
  if(!mesh)return;
  mesh.userData?.mixer?.stopAllAction();
  animatedCharacters.delete(mesh);
}

function createHumanoid(clothes=0x367ab7,skin=0xefb486,isPlayer=false,appearance={}){
  if(!characterAssets.ready)throw new Error("Rigged character assets are not ready");
  const style=appearance.style||"customer";
  const kind=appearance.kind??Math.floor(Math.random()*4);
  const gender=appearance.gender||(style==="customer"&&kind%2?"female":"male");
  const asset=characterAssets[gender]||characterAssets.male;
  const group=new THREE.Group();
  const shadow=fakeShadow(group,isPlayer?.56:.48);
  const model=cloneSkinnedCharacter(asset.scene);
  model.name=`rigged-${style}-${gender}`;
  model.scale.setScalar(asset.scale);
  model.position.y=-asset.minY*asset.scale;
  model.traverse(child=>{
    if(child.isMesh){child.castShadow=true;child.receiveShadow=true;child.frustumCulled=false}
  });
  group.add(model);
  const mixer=new THREE.AnimationMixer(model);
  const bones={
    leftHand:model.getObjectByName("hand_l"),rightHand:model.getObjectByName("hand_r"),
    leftFoot:model.getObjectByName("foot_l"),rightFoot:model.getObjectByName("foot_r"),head:model.getObjectByName("Head")
  };
  group.userData={
    rigged:true,model,mixer,actions:new Map(),currentAction:null,bones,shadow,style,gender,kind,isPlayer,seated:false,
    personId:nextPersonId++,collisionRadius:.44,giveWayUntil:0,blockedTime:0,avoidance:null,heldObject:null,heldMode:"both"
  };
  animatedCharacters.add(group);
  setCharacterAction(group,CHARACTER_ACTIONS.idle);
  return group;
}

function setHeldObject(mesh,object,mode="both"){
  if(!mesh?.userData)return;
  const old=mesh.userData.heldObject;
  if(old&&old!==object)mesh.remove(old);
  mesh.userData.heldObject=object||null;mesh.userData.heldMode=mode;
  if(object){mesh.add(object);object.userData.justAttached=true;updateHeldObject(mesh)}
}

function clearHeldObject(mesh){
  const object=mesh?.userData?.heldObject;
  if(object)mesh.remove(object);
  if(mesh?.userData)mesh.userData.heldObject=null;
}

function updateHeldObject(mesh){
  const data=mesh?.userData,object=data?.heldObject,bones=data?.bones;
  if(!object||!bones?.leftHand||!bones?.rightHand)return;
  mesh.updateMatrixWorld(true);
  const left=bones.leftHand.getWorldPosition(new THREE.Vector3());
  const right=bones.rightHand.getWorldPosition(new THREE.Vector3());
  let point;
  if(data.heldMode==="left")point=left;
  else if(data.heldMode==="right")point=right;
  else point=left.add(right).multiplyScalar(.5);
  point=mesh.worldToLocal(point);
  point.y-=data.heldMode==="both"?.04:.12;point.z+=data.heldMode==="both"?.18:.08;
  if(object.userData.justAttached){object.position.copy(point);object.userData.justAttached=false}
  else object.position.lerp(point,.42);
}

function updateCharacterAnimations(delta){
  for(const character of animatedCharacters){
    if(!character.parent)continue;
    character.userData.mixer.update(delta);
    updateHeldObject(character);
  }
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
    const visible=Boolean(label.element.textContent.trim())&&point.z>-1&&point.z<1&&Math.abs(point.x)<1.2&&Math.abs(point.y)<1.25;
    label.element.style.opacity=visible?"1":"0";
    if(visible){label.element.style.left=`${(point.x*.5+.5)*width}px`;label.element.style.top=`${(-point.y*.5+.5)*height}px`}
  }
}

function makeCustomer(){
  const order=createOrder(state);
  const kind=Math.floor(Math.random()*4);
  const mesh=createHumanoid(COLORS[Math.floor(Math.random()*COLORS.length)],SKINS[Math.floor(Math.random()*SKINS.length)],false,{style:"customer",kind,gender:kind%2?"female":"male"});
  mesh.scale.setScalar(rand(.88,1.04));
  let spawn=null;
  for(let attempt=0;attempt<8;attempt++){
    const candidate={x:rand(-1.25,1.25),z:13.35+Math.floor(attempt/4)*.8};
    if(!positionBlocked(mesh,candidate.x,candidate.z)){spawn=candidate;break}
  }
  if(!spawn){unregisterCharacter(mesh);return false}
  mesh.position.set(spawn.x,0,spawn.z);scene.add(mesh);
  const shelf=PRODUCT_SHELVES[order.product],shoppingOffset=rand(-.58,.58);
  const accessX=shelf.side<0?-7.75:7.75;
  const carrier=mesh.userData.personId%3===0?"trolley":"basket";
  mesh.userData.usingTrolley=carrier==="trolley";if(mesh.userData.usingTrolley)mesh.userData.collisionRadius=.54;
  const customer={mesh,order,carrier,hasProduct:false,trolley:null,payload:null,phase:"enter",path:[new THREE.Vector3(0,0,10+shoppingOffset*.25),new THREE.Vector3(0,0,shelf.z+shoppingOffset),new THREE.Vector3(accessX,0,shelf.z+shoppingOffset)],pathIndex:0,speed:rand(1.85,2.3),timer:0,waited:0,blockedTime:0,label:null};
  mesh.userData.customer=customer;
  setupCustomerCarrier(customer);
  customer.label=addWorldLabel("customer",()=>customer.mesh.position.clone().add(new THREE.Vector3(0,2.75,0)),()=>customerLabelText(customer));
  customers.push(customer);
  return true;
}

function customerLabelText(customer){
  if(customer.mesh.userData.giveWayUntil>worldTime&&!['queue','scanning'].includes(customer.phase))return `🙏 ${t("pleaseGiveWay")}`;
  if(!customer.hasProduct)return "";
  if(customer.phase==="queue")return `${productById(customer.order.product).emoji} ${t("items",{quantity:localNumber(customer.order.quantity),item:productName(customer.order.product)})} • ${t("queueWait",{seconds:localNumber(Math.floor(customer.waited))})}`;
  if(customer.phase==="scanning")return `🧾 ${t("scanning")}`;
  return `${productById(customer.order.product).emoji} ${t("items",{quantity:localNumber(customer.order.quantity),item:productName(customer.order.product)})}`;
}

function setCustomerPath(customer,points,phase){customer.path=points;customer.pathIndex=0;customer.phase=phase}

function updateCustomer(customer,delta){
  syncCustomerTrolley(customer);
  if(["enter","toCheckout","leaving"].includes(customer.phase))moveCustomer(customer,delta);
  else if(customer.phase==="shopping"){
    setCharacterAction(customer.mesh,CHARACTER_ACTIONS.pickup,1.05);
    customer.timer-=delta;
    if(customer.timer<=0)finishShopping(customer);
  }else if(customer.phase==="queue"){
    const index=checkoutQueue.indexOf(customer);
    if(index<0)return;
    const target=new THREE.Vector3(2.25,0,7.55-index*1.05);
    moveToward(customer,target,delta*1.8,{ignoreQueue:true,suppressGiveWay:true});
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

function moveToward(customer,target,distance,options={}){
  const current=customer.mesh.position;
  const data=customer.mesh.userData;
  let finalDx=target.x-current.x,finalDz=target.z-current.z;
  const length=Math.hypot(finalDx,finalDz);
  if(length<.08){animateHumanoid(customer.mesh,false,0);return true}
  if(data.avoidance&&worldTime>data.avoidance.until)data.avoidance=null;
  if(data.avoidance&&Math.hypot(data.avoidance.x-current.x,data.avoidance.z-current.z)<.12)data.avoidance=null;
  let moveTarget=data.avoidance||target;
  let dx=moveTarget.x-current.x,dz=moveTarget.z-current.z,moveLength=Math.hypot(dx,dz);
  if(moveLength<.001){data.avoidance=null;moveTarget=target;dx=finalDx;dz=finalDz;moveLength=length}
  const step=Math.min(moveLength,distance),fx=dx/moveLength,fz=dz/moveLength;
  const attempts=[[current.x+fx*step,current.z+fz*step]];
  let moved=false,blocker=null,movedX=0,movedZ=0;
  for(const [x,z] of attempts){
    const blockedResult=positionBlocked(customer.mesh,x,z,options);
    if(!blockedResult){movedX=x-current.x;movedZ=z-current.z;current.x=x;current.z=z;moved=true;break}
    blocker=blocker||blockedResult.person;
  }
  if(!moved&&blocker){
    const desiredLength=Math.max(.001,Math.hypot(finalDx,finalDz)),forwardX=finalDx/desiredLength,forwardZ=finalDz/desiredLength;
    const otherRadius=(blocker.userData.collisionRadius||.44)*(blocker.scale.x||1);
    const ownRadius=(data.collisionRadius||.44)*(customer.mesh.scale.x||1);
    const clearance=ownRadius+otherRadius+.42;
    for(const side of [1,-1]){
      const rightX=forwardZ*side,rightZ=-forwardX*side;
      const waypoint={x:current.x+rightX*clearance+forwardX*.35,z:current.z+rightZ*clearance+forwardZ*.35,until:worldTime+2.2};
      if(blocked(waypoint.x,waypoint.z))continue;
      const lateralX=current.x+rightX*step*1.15,lateralZ=current.z+rightZ*step*1.15;
      const sideBlock=positionBlocked(customer.mesh,lateralX,lateralZ,{...options,ignorePerson:blocker});
      if(sideBlock)continue;
      data.avoidance=waypoint;movedX=lateralX-current.x;movedZ=lateralZ-current.z;current.x=lateralX;current.z=lateralZ;moved=true;break;
    }
  }
  if(!moved&&!blocker){
    for(const [x,z] of [[current.x+fx*step,current.z],[current.x,current.z+fz*step]]){
      if(positionBlocked(customer.mesh,x,z,options))continue;
      movedX=x-current.x;movedZ=z-current.z;current.x=x;current.z=z;moved=true;break;
    }
  }
  if(moved){
    data.blockedTime=Math.max(0,(data.blockedTime||0)-distance*2);
    customer.mesh.rotation.y=Math.atan2(movedX,movedZ);animateHumanoid(customer.mesh,true,worldTime*6+data.phase,Boolean(customer.running));
    if(blocker&&!options.suppressGiveWay&&canAskForWay(customer.mesh,blocker)){
      data.giveWayUntil=worldTime+1.5;
      if(blocker===player&&worldTime>giveWayToastAt){giveWayToastAt=worldTime+2.4;toast(t("pleaseGiveWay"),1300)}
      if(customer.label)customer.label.element.textContent=customerLabelText(customer);
    }
  }else{
    data.blockedTime=(data.blockedTime||0)+distance/Math.max(.4,customer.speed||1.8);animateHumanoid(customer.mesh,false,0);
    if(blocker&&data.blockedTime>.22&&!options.suppressGiveWay&&canAskForWay(customer.mesh,blocker)){
      data.giveWayUntil=worldTime+1.5;
      if(blocker===player&&worldTime>giveWayToastAt){giveWayToastAt=worldTime+2.4;toast(t("pleaseGiveWay"),1300)}
      if(customer.label)customer.label.element.textContent=customerLabelText(customer);
    }
  }
  return moved&&!data.avoidance&&length<=distance+.08;
}

function canAskForWay(mesh,blocker){
  const phase=mesh.userData.customer?.phase,otherPhase=blocker?.userData?.customer?.phase;
  return !["queue","scanning"].includes(phase)&&!["queue","scanning"].includes(otherPhase)&&!blocker?.userData?.atCounter;
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
  if(Math.random()>priceAcceptanceChance(state,customer.order.product)){
    const result=missSale(state,1);
    toast(t("priceTooHigh",{item:productName(customer.order.product)}),1900);tone("miss");
    sendCustomerOut(customer);finishDayIfNeeded(result);save();updateHUD();return;
  }
  const okay=takeShelfItems(state,customer.order);
  if(okay){
    refreshShelfVisual(customer.order.product);
    customer.hasProduct=true;
    attachCustomerBasket(customer);
    const inbound=customers.filter(other=>other!==customer&&other.phase==="toCheckout").length;
    const tailZ=7.55-(checkoutQueue.length+inbound)*1.05;
    setCustomerPath(customer,[new THREE.Vector3(0,0,customer.mesh.position.z),new THREE.Vector3(0,0,tailZ),new THREE.Vector3(2.05,0,tailZ)],"toCheckout");
    save();updateHUD();updateWorldLabelText();
  }else{
    const result=missSale(state,1);
    toast(t("shelfEmpty",{item:productName(customer.order.product)}),1900);tone("miss");
    sendCustomerOut(customer);finishDayIfNeeded(result);save();updateHUD();
  }
}

function createShoppingBasket(){
  const basket=new THREE.Group();basket.name="shopping-basket";
  box(basket,[.65,.32,.42],[0,0,0],0xd14c3f);
  for(const x of [-.2,0,.2])box(basket,[.045,.36,.44],[x,0,0],0xf0b23b,basic(0xf0b23b));
  const handle=new THREE.Mesh(new THREE.TorusGeometry(.31,.035,7,18,Math.PI),standard(0x5c3828));handle.rotation.z=Math.PI;handle.position.y=.28;basket.add(handle);
  const payload=new THREE.Group();payload.name="shopping-payload";payload.position.y=.28;basket.add(payload);
  return {carrier:basket,payload};
}

function createShoppingTrolley(){
  const trolley=new THREE.Group();trolley.name="shopping-trolley";
  const metal=standard(0x9aa7aa,.38),red=standard(0xc63e34,.58);
  box(trolley,[.92,.08,1.12],[0,.64,.12],0,metal);
  for(const x of [-.43,.43])for(const z of [-.4,.57])box(trolley,[.055,.72,.055],[x,.72,z],0,metal);
  for(const y of [.68,.9,1.12])for(const x of [-.44,.44])box(trolley,[.05,.05,1.05],[x,y,.08],0,metal);
  for(const z of [-.4,.1,.57])box(trolley,[.92,.05,.05],[0,.88,z],0,metal);
  box(trolley,[1.06,.09,.08],[0,1.36,-.52],0,red);
  for(const x of [-.4,.4])for(const z of [-.38,.5]){
    const wheel=cylinder(trolley,.105,.075,[x,.15,z],0x1f2425,14);wheel.rotation.z=Math.PI/2;
  }
  const payload=new THREE.Group();payload.name="shopping-payload";payload.position.set(0,.86,.08);trolley.add(payload);
  fakeShadow(trolley,.68);
  return {carrier:trolley,payload};
}

function setupCustomerCarrier(customer){
  if(customer.carrier==="trolley"){
    const made=createShoppingTrolley();customer.trolley=made.carrier;customer.payload=made.payload;scene.add(customer.trolley);syncCustomerTrolley(customer);
  }else{
    const made=createShoppingBasket();customer.payload=made.payload;setHeldObject(customer.mesh,made.carrier,"both");
  }
}

function syncCustomerTrolley(customer){
  if(!customer?.trolley)return;
  if(customer.mesh.userData.atCounter){customer.trolley.position.set(1.48,0,7.82);customer.trolley.rotation.y=Math.PI/2;return}
  const yaw=customer.mesh.rotation.y,forward=.9;
  customer.trolley.position.set(customer.mesh.position.x+Math.sin(yaw)*forward,0,customer.mesh.position.z+Math.cos(yaw)*forward);
  customer.trolley.rotation.y=yaw;
}

function attachCustomerBasket(customer){
  if(!customer.payload||customer.payload.children.length)return;
  const item=createProductPackage(productById(customer.order.product),customer.order.brand);
  item.scale.setScalar(customer.carrier==="trolley"?.92:.7);item.position.set(0,.04,0);customer.payload.add(item);
}

function sendCustomerOut(customer){
  customer.mesh.userData.atCounter=false;customer.mesh.userData.avoidance=null;
  setCustomerPath(customer,[new THREE.Vector3(1.55,0,7.75),new THREE.Vector3(0,0,8.8),new THREE.Vector3(0,0,13.6)],"leaving");
}

function spawnTrash(){
  if(trashItems.length>=5)return;
  let x=rand(-6.4,6.4),z=rand(-7.5,5.5),tries=0;
  while(blocked(x,z)&&tries++<12){x=rand(-6.4,6.4);z=rand(-7.5,5.5)}
  if(blocked(x,z))return;
  const mesh=new THREE.Group();
  if(Math.random()<.5){
    const paper=box(mesh,[.48,.025,.34],[0,.03,0],0xf1e6c7,basic(0xf1e6c7));paper.rotation.y=rand(-1,1);
  }else{
    const can=cylinder(mesh,.1,.35,[0,.18,0],0xd95745,12);can.rotation.z=rand(-.8,.8);
  }
  mesh.position.set(x,0,z);scene.add(mesh);
  const zone={kind:"trash",x,z,icon:"🧹",mesh};zones.push(zone);trashItems.push(zone);
  adjustCleanliness(state,-8);save();updateHUD();
}

function cleanTrash(zone){
  scene.remove(zone.mesh);
  const zoneIndex=zones.indexOf(zone);if(zoneIndex>=0)zones.splice(zoneIndex,1);
  const itemIndex=trashItems.indexOf(zone);if(itemIndex>=0)trashItems.splice(itemIndex,1);
  adjustCleanliness(state,14);state.storeXp+=8;toast(t("trashCleaned"));tone("coin");save();updateHUD();
}

function clearTrash(){
  for(const zone of [...trashItems]){
    scene.remove(zone.mesh);const index=zones.indexOf(zone);if(index>=0)zones.splice(index,1);
  }
  trashItems.length=0;
}

function removeCustomer(customer){
  const queueIndex=checkoutQueue.indexOf(customer);if(queueIndex>=0)checkoutQueue.splice(queueIndex,1);
  const index=customers.indexOf(customer);if(index>=0)customers.splice(index,1);
  const labelIndex=worldLabels.indexOf(customer.label);if(labelIndex>=0)worldLabels.splice(labelIndex,1);
  customer.label.element.remove();
  if(customer.trolley)scene.remove(customer.trolley);
  unregisterCharacter(customer.mesh);scene.remove(customer.mesh);
}

function clearCustomers(){
  if(ownerCheckoutSession)leaveOwnerSeat(ownerCheckoutSession);
  scan=null;$("scanBox").classList.add("hidden");
  for(const customer of [...customers])removeCustomer(customer);
  checkoutQueue.length=0;
}

function animateHumanoid(mesh,moving,phase,running=false){
  const data=mesh?.userData;if(!data?.rigged)return;
  if(data.forcedActionUntil>worldTime){setCharacterAction(mesh,data.forcedAction,1.06);return}
  if(data.seated){setCharacterAction(mesh,CHARACTER_ACTIONS.sit);return}
  const action=moving?(data.usingTrolley?CHARACTER_ACTIONS.push:running?CHARACTER_ACTIONS.run:CHARACTER_ACTIONS.walk):CHARACTER_ACTIONS.idle;
  setCharacterAction(mesh,action,running?1.08:1);
}

function setSeatedPose(mesh,seated){
  const data=mesh?.userData;if(!data?.rigged)return;
  data.seated=seated;
  setCharacterAction(mesh,seated?CHARACTER_ACTIONS.sit:CHARACTER_ACTIONS.idle);
}

function animateCheckoutHands(mesh){
  if(!mesh?.userData?.rigged)return;
  setCharacterAction(mesh,CHARACTER_ACTIONS.checkout,1.08);
}

function animateCashier(delta){
  if(!cashierMesh)return;
  const data=cashierMesh.userData;
  if(scan?.auto){
    animateCheckoutHands(cashierMesh);
  }else setCharacterAction(cashierMesh,CHARACTER_ACTIONS.sit);
}

function countPendingCustomers(){return customers.filter(customer=>!["leaving"].includes(customer.phase)).length}

function updateSpawning(delta){
  if(state.dayComplete)return;
  spawnClock-=delta;
  const allocated=state.handledToday+countPendingCustomers();
  if(spawnClock<=0&&allocated<dailyTarget(state)){
    const spawned=makeCustomer();spawnClock=spawned?spawnDelay(state)*rand(.78,1.08):.65;updateWorldLabelText();
  }
}

function startScanning(auto=false){
  if(scan)return;
  const customer=checkoutQueue[0];
  if(!customer){if(!auto)toast(t("noCustomer"));return}
  checkoutQueue.shift();customer.phase="scanning";animateHumanoid(customer.mesh,false,0);
  customer.mesh.userData.atCounter=true;customer.mesh.userData.avoidance=null;
  customer.mesh.position.set(3.3,0,7.78);customer.mesh.rotation.y=0;syncCustomerTrolley(customer);
  scan={customer,elapsed:0,duration:auto?staffCheckoutDuration(state):checkoutDuration(state),auto};
  if(!auto){
    if(!ownerCheckoutSession){
      ownerCheckoutSession={returnPosition:player.position.clone(),returnRotation:player.rotation.y,seatFrom:player.position.clone(),seatElapsed:0,seatDuration:.72};
    }
  }
  $("scanText").textContent=auto?t("autoScanning"):t("scanning");
  $("scanFill").style.width="0%";$("scanBox").classList.remove("hidden");
  tone("up");updateHUD();updateWorldLabelText();
}

function updateAutomaticCheckout(delta){
  if(!state.staff.cashier||state.dayComplete||ownerCheckoutSession)return;
  if(scan){cashierCooldown=.65;return}
  cashierCooldown-=delta;
  if(cashierCooldown<=0&&checkoutQueue.length){startScanning(true);cashierCooldown=.65}
}

function updateScan(delta){
  if(!scan)return;
  setCharacterAction(scan.customer.mesh,CHARACTER_ACTIONS.interact,.92);
  if(!scan.auto&&!player.userData.seated){
    ownerCheckoutSession.seatElapsed+=delta;
    const ratio=Math.min(1,ownerCheckoutSession.seatElapsed/ownerCheckoutSession.seatDuration),smooth=ratio*ratio*(3-2*ratio);
    player.position.lerpVectors(ownerCheckoutSession.seatFrom,new THREE.Vector3(4.18,-.17,10.29),smooth);
    player.rotation.y=THREE.MathUtils.lerp(ownerCheckoutSession.returnRotation,Math.PI,smooth);animateHumanoid(player,true,worldTime*8);
    if(ratio>=1){setSeatedPose(player,true);updateCarriedCrate();const crate=player.getObjectByName("carried-crate");if(crate)crate.visible=false}
    return;
  }
  if(!scan.auto)animateCheckoutHands(player);
  scan.elapsed+=delta;
  const ratio=Math.min(1,scan.elapsed/scan.duration);$("scanFill").style.width=`${ratio*100}%`;
  if(ratio<1)return;
  const customer=scan.customer,automatic=scan.auto;
  scan=null;$("scanBox").classList.add("hidden");
  const beforeLevel=state.storeLevel,result=completeSale(state,customer.order);
  toast(t("saleDone",{price:money(customer.order.price).replace("₨","")}));tone("coin");
  if(state.storeLevel>beforeLevel)setTimeout(()=>toast(t("levelUp",{level:localNumber(state.storeLevel)}),2300),500);
  if(Math.random()<.24)spawnTrash();
  if(state.tutorialStep===5){state.tutorialStep=6;toast(t("tutorialDone"),2300)}
  if(automatic)cashierCooldown=.65;else ownerCheckoutDelay=.42;
  sendCustomerOut(customer);finishDayIfNeeded(result);save();updateHUD();updateWorldLabelText();
}

function updateOwnerCheckout(delta){
  if(!ownerCheckoutSession||scan||state.dayComplete)return;
  ownerCheckoutDelay=Math.max(0,ownerCheckoutDelay-delta);
  if(ownerCheckoutDelay<=0&&checkoutQueue.length)startScanning(false);
}

function leaveOwnerSeat(session=ownerCheckoutSession){
  if(!player||!session)return;
  setSeatedPose(player,false);
  if(session.returnPosition)player.position.copy(session.returnPosition);
  if(Number.isFinite(session.returnRotation))player.rotation.y=session.returnRotation;
  ownerCheckoutSession=null;ownerCheckoutDelay=0;
  updateCarriedCrate();const crate=player.getObjectByName("carried-crate");if(crate)crate.visible=true;
  updateInteractions();
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
  $("sumServiceIncome").textContent=`+${money(summary.serviceIncome||0)}`;
  $("sumQueue").textContent=localNumber(state.queueRecord||0);
  $("sumSalesFund").textContent=money(summary.salesFund??state.salesFund);
  $("sumBudget").textContent=money(summary.operatingBudget??state.operatingBudget);
  $("expenseWarning").classList.toggle("hidden",!summary.short);
  $("dayModal").classList.remove("hidden");
}

function nextDay(){
  clearCustomers();startNextDay(state);spawnClock=2.6;save();
  $("dayModal").classList.add("hidden");refreshAllShelfVisuals();updateHUD();updateWorldLabelText();tone("up");
}

function blocked(x,z){
  const radius=.42;
  if(x<-11.25+radius||x>11.25-radius||z<-10.45+radius||z>25.8-radius)return true;
  return blockers.some(rect=>x+radius>rect.minX&&x-radius<rect.maxX&&z+radius>rect.minZ&&z-radius<rect.maxZ);
}

function activePeople(){
  const people=[player,marketVendor,restockerMesh,...customers.map(customer=>customer.mesh),...labourerMeshes];
  return people.filter(mesh=>mesh&&mesh.visible!==false&&!mesh.userData.seated&&!mesh.userData.atCounter);
}

function positionBlocked(mesh,x,z,options={}){
  if(blocked(x,z))return {world:true,person:null};
  const radius=(mesh.userData.collisionRadius||.42)*(mesh.scale.x||1);
  for(const other of activePeople()){
    if(other===mesh||other===options.ignorePerson)continue;
    const phase=mesh.userData.customer?.phase,otherPhase=other.userData.customer?.phase;
    if(options.ignoreQueue&&phase==="queue"&&otherPhase==="queue")continue;
    const otherRadius=(other.userData.collisionRadius||.42)*(other.scale.x||1);
    if((x-other.position.x)**2+(z-other.position.z)**2<(radius+otherRadius+.08)**2)return {world:false,person:other};
  }
  return null;
}

function resolvePeopleOverlaps(){
  const people=activePeople();
  for(let first=0;first<people.length;first++)for(let second=first+1;second<people.length;second++){
    const a=people[first],b=people[second];
    const phaseA=a.userData.customer?.phase,phaseB=b.userData.customer?.phase;
    if(phaseA==="queue"&&phaseB==="queue")continue;
    let dx=a.position.x-b.position.x,dz=a.position.z-b.position.z,distance=Math.hypot(dx,dz);
    const minimum=(a.userData.collisionRadius||.42)*(a.scale.x||1)+(b.userData.collisionRadius||.42)*(b.scale.x||1)+.04;
    if(distance>=minimum||minimum-distance<.025)continue;
    if(distance<.001){dx=a.userData.personId%2?1:-1;dz=0;distance=1}
    const push=Math.min(.09,(minimum-distance)*.52),nx=dx/distance,nz=dz/distance;
    const aX=a.position.x+nx*push,aZ=a.position.z+nz*push,bX=b.position.x-nx*push,bZ=b.position.z-nz*push;
    if(!blocked(aX,aZ)){a.position.x=aX;a.position.z=aZ}
    if(!blocked(bX,bZ)){b.position.x=bX;b.position.z=bZ}
  }
}

function updatePlayer(delta){
  if(ownerCheckoutSession){if(player.userData.seated&&scan)animateCheckoutHands(player);return}
  let inputX=joystick.x+(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0);
  let inputForward=-joystick.y+(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0);
  const magnitude=Math.hypot(inputX,inputForward);
  if(magnitude>.05){
    const strength=Math.min(1,magnitude);
    inputX/=magnitude;inputForward/=magnitude;
    const direction=cameraRelativeVector(cameraYaw,inputX,inputForward);
    const running=strength>=.78;
    const speed=running?4.7+(strength-.78)/.22*1.8:1.25+strength*3.55;
    const dx=direction.x*delta*speed,dz=direction.z*delta*speed;
    const nextX=player.position.x+dx,nextZ=player.position.z+dz;
    if(!positionBlocked(player,nextX,player.position.z))player.position.x=nextX;
    if(!positionBlocked(player,player.position.x,nextZ))player.position.z=nextZ;
    player.rotation.y=Math.atan2(dx,dz);
    walkTime+=delta*(running?11.5:7.6);animateHumanoid(player,true,walkTime,running);
  }else animateHumanoid(player,false,0);
  updateCarriedCrate();
}

function updateCamera(delta){
  if(!player||!camera)return;
  const distance=state.cameraDistance,height=5.65+cameraPitch*6.5+Math.max(0,distance-14)*.17;
  const desired=new THREE.Vector3(player.position.x+Math.sin(cameraYaw)*distance,height,player.position.z+Math.cos(cameraYaw)*distance);
  camera.position.lerp(desired,1-Math.pow(.002,delta));
  const target=new THREE.Vector3(player.position.x,1.05,player.position.z-1.1);
  camera.lookAt(target);
}

function updateCarriedCrate(){
  if(!player)return;
  const old=player.getObjectByName("carried-crate");
  if(!carrying){if(old)clearHeldObject(player);return}
  if(old&&old.userData.id===carrying.id)return;
  if(old)clearHeldObject(player);
  const item=productById(carrying.id),crate=createStockCrate(item,"carried-crate");
  setHeldObject(player,crate,"both");
}

function updateInteractions(){
  const button=$("actionBtn"),icon=$("actionIcon"),label=$("actionText");
  if(ownerCheckoutSession){
    const busy=Boolean(scan)||checkoutQueue.length>0;
    currentZone={kind:"ownerSeat",icon:busy?"🧾":"🚶"};button.classList.remove("disabled");icon.textContent=currentZone.icon;label.textContent=busy?t("finishCurrentQueue"):t("standUp");return;
  }
  let nearest=null,best=Infinity;
  for(const zone of zones){
    const distance=Math.hypot(player.position.x-zone.x,player.position.z-zone.z);
    if(distance<best){best=distance;nearest=zone}
  }
  currentZone=best<2.15?nearest:null;
  button.classList.toggle("disabled",!currentZone);
  if(!currentZone){icon.textContent="👣";label.textContent=t("walkCloser");return}
  icon.textContent=currentZone.icon;
  if(currentZone.kind==="market")label.textContent=t("openMarket");
  else if(currentZone.kind==="stockroom")label.textContent=t("openStockroom");
  else if(currentZone.kind==="checkout")label.textContent=t("checkout");
  else if(currentZone.kind==="management")label.textContent=t("openManagement");
  else if(currentZone.kind==="trash")label.textContent=t("cleanTrash");
  else label.textContent=t("restock");
}

function interact(){
  if(!started||isPaused(false))return;
  if(ownerCheckoutSession){
    if(scan||checkoutQueue.length){toast(t("finishCurrentQueue"),1500);return}
    leaveOwnerSeat();toast(t("ownerStoodUp"));return;
  }
  if(!currentZone){toast(t("walkCloser"));return}
  if(currentZone.kind==="market"){
    if(state.tutorialStep===0)state.tutorialStep=1;
    save();updateHUD();openPanel("market");return;
  }
  if(currentZone.kind==="stockroom"){openPanel("stockroom");return}
  if(currentZone.kind==="checkout"){startScanning();return}
  if(currentZone.kind==="management"){openPanel("management");return}
  if(currentZone.kind==="trash"){cleanTrash(currentZone);return}
  if(currentZone.kind==="shelf")restockAtShelf(currentZone.id);
}

function restockAtShelf(id){
  if(!carrying){toast(t("notCarrying"));return}
  if(carrying.id!==id){toast(t("wrongShelf"));tone("miss");return}
  const beforeLevel=state.storeLevel;const result=restockShelf(state,carrying);
  if(!result.ok){toast(t(result.reason));return}
  toast(t("restocked",{amount:localNumber(result.amount),item:productName(id)}));tone("coin");
  if(state.storeLevel>beforeLevel)setTimeout(()=>toast(t("levelUp",{level:localNumber(state.storeLevel)}),2300),500);
  if(result.empty)carrying=null;
  if(state.tutorialStep===4)state.tutorialStep=5;
  forceCharacterAction(player,CHARACTER_ACTIONS.interact,1);
  refreshShelfVisual(id);save();updateHUD();updateWorldLabelText();updateCarriedCrate();
}

function updateHUD(){
  if(!TEXT)return;
  $("salesFund").textContent=money(state.salesFund);$("operatingBudget").textContent=money(state.operatingBudget);$("rep").textContent=`${localNumber(state.rep)}%`;$("dayNo").textContent=localNumber(state.day);
  $("storeLevel").textContent=localNumber(state.storeLevel);$("cleanliness").textContent=`${localNumber(state.cleanliness)}%`;
  $("cleanliness").parentElement.classList.toggle("warning-clean",state.cleanliness<55);
  $("queueCount").textContent=localNumber(checkoutQueue.length+(scan?1:0));
  const event=eventForDay(state.day);const eventKeys=EVENT_TEXT[event.id]||EVENT_TEXT.normal;
  $("eventEmoji").textContent=event.emoji;$("eventTitle").textContent=t(eventKeys[0]);$("eventDesc").textContent=t(eventKeys[1]);
  const goal=serveTarget(state);$("missionText").textContent=t("goalText",{served:localNumber(state.servedToday),target:localNumber(goal)});
  $("missionFill").style.width=`${Math.min(100,state.servedToday/goal*100)}%`;
  const tutorialKey=state.tutorialStep>=6?"tutorialDone":`tutorial${state.tutorialStep}`;
  $("tutorialText").textContent=t(tutorialKey);$("tutorial").classList.toggle("hidden",state.tutorialStep>6);
  $("carrying").classList.toggle("hidden",!carrying);
  if(carrying)$("carryingText").textContent=t("carrying",{amount:localNumber(carrying.amount),item:productName(carrying.id)});
  const cargo=cargoCount(state.truckCargo),deliveryVisible=state.delivery.active||state.delivery.arrived||state.delivery.unloading||cargo>0;
  $("deliveryStatus").classList.toggle("hidden",!deliveryVisible);
  if(deliveryVisible){
    const ratio=state.delivery.unloading?state.delivery.unloadProgress/state.delivery.unloadDuration:state.delivery.active?state.delivery.progress/state.delivery.duration:0;
    $("deliveryText").textContent=state.delivery.unloading?t("unloadingStatus",{seconds:localNumber(Math.max(0,Math.ceil(state.delivery.unloadDuration-state.delivery.unloadProgress))),count:localNumber(state.delivery.labourers)}):state.delivery.active?t("deliveryStatus",{seconds:localNumber(Math.max(0,Math.ceil(state.delivery.duration-state.delivery.progress)))}):state.delivery.arrived?t("truckNeedsUnload"):t("waitingDelivery");
    $("deliveryFill").style.width=`${Math.min(100,ratio*100)}%`;
  }
  const low=PRODUCTS.filter(item=>state.shelfStock[item.id]<=2).map(item=>productName(item.id));
  $("lowStock").classList.toggle("hidden",!low.length);
  if(low.length)$("lowStockText").textContent=t("lowStock",{items:low.join("، ")});
  $("staffBtn").classList.toggle("staff-active",Boolean(state.staff.cashier||state.staff.restocker));
  $("truckBtn")?.classList.toggle("transport-alert",Boolean(cargo||state.delivery.arrived||state.delivery.unloading));
  if(marketMarker)marketMarker.visible=state.tutorialStep<=2;
}

function openPanel(type){currentPanel=type;renderPanel(type);$("modalShade").classList.remove("hidden")}
function closePanel(){currentPanel=null;$("modalShade").classList.add("hidden")}

function panelFrame(icon,title,html){$("panelIcon").textContent=icon;$("panelTitle").textContent=title;$("panelBody").innerHTML=html}

function renderPanel(type){
  if(type==="market")renderMarket();
  else if(type==="transport")renderTransport();
  else if(type==="stockroom")renderStockroom();
  else if(type==="upgrades")renderUpgrades();
  else if(type==="staff")renderStaff();
  else if(type==="management")renderManagement();
  else renderSettings();
}

function achievementRows(){
  const goals=[
    ["firstSale",state.totalSales>=1,"🧾"],
    ["busyQueue",state.queueRecord>=5,"👥"],
    ["cleanStore",state.cleanliness>=95&&state.totalSales>=3,"🧹"],
    ["storeManager",state.storeLevel>=3,"🏆"]
  ];
  return goals.map(([key,done,icon])=>`<div class="achievement ${done?"done":""}"><span>${done?"✓":icon}</span><b>${t(key)}</b></div>`).join("");
}

function renderManagement(){
  const next=xpForNextLevel(state.storeLevel),xp=Math.min(next,state.storeXp);
  const pricing=PRODUCTS.map(item=>{
    const price=retailPrice(state,item.id),recommended=recommendedRetailPrice(state,item.id);
    return `<article class="price-card"><div class="product-art">${item.emoji}</div><div class="card-copy"><strong>${productName(item.id)}</strong><small>${brandName(item.id,item.brands[0].id)}</small><small>${t("recommendedPrice",{price:localNumber(recommended)})}</small><b>${t("currentPrice",{price:localNumber(price)})}</b></div><div class="price-controls"><button data-price="${item.id}" data-delta="-.05">−</button><button data-price="${item.id}" data-delta=".05">+</button></div></article>`;
  }).join("");
  const businessIcons={vending:"🥤",fruitStand:"🍎",foodCart:"🌭"};
  const businesses=Object.entries(BUSINESSES).map(([key,info])=>{
    const owned=state.businesses[key],locked=state.storeLevel<info.level;
    const status=owned?t("owned"):locked?t("levelLocked",{level:localNumber(info.level)}):money(info.cost);
    return `<article class="upgrade-card"><div class="product-art">${businessIcons[key]}</div><div class="card-copy"><strong>${t(key)}</strong><small>${t("dailyIncome",{income:localNumber(info.income)})}</small><small>${t("businessLocation")}</small></div><button class="card-btn green" data-business="${key}" ${owned||locked||state.operatingBudget<info.cost?"disabled":""}>${status}</button></article>`;
  }).join("");
  panelFrame("💻",t("management"),`<section class="manager-overview"><div><small>${t("storeLevel")}</small><b>${localNumber(state.storeLevel)}</b></div><div><small>${t("cleanliness")}</small><b>${localNumber(state.cleanliness)}%</b></div><div><small>${t("dailyIncomeLabel")}</small><b>${money(businessDailyIncome(state))}</b></div><i><em style="width:${xp/next*100}%"></em></i><small>${t("xpProgress",{xp:localNumber(xp),next:localNumber(next)})}</small></section><h3 class="panel-heading">🏷️ ${t("pricing")}</h3><p class="panel-note price-note">${t("pricingHint")}</p><div class="card-list">${pricing}</div><h3 class="panel-heading">🏪 ${t("businessServices")}</h3><div class="card-list">${businesses}</div><h3 class="panel-heading">🎯 ${t("achievements")}</h3><div class="achievement-grid">${achievementRows()}</div>`);
  $("panelBody").querySelectorAll("[data-price]").forEach(button=>button.addEventListener("click",()=>{
    changeRetailMarkup(state,button.dataset.price,Number(button.dataset.delta));save();refreshShelfVisual(button.dataset.price);updateHUD();updateWorldLabelText();renderManagement();
  }));
  $("panelBody").querySelectorAll("[data-business]").forEach(button=>button.addEventListener("click",()=>{
    const result=buyBusiness(state,button.dataset.business);
    if(!result.ok){toast(t(result.reason,{level:localNumber(result.level||0)}));tone("miss");return}
    refreshServiceBusinesses();save();updateHUD();toast(t("businessBought"),2100);tone("up");renderManagement();
  }));
}

function handleDispatchTruck(closeAfter=false){
  const result=dispatchTruck(state);
  if(!result.ok){toast(t(result.reason));tone("miss");return false}
  if(state.tutorialStep===2)state.tutorialStep=3;
  refreshTruckCargo();save();updateHUD();updateWorldLabelText();toast(t("truckDrivingStarted",{seconds:localNumber(result.duration)}),2300);tone("up");
  if(closeAfter)closePanel();else if(currentPanel)renderPanel(currentPanel);
  return true;
}

function handleStartUnloading(count){
  const result=startUnloading(state,count);
  if(!result.ok){toast(t(result.reason));tone("miss");return false}
  ensureLabourerModels();save();updateHUD();updateWorldLabelText();toast(t("labourersPaid",{count:localNumber(result.labourers),cost:localNumber(result.cost)}),2600);tone("up");closePanel();return true;
}

function renderTransport(){
  const waiting=cargoCount(state.truckCargo),onTruck=cargoCount(state.delivery.cargo),fee=deliveryFee(state);
  let status=t("truckEmptyStatus"),action="";
  if(state.delivery.unloading){
    const seconds=Math.max(0,Math.ceil(state.delivery.unloadDuration-state.delivery.unloadProgress));
    status=t("unloadingStatus",{seconds:localNumber(seconds),count:localNumber(state.delivery.labourers)});
  }else if(state.delivery.active){
    status=t("deliveryStatus",{seconds:localNumber(Math.max(0,Math.ceil(state.delivery.duration-state.delivery.progress)))});
  }else if(state.delivery.arrived){
    status=t("truckNeedsUnload");
    action=`<div class="labour-actions"><button id="oneLabourerBtn" class="card-btn green" ${state.operatingBudget<labourWage(1)?"disabled":""}>👷 ${t("hireOneLabourer")}<br>${money(labourWage(1))}</button><button id="twoLabourersBtn" class="card-btn green" ${state.operatingBudget<labourWage(2)?"disabled":""}>👷👷 ${t("hireTwoLabourers")}<br>${money(labourWage(2))}</button></div>`;
  }else if(waiting){
    status=t("truckAtMarket",{count:localNumber(waiting)});
    action=`<button id="transportDispatchBtn" class="transport-primary" ${state.operatingBudget<fee?"disabled":""}>🚚 ${t("driveTruck")}<small>${t("deliveryFee",{fee:localNumber(fee)})}</small></button>`;
  }
  const count=state.delivery.active||state.delivery.arrived||state.delivery.unloading?onTruck:waiting;
  panelFrame("🚚",t("transport"),`<div class="transport-card"><div class="transport-road"><span>🏬</span><i>······</i><span>🚚</span><i>······</i><span>🏪</span></div><strong>${status}</strong><small>${t("truckCargo",{count:localNumber(count)})} • ${t("truckDriverLabel")}</small></div><p class="panel-note">${t("transportHint")}</p>${action}`);
  $("transportDispatchBtn")?.addEventListener("click",()=>handleDispatchTruck(false));
  $("oneLabourerBtn")?.addEventListener("click",()=>handleStartUnloading(1));
  $("twoLabourersBtn")?.addEventListener("click",()=>handleStartUnloading(2));
}

function renderMarket(){
  const cards=PRODUCTS.map(item=>{
    const price=marketPrice(state,item.id),trend=marketTrend(state,item.id);
    const direct=price*3,fair=Math.max(5,Math.round(price*.96/5)*5)*3,bold=Math.max(5,Math.round(price*.9/5)*5)*3;
    const brands=item.brands.map(brand=>brandName(item.id,brand.id)).join(" • ");
    return `<article class="product-card market-card"><div class="product-art">${item.emoji}</div><div class="card-copy"><strong>${productName(item.id)}</strong><small class="brand-list">${t("brandNames",{brands})}</small><small>${t("packageUnit",{unit:productUnit(item.id)})}</small><small>${t("unitPrice",{price:localNumber(price)})} • ${t("sellingPrice",{price:localNumber(retailPrice(state,item.id))})}</small><small>${t("truckStock",{count:localNumber(state.truckCargo[item.id])})} • ${t("warehouseStock",{count:localNumber(state.warehouse[item.id])})}</small><i class="trend ${trend}">${t(trend)}</i></div><div class="bargain-actions"><button data-buy="${item.id}" data-offer="direct" ${state.salesFund<direct?"disabled":""}>${t("directOffer")}<br>${money(direct)}</button><button data-buy="${item.id}" data-offer="fair" ${state.salesFund<fair?"disabled":""}>${t("fairOffer")}<br>${money(fair)}</button><button data-buy="${item.id}" data-offer="bold" ${state.salesFund<bold?"disabled":""}>${t("boldOffer")}<br>${money(bold)}</button></div></article>`;
  }).join("");
  const cargo=cargoCount(state.truckCargo),fee=deliveryFee(state);
  const dispatchDisabled=!cargo||state.delivery.active||state.delivery.arrived||state.delivery.unloading||state.operatingBudget<fee;
  const truckSummary=`<div class="panel-note cargo-summary"><span>🚚 ${t("truckCargo",{count:localNumber(cargo)})}<br><small>${t("deliveryFee",{fee:localNumber(fee)})}</small></span><button id="dispatchTruckBtn" class="card-btn green" ${dispatchDisabled?"disabled":""}>${state.delivery.active?t("deliveryRunning"):t("driveTruck")}</button></div>`;
  panelFrame("🤝",t("market"),`<p class="panel-note">${t("marketHint")}</p>${truckSummary}<p class="panel-note price-note">📊 ${t("priceReference",{date:PRICE_REFERENCE.asOf})}<br>🔄 ${t("priceChangesDaily")}</p><div class="card-list">${cards}</div>`);
  $("panelBody").querySelectorAll("[data-buy]").forEach(button=>button.addEventListener("click",()=>{
    const id=button.dataset.buy;const result=bargainPurchase(state,id,3,button.dataset.offer);
    if(!result.ok){toast(t(result.reason));tone("miss");return}
    if(state.tutorialStep===1)state.tutorialStep=2;
    toast(t("dealAccepted",{amount:localNumber(result.amount)}));tone("coin");refreshTruckCargo();save();updateHUD();updateWorldLabelText();renderMarket();
  }));
  const dispatchButton=$("dispatchTruckBtn");
  dispatchButton?.addEventListener("click",()=>handleDispatchTruck(true));
}

function renderStaff(){
  const level=state.staff.cashier,cost=cashierHireCost(state),wage=cashierWage(state),max=level>=2;
  const action=max?t("staffMaxed"):level?t("upgradeCashier"):t("hireCashier");
  const status=level?`<small class="active-staff">✓ ${t("automaticCheckout")}</small>`:"";
  const button=max?`<button class="card-btn green" disabled>${t("maxed")}</button>`:`<button class="card-btn green" id="hireCashierBtn" ${state.operatingBudget<cost?"disabled":""}>${action}<br>${money(cost)}</button>`;
  const cashierCard=`<article class="upgrade-card"><div class="product-art">👨‍💼</div><div class="card-copy"><strong>${t("cashier")}</strong><small>${t("cashierDesc")}</small><small>${t("cashierLevel",{level:localNumber(level)})}</small><small>${t("dailyWage",{wage:localNumber(wage)})}</small>${status}</div>${button}</article>`;
  const restockLevel=state.staff.restocker,restockCost=restockerHireCost(state),restockWage=restockerWage(state),restockMax=restockLevel>=2;
  const restockAction=restockMax?t("staffMaxed"):restockLevel?t("upgradeRestocker"):t("hireRestocker");
  const restockButton=restockMax?`<button class="card-btn green" disabled>${t("maxed")}</button>`:`<button class="card-btn green" id="hireRestockerBtn" ${state.operatingBudget<restockCost?"disabled":""}>${restockAction}<br>${money(restockCost)}</button>`;
  const restockCard=`<article class="upgrade-card"><div class="product-art">📦</div><div class="card-copy"><strong>${t("restocker")}</strong><small>${t("restockerDesc")}</small><small>${t("cashierLevel",{level:localNumber(restockLevel)})}</small><small>${t("dailyWage",{wage:localNumber(restockWage)})}</small>${restockLevel?`<small class="active-staff">✓ ${t("automaticRestock")}</small>`:""}</div>${restockButton}</article>`;
  panelFrame("👨‍💼",t("staff"),`<p class="panel-note">${t("staffHint")}</p><div class="card-list">${cashierCard}${restockCard}</div>`);
  $("hireCashierBtn")?.addEventListener("click",()=>{
    const result=hireCashier(state);
    if(!result.ok){toast(t(result.reason));tone("miss");return}
    cashierCooldown=.5;refreshCashierCharacter();save();updateHUD();updateWorldLabelText();toast(t("staffHired"),2200);tone("up");renderStaff();
  });
  $("hireRestockerBtn")?.addEventListener("click",()=>{
    const result=hireRestocker(state);
    if(!result.ok){toast(t(result.reason));tone("miss");return}
    restockerCooldown=.5;refreshRestockerCharacter();save();updateHUD();updateWorldLabelText();toast(t("restockerHired"),2200);tone("up");renderStaff();
  });
}

function renderStockroom(){
  const available=PRODUCTS.filter(item=>state.warehouse[item.id]>0);
  let cards=available.map(item=>`<article class="product-card"><div class="product-art">${item.emoji}</div><div class="card-copy"><strong>${productName(item.id)}</strong><small>${t("warehouseStock",{count:localNumber(state.warehouse[item.id])})}</small></div><button class="card-btn green" data-pick="${item.id}" ${carrying?"disabled":""}>${t("pick")}</button></article>`).join("");
  if(!cards)cards=`<p class="panel-note">${state.delivery.unloading?t("unloadingRunning"):state.delivery.arrived?t("truckNeedsUnload"):state.delivery.active?t("deliveryRunning"):cargoCount(state.truckCargo)?t("waitingDelivery"):t("warehouseEmpty")}</p>`;
  const carryNote=carrying?`<p class="panel-note">${t("carrying",{amount:localNumber(carrying.amount),item:productName(carrying.id)})}</p>`:"";
  panelFrame("📦",t("stockroom"),`${carryNote}<p class="panel-note">${t("stockroomHint")}</p><div class="card-list">${cards}</div>`);
  $("panelBody").querySelectorAll("[data-pick]").forEach(button=>button.addEventListener("click",()=>{
    if(carrying)return;
    const result=takeCrate(state,button.dataset.pick);
    if(!result.ok){toast(t(result.reason));return}
    carrying={id:result.id,amount:result.amount};
    if(state.tutorialStep===3)state.tutorialStep=4;
    forceCharacterAction(player,CHARACTER_ACTIONS.pickup,.85);
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
    return `<article class="upgrade-card"><div class="product-art">${info[0]}</div><div class="card-copy"><strong>${t(info[1])}</strong><small>${t(info[2])}</small><small>${t("level",{level:localNumber(level)})}</small>${levelBars(level)}</div><button class="card-btn green" data-upgrade="${key}" ${max||state.operatingBudget<cost?"disabled":""}>${max?t("maxed"):`${t("upgrade")}<br>${money(cost)}`}</button></article>`;
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
    localStorage.removeItem(SAVE_KEY);state=createState(null,null);carrying=null;clearCustomers();clearTrash();clearLabourerModels();player.position.set(0,0,8.5);spawnClock=1.8;cashierCooldown=.8;restockerCooldown=2.5;truckArrivalHold=0;refreshAllShelfVisuals();refreshCashierCharacter();refreshRestockerCharacter();refreshServiceBusinesses();refreshTruckCargo();if(deliveryTruck)deliveryTruck.position.set(4.35,0,23.4);save();closePanel();applyLanguage();updateCarriedCrate();
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
    const distance=Math.hypot(player.position.x+3.45,player.position.z-21.55);
    if(distance<2.4){
      if(state.tutorialStep===0)state.tutorialStep=1;
      save();updateHUD();openPanel("market");
    }else{toast(t("walkCloser"));marketMarker.visible=true}
  });
  $("truckBtn").addEventListener("click",()=>openPanel("transport"));
  $("upgradesBtn").addEventListener("click",()=>openPanel("upgrades"));
  $("managementBtn").addEventListener("click",()=>openPanel("management"));
  $("staffBtn").addEventListener("click",()=>openPanel("staff"));
  $("actionBtn").addEventListener("click",interact);
  $("panelClose").addEventListener("click",closePanel);
  $("modalShade").addEventListener("click",event=>{if(event.target===$("modalShade"))closePanel()});
  $("nextDayBtn").addEventListener("click",nextDay);

  const base=$("joystick"),nub=$("joystickNub"),touchPointers=new Map();
  let mouseDrag=null,pinchDistance=0;
  const beginScreenMovement=event=>{
    joystick.id=event.pointerId;joystick.originX=event.clientX;joystick.originY=event.clientY;joystick.x=0;joystick.y=0;
    base.style.left=`${event.clientX-58}px`;base.style.top=`${event.clientY-58}px`;base.classList.add("active");nub.style.transform="translate(0,0)";
  };
  const moveScreenMovement=event=>{
    if(event.pointerId!==joystick.id)return;
    const max=72;let dx=event.clientX-joystick.originX,dy=event.clientY-joystick.originY;const length=Math.hypot(dx,dy);
    if(length>max){dx=dx/length*max;dy=dy/length*max}
    joystick.x=dx/max;joystick.y=dy/max;nub.style.transform=`translate(${dx*.46}px,${dy*.46}px)`;
  };
  const endScreenMovement=id=>{
    if(id!==joystick.id)return;
    joystick.id=null;joystick.x=0;joystick.y=0;base.classList.remove("active");nub.style.transform="translate(0,0)";
  };
  renderer.domElement.addEventListener("pointerdown",event=>{
    if(!started||isPaused(false))return;
    renderer.domElement.setPointerCapture(event.pointerId);
    if(event.pointerType==="touch"||event.pointerType==="pen"){
      touchPointers.set(event.pointerId,{x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY});
      if(joystick.id===null)beginScreenMovement(event);
      if(touchPointers.size===2){const points=[...touchPointers.values()];pinchDistance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y)}
    }else mouseDrag={id:event.pointerId,x:event.clientX,y:event.clientY};
    event.preventDefault();
  });
  renderer.domElement.addEventListener("pointermove",event=>{
    if(touchPointers.has(event.pointerId)){
      const point=touchPointers.get(event.pointerId),dx=event.clientX-point.lastX,dy=event.clientY-point.lastY;
      point.x=event.clientX;point.y=event.clientY;point.lastX=event.clientX;point.lastY=event.clientY;
      moveScreenMovement(event);
      if(event.pointerId!==joystick.id){cameraYaw-=dx*.01;cameraPitch=clamp(cameraPitch+dy*.003,.12,.72)}
      if(touchPointers.size>=2){
        const points=[...touchPointers.values()],distance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);
        state.cameraDistance=clamp(state.cameraDistance-(distance-pinchDistance)*.034,8,30);pinchDistance=distance;
      }
      event.preventDefault();return;
    }
    if(!mouseDrag||mouseDrag.id!==event.pointerId)return;
    const dx=event.clientX-mouseDrag.x,dy=event.clientY-mouseDrag.y;mouseDrag.x=event.clientX;mouseDrag.y=event.clientY;
    cameraYaw-=dx*.009;cameraPitch=clamp(cameraPitch+dy*.003,.12,.72);event.preventDefault();
  });
  const endPointer=event=>{
    touchPointers.delete(event.pointerId);endScreenMovement(event.pointerId);
    if(mouseDrag?.id===event.pointerId)mouseDrag=null;
    if(touchPointers.size<2)pinchDistance=0;
    save();
  };
  renderer.domElement.addEventListener("pointerup",endPointer);renderer.domElement.addEventListener("pointercancel",endPointer);
  renderer.domElement.addEventListener("wheel",event=>{state.cameraDistance=clamp(state.cameraDistance+Math.sign(event.deltaY)*1.1,8,30);save();event.preventDefault()},{passive:false});
  addEventListener("keydown",event=>{keys[event.code]=true;if(event.code==="KeyE"||event.code==="Space"){event.preventDefault();interact()}if(event.code==="Escape")closePanel()});
  addEventListener("keyup",event=>{keys[event.code]=false});
  addEventListener("resize",onResize);
  document.addEventListener("visibilitychange",()=>{if(document.hidden){endScreenMovement(joystick.id);touchPointers.clear()}});
  addEventListener("pagehide",save);
}

function onResize(){if(!camera||!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.35))}

function animate(time){
  requestAnimationFrame(animate);
  const delta=Math.min(.05,Math.max(.001,(time-(animate.last||time))/1000));animate.last=time;worldTime+=delta;
  if(marketMarker){marketMarker.rotation.y+=delta*.75;marketMarker.position.y=Math.sin(worldTime*2.2)*.08}
  for(const rotor of movingDecor)rotor.rotation.y+=delta*3.2;
  if(started&&!isPaused(false)){
    updateDeliveryTruck(delta);updatePlayer(delta);updateSpawning(delta);
    for(const customer of [...customers])updateCustomer(customer,delta);
    updateAutomaticCheckout(delta);updateScan(delta);updateOwnerCheckout(delta);animateCashier(delta);updateRestocker(delta);updateInteractions();
    resolvePeopleOverlaps();for(const customer of customers)syncCustomerTrolley(customer);
    labelRefreshClock+=delta;if(labelRefreshClock>=.3){labelRefreshClock=0;updateWorldLabelText()}
    autosaveClock+=delta;if(autosaveClock>=5){autosaveClock=0;save()}
  }
  updateCharacterAnimations(delta);
  updateCamera(delta);updateLabels();renderer.render(scene,camera);
}

async function initialize(){
  try{
    const loadingText=$("loading")?.querySelector("strong");if(loadingText)loadingText.textContent=t("loadingCharacters");
    await loadCharacterAssets();
    buildWorld();setupControls();applyLanguage();updateHUD();updateInteractions();updateCarriedCrate();
    window.__BAZAAR_GAME_READY__=true;
    $("loading").classList.add("hidden");
    requestAnimationFrame(animate);
  }catch(error){
    console.error(error);
    if(window.__BAZAAR_BOOT_FAIL__)window.__BAZAAR_BOOT_FAIL__(characterAssets.ready?"WORLD_INIT":"CHARACTER_ASSETS",error);
    else{$("loading").classList.add("hidden");$("startOverlay").classList.add("hidden");$("webglError").classList.remove("hidden")}
  }
}

initialize();
