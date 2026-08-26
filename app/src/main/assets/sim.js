export const PRICE_REFERENCE={
  asOf:"2026-08-20",
  label:"Pakistan Bureau of Statistics Weekly SPI + Pakistan retail benchmarks"
};

export const PRODUCTS=[
  {id:"flour",emoji:"🌾",color:0xd7b77a,cost:1215,sell:1325,shape:"bag",n:{ur:"آٹا",hi:"आटा",en:"Flour"},unit:{ur:"10 کلو تھیلا",hi:"10 किलो बैग",en:"10 kg bag"},brands:[
    {id:"sunehri",color:"#c88d28",accent:"#773f16",n:{ur:"سنہری آٹا",hi:"सुनहरी आटा",en:"Sunehri Atta"}},
    {id:"kisan",color:"#3b8d51",accent:"#e9bd47",n:{ur:"کسان چکی",hi:"किसान चक्की",en:"Kisan Chakki"}},
    {id:"punjab",color:"#b13d32",accent:"#f7d67a",n:{ur:"پنجاب گولڈ",hi:"पंजाब गोल्ड",en:"Punjab Gold"}}
  ]},
  {id:"rice",emoji:"🍚",color:0xf4efe3,cost:198,sell:220,shape:"bag",n:{ur:"باسمتی چاول",hi:"बासमती चावल",en:"Basmati rice"},unit:{ur:"1 کلو پیک",hi:"1 किलो पैक",en:"1 kg pack"},brands:[
    {id:"mehran",color:"#326f9f",accent:"#f2ce57",n:{ur:"مہران باسمتی",hi:"मेहरान बासमती",en:"Mehran Basmati"}},
    {id:"sella",color:"#6a3c8f",accent:"#f0d36c",n:{ur:"سیلا کنگ",hi:"सेला किंग",en:"Sella King"}},
    {id:"pakaroma",color:"#267554",accent:"#e9d8a6",n:{ur:"پاک اروما",hi:"पाक अरोमा",en:"Pak Aroma"}}
  ]},
  {id:"ghee",emoji:"🫙",color:0xf4c542,cost:575,sell:615,shape:"tin",n:{ur:"گھی",hi:"घी",en:"Ghee"},unit:{ur:"1 کلو پاؤچ",hi:"1 किलो पाउच",en:"1 kg pouch"},brands:[
    {id:"latif",color:"#d43e2f",accent:"#ffe074",n:{ur:"لطیف گھی",hi:"लतीफ़ घी",en:"Latif Ghee"}},
    {id:"handi",color:"#176b56",accent:"#f2c44b",n:{ur:"ہانڈی گھی",hi:"हांडी घी",en:"Handi Ghee"}},
    {id:"sunehri-banaspati",color:"#e4a526",accent:"#7b321d",n:{ur:"سنہری بناسپتی",hi:"सुनहरी वनस्पति",en:"Sunehri Banaspati"}}
  ]},
  {id:"oil",emoji:"🧴",color:0xe7a831,cost:580,sell:615,shape:"bottle",n:{ur:"کوکنگ آئل",hi:"कुकिंग ऑयल",en:"Cooking oil"},unit:{ur:"1 لیٹر بوتل",hi:"1 लीटर बोतल",en:"1 litre bottle"},brands:[
    {id:"sultan",color:"#df8e1c",accent:"#263b70",n:{ur:"سلطان آئل",hi:"सुल्तान ऑयल",en:"Sultan Oil"}},
    {id:"canola-gold",color:"#f0b927",accent:"#287848",n:{ur:"کینولا گولڈ",hi:"कैनोला गोल्ड",en:"Canola Gold"}},
    {id:"pakwan",color:"#bf3c2f",accent:"#ffd662",n:{ur:"پکوان آئل",hi:"पकवान ऑयल",en:"Pakwan Oil"}}
  ]},
  {id:"sugar",emoji:"🧂",color:0xf3e7d1,cost:135,sell:150,shape:"bag",n:{ur:"چینی",hi:"चीनी",en:"Sugar"},unit:{ur:"1 کلو پیک",hi:"1 किलो पैक",en:"1 kg pack"},brands:[
    {id:"shakar-gold",color:"#d69b32",accent:"#7a3f1d",n:{ur:"شکر گولڈ",hi:"शक्कर गोल्ड",en:"Shakar Gold"}},
    {id:"meethas",color:"#df5f72",accent:"#fff2d6",n:{ur:"مٹھاس",hi:"मिठास",en:"Meethas"}},
    {id:"punjab-sugar",color:"#2f8355",accent:"#f1cf66",n:{ur:"پنجاب شوگر",hi:"पंजाब शुगर",en:"Punjab Sugar"}}
  ]},
  {id:"pulses",emoji:"🥣",color:0xd57b48,cost:235,sell:260,shape:"pouch",n:{ur:"دال مسور",hi:"मसूर दाल",en:"Masoor lentils"},unit:{ur:"1 کلو پیک",hi:"1 किलो पैक",en:"1 kg pack"},brands:[
    {id:"sunehri-daal",color:"#d77937",accent:"#ffe08a",n:{ur:"سنہری دال",hi:"सुनहरी दाल",en:"Sunehri Daal"}},
    {id:"mehran-masoor",color:"#a33b35",accent:"#f5cc75",n:{ur:"مہران مسور",hi:"मेहरान मसूर",en:"Mehran Masoor"}},
    {id:"kisan-daal",color:"#3b7b4d",accent:"#f1d876",n:{ur:"کسان دال",hi:"किसान दाल",en:"Kisan Daal"}}
  ]},
  {id:"milk",emoji:"🥛",color:0xeaf4f7,cost:200,sell:220,shape:"carton",n:{ur:"دودھ",hi:"दूध",en:"Milk"},unit:{ur:"1 لیٹر پیک",hi:"1 लीटर पैक",en:"1 litre carton"},brands:[
    {id:"sehat-milk",color:"#3a8dcc",accent:"#f7f3dd",n:{ur:"صحت ملک",hi:"सेहत मिल्क",en:"Sehat Milk"}},
    {id:"punjab-fresh",color:"#2c8a62",accent:"#f4d770",n:{ur:"پنجاب فریش",hi:"पंजाब फ्रेश",en:"Punjab Fresh"}},
    {id:"doodh-ghar",color:"#7c56a2",accent:"#f4e6ff",n:{ur:"دودھ گھر",hi:"दूध घर",en:"Doodh Ghar"}}
  ]},
  {id:"salt",emoji:"🧂",color:0xf5f3ec,cost:55,sell:65,shape:"packet",n:{ur:"نمک",hi:"नमक",en:"Salt"},unit:{ur:"800 گرام پیک",hi:"800 ग्राम पैक",en:"800 g pack"},brands:[
    {id:"pak-namak",color:"#3277a8",accent:"#f7f7f2",n:{ur:"پاک نمک",hi:"पाक नमक",en:"Pak Namak"}},
    {id:"mountain-salt",color:"#c25c62",accent:"#ffe0d2",n:{ur:"ماؤنٹین سالٹ",hi:"माउंटेन साल्ट",en:"Mountain Salt"}},
    {id:"sehat-salt",color:"#21836c",accent:"#f1db6e",n:{ur:"صحت نمک",hi:"सेहत नमक",en:"Sehat Salt"}}
  ]},
  {id:"biscuit",emoji:"🍪",color:0xd4683a,cost:88,sell:110,shape:"packet",n:{ur:"بسکٹ",hi:"बिस्कुट",en:"Biscuits"},unit:{ur:"100 گرام پیک",hi:"100 ग्राम पैक",en:"100 g pack"},brands:[
    {id:"crispy",color:"#c63c2f",accent:"#f7d05b",n:{ur:"کرسپی بائٹ",hi:"क्रिस्पी बाइट",en:"Crispy Bite"}},
    {id:"family",color:"#744626",accent:"#f5c64b",n:{ur:"فیملی بسکٹ",hi:"फैमिली बिस्कुट",en:"Family Biscuit"}},
    {id:"fun",color:"#315ea8",accent:"#f4bd3b",n:{ur:"فن بسکٹ",hi:"फन बिस्कुट",en:"Fun Biscuit"}}
  ]},
  {id:"toffee",emoji:"🍬",color:0xe84b78,cost:205,sell:240,shape:"pouch",n:{ur:"ٹافی",hi:"टॉफ़ी",en:"Toffee"},unit:{ur:"50 عدد پاؤچ",hi:"50 नग पाउच",en:"50-piece pouch"},brands:[
    {id:"masti",color:"#db3d75",accent:"#ffd55c",n:{ur:"مستی ٹافی",hi:"मस्ती टॉफ़ी",en:"Masti Toffee"}},
    {id:"milky",color:"#4c8cc5",accent:"#fff2ce",n:{ur:"ملکی ڈراپ",hi:"मिल्की ड्रॉप",en:"Milky Drop"}},
    {id:"fruit-pop",color:"#5aa947",accent:"#f4753e",n:{ur:"فروٹ پاپ",hi:"फ्रूट पॉप",en:"Fruit Pop"}}
  ]}
];

export const EVENTS=[
  {id:"normal",emoji:"☀️"},
  {id:"wedding",emoji:"💍",products:["ghee","oil"],demand:1.18},
  {id:"ration",emoji:"🛒",products:["flour","rice"],demand:1.16},
  {id:"school",emoji:"🎒",products:["biscuit","toffee","milk"],demand:1.22},
  {id:"inflation",emoji:"📈",market:1.09,retail:1.055},
  {id:"rush",emoji:"⚡",spawn:.68},
  {id:"festival",emoji:"🌙",products:["sugar","pulses","ghee"],demand:1.2}
];

export const DIFFICULTY={
  easy:{customers:7,serveRatio:.72,expense:.78},
  normal:{customers:9,serveRatio:.78,expense:1},
  hard:{customers:11,serveRatio:.82,expense:1.24}
};

export const DEFAULT_STOCK={flour:18,rice:18,ghee:18,oil:18,sugar:18,pulses:18,milk:18,salt:18,biscuit:18,toffee:18};
export const BUSINESSES={
  vending:{cost:9000,level:2,income:650},
  fruitStand:{cost:15000,level:3,income:1050},
  foodCart:{cost:26000,level:5,income:1750}
};
export const copy=value=>JSON.parse(JSON.stringify(value));
export const productById=id=>PRODUCTS.find(item=>item.id===id)||PRODUCTS[0];
export const brandById=(product,id)=>product.brands.find(brand=>brand.id===id)||product.brands[0];
export const eventForDay=day=>EVENTS[(Math.max(1,day)-1)%EVENTS.length];
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const roundFive=value=>Math.max(5,Math.round(value/5)*5);
const emptyCargo=()=>Object.fromEntries(PRODUCTS.map(item=>[item.id,0]));
export function syncCash(state){state.cash=Math.max(0,Number(state.salesFund||0))+Math.max(0,Number(state.operatingBudget||0));return state.cash}
export function cameraRelativeVector(yaw,inputX,inputForward){
  return {
    x:Math.cos(yaw)*inputX-Math.sin(yaw)*inputForward,
    z:-Math.sin(yaw)*inputX-Math.cos(yaw)*inputForward
  };
}

export function createState(saved,legacy){
  const source=saved&&saved.version>=3?saved:null;
  const old=legacy||{};
  const legacyCash=Math.max(0,Number(source?.cash??old.cash??12000));
  const hasSplit=Number.isFinite(Number(source?.salesFund))&&Number.isFinite(Number(source?.operatingBudget));
  const salesFund=hasSplit?Math.max(0,Number(source.salesFund)):source||Object.keys(old).length?Math.round(legacyCash*.72):9000;
  const operatingBudget=hasSplit?Math.max(0,Number(source.operatingBudget)):source||Object.keys(old).length?legacyCash-Math.round(legacyCash*.72):3000;
  const state={
    version:7,
    lang:source?.lang||old.lang||"ur",
    difficulty:source?.difficulty||old.difficulty||"normal",
    sound:source?.sound??old.sound??true,
    cash:legacyCash,
    salesFund,
    operatingBudget,
    rep:Number(source?.rep??old.rep??35),
    day:Number(source?.day??old.day??1),
    totalSales:Number(source?.totalSales??old.sales??0),
    shelfStock:{},warehouse:{},truckCargo:{},
    delivery:{active:Boolean(source?.delivery?.active),cargo:{},progress:Math.max(0,Number(source?.delivery?.progress??0)),duration:Math.max(6,Number(source?.delivery?.duration??10))},
    upgrades:{capacity:0,checkout:0,decor:0},
    staff:{cashier:0,restocker:0},
    businesses:{vending:false,fruitStand:false,foodCart:false},
    priceMarkup:{},
    storeLevel:Math.max(1,Number(source?.storeLevel??1)),
    storeXp:Math.max(0,Number(source?.storeXp??0)),
    cleanliness:clamp(Number(source?.cleanliness??100),0,100),
    achievements:Array.isArray(source?.achievements)?source.achievements.filter(value=>typeof value==="string"):[],
    carrying:source?.carrying&&PRODUCTS.some(item=>item.id===source.carrying.id)
      ?{id:source.carrying.id,amount:Math.max(1,Number(source.carrying.amount)||1)}
      :null,
    servedToday:Number(source?.servedToday??0),
    missedToday:Number(source?.missedToday??0),
    revenueToday:Number(source?.revenueToday??0),
    handledToday:Number(source?.handledToday??0),
    dayComplete:Boolean(source?.dayComplete),
    lastDay:source?.lastDay||null,
    seen3DIntro:Boolean(source?.seen3DIntro),
    tutorialStep:Number(source?.tutorialStep??0),
    queueRecord:Math.max(0,Number(source?.queueRecord??0)),
    cameraDistance:clamp(Number(source?.version>=7?source.cameraDistance:18),8,30)
  };
  for(const item of PRODUCTS){
    const legacyAmount=old.stock&&Number.isFinite(old.stock[item.id])?old.stock[item.id]:DEFAULT_STOCK[item.id];
    state.shelfStock[item.id]=Math.max(0,Number(source?.shelfStock?.[item.id]??legacyAmount));
    state.warehouse[item.id]=Math.max(0,Number(source?.warehouse?.[item.id]??0));
    state.truckCargo[item.id]=Math.max(0,Number(source?.truckCargo?.[item.id]??0));
    state.delivery.cargo[item.id]=Math.max(0,Number(source?.delivery?.cargo?.[item.id]??0));
    state.priceMarkup[item.id]=clamp(Number(source?.priceMarkup?.[item.id]??1),.85,1.3);
  }
  state.upgrades.capacity=clamp(Number(source?.upgrades?.capacity??old.upgrades?.shelf??0),0,3);
  state.upgrades.checkout=clamp(Number(source?.upgrades?.checkout??0),0,3);
  state.upgrades.decor=clamp(Number(source?.upgrades?.decor??old.upgrades?.lights??0),0,3);
  state.staff.cashier=clamp(Number(source?.staff?.cashier??0),0,2);
  state.staff.restocker=clamp(Number(source?.staff?.restocker??0),0,2);
  for(const key of Object.keys(BUSINESSES))state.businesses[key]=Boolean(source?.businesses?.[key]);
  if(!DIFFICULTY[state.difficulty])state.difficulty="normal";
  if(!["ur","hi","en"].includes(state.lang))state.lang="ur";
  syncCash(state);
  return state;
}

export function shelfCapacity(state){return 18+state.upgrades.capacity*6}

export function marketPrice(state,id){
  const item=productById(id);
  const pattern=[-.045,.025,.06,-.02,.04,-.035,.012];
  const wave=pattern[(state.day*2+PRODUCTS.indexOf(item)*3)%pattern.length];
  const growth=1+Math.min(60,state.day-1)*.0025;
  return roundFive(item.cost*(eventForDay(state.day).market||1)*(1+wave)*growth);
}

export function recommendedRetailPrice(state,id){
  const item=productById(id);
  const pattern=[.018,-.012,.027,-.02,.011,.032,-.007];
  const wave=pattern[(state.day+PRODUCTS.indexOf(item)*2)%pattern.length];
  const growth=1+Math.min(60,state.day-1)*.0025;
  const price=roundFive(item.sell*(eventForDay(state.day).retail||1)*(1+wave)*growth);
  return Math.max(price,roundFive(marketPrice(state,id)*1.055));
}

export function retailPrice(state,id){
  const markup=clamp(Number(state.priceMarkup?.[id]??1),.85,1.3);
  return Math.max(roundFive(marketPrice(state,id)*1.02),roundFive(recommendedRetailPrice(state,id)*markup));
}

export function changeRetailMarkup(state,id,delta){
  if(!PRODUCTS.some(item=>item.id===id))return {ok:false,reason:"unknownProduct"};
  state.priceMarkup=state.priceMarkup||{};
  state.priceMarkup[id]=clamp(Math.round(((state.priceMarkup[id]??1)+Number(delta||0))*100)/100,.85,1.3);
  return {ok:true,markup:state.priceMarkup[id],price:retailPrice(state,id),recommended:recommendedRetailPrice(state,id)};
}

export function priceAcceptanceChance(state,id){
  const ratio=retailPrice(state,id)/Math.max(1,recommendedRetailPrice(state,id));
  return clamp(1-Math.max(0,ratio-1)*2.65,.3,1);
}

export function marketTrend(state,id){
  const item=productById(id);
  const ratio=marketPrice(state,id)/item.cost;
  return ratio<.975?"cheap":ratio>1.035?"expensive":"normalPrice";
}

export function buyWarehouse(state,id,quantity){
  return bargainPurchase(state,id,quantity,"direct",()=>0);
}

export const BARGAIN_OFFERS={direct:{factor:1,chance:1},fair:{factor:.96,chance:.8},bold:{factor:.9,chance:.46}};

export function bargainPurchase(state,id,quantity,offer="direct",random=Math.random){
  const amount=Math.max(1,Math.floor(quantity));
  const deal=BARGAIN_OFFERS[offer]||BARGAIN_OFFERS.direct;
  const unitPrice=roundFive(marketPrice(state,id)*deal.factor);
  const cost=unitPrice*amount;
  if(state.salesFund<cost)return {ok:false,reason:"notEnoughSalesFund",cost,unitPrice};
  const chance=offer==="direct"?1:Math.min(.94,deal.chance+(Number(state.rep)||0)*.0012);
  if(random()>chance)return {ok:false,reason:"bargainRejected",cost,unitPrice,chance};
  state.salesFund-=cost;
  state.truckCargo[id]=(state.truckCargo[id]||0)+amount;
  syncCash(state);
  return {ok:true,cost,unitPrice,amount,discount:marketPrice(state,id)-unitPrice,offer};
}

export function cargoCount(cargo){return PRODUCTS.reduce((sum,item)=>sum+Math.max(0,Number(cargo?.[item.id]||0)),0)}
export function deliveryFee(state){return 300+Math.min(500,(state.day-1)*20)}

export function dispatchTruck(state){
  if(state.delivery.active)return {ok:false,reason:"deliveryRunning"};
  const count=cargoCount(state.truckCargo);
  if(!count)return {ok:false,reason:"truckEmpty"};
  const fee=deliveryFee(state);
  if(state.operatingBudget<fee)return {ok:false,reason:"notEnoughBudget",fee};
  state.operatingBudget-=fee;
  state.delivery={active:true,cargo:copy(state.truckCargo),progress:0,duration:10};
  state.truckCargo=emptyCargo();
  syncCash(state);
  return {ok:true,fee,count,duration:state.delivery.duration};
}

export function advanceDelivery(state,delta){
  if(!state.delivery.active)return null;
  state.delivery.progress=Math.min(state.delivery.duration,state.delivery.progress+Math.max(0,Number(delta)||0));
  if(state.delivery.progress<state.delivery.duration)return {arrived:false,ratio:state.delivery.progress/state.delivery.duration};
  const cargo=copy(state.delivery.cargo);
  for(const item of PRODUCTS)state.warehouse[item.id]=(state.warehouse[item.id]||0)+(cargo[item.id]||0);
  state.delivery={active:false,cargo:emptyCargo(),progress:0,duration:10};
  return {arrived:true,cargo,count:cargoCount(cargo)};
}

export function takeCrate(state,id){
  const available=state.warehouse[id]||0;
  if(available<=0)return {ok:false,reason:"warehouseEmpty"};
  const amount=Math.min(3,available);
  state.warehouse[id]-=amount;
  return {ok:true,id,amount};
}

export function restockShelf(state,carrying){
  if(!carrying)return {ok:false,reason:"notCarrying"};
  const room=shelfCapacity(state)-state.shelfStock[carrying.id];
  if(room<=0)return {ok:false,reason:"shelfFull"};
  const amount=Math.min(room,carrying.amount);
  state.shelfStock[carrying.id]+=amount;
  carrying.amount-=amount;
  awardStoreXp(state,amount*3);
  return {ok:true,amount,empty:carrying.amount<=0};
}

export function xpForNextLevel(level){return 120+Math.max(1,Math.floor(level))*80}

export function awardStoreXp(state,amount){
  const before=Math.max(1,Math.floor(state.storeLevel||1));
  state.storeLevel=before;
  state.storeXp=Math.max(0,Number(state.storeXp||0))+Math.max(0,Number(amount)||0);
  while(state.storeXp>=xpForNextLevel(state.storeLevel)&&state.storeLevel<30){
    state.storeXp-=xpForNextLevel(state.storeLevel);
    state.storeLevel++;
  }
  return {level:state.storeLevel,levelsGained:state.storeLevel-before,xp:state.storeXp,next:xpForNextLevel(state.storeLevel)};
}

export function createOrder(state,random=Math.random){
  const event=eventForDay(state.day);
  let item;
  if(event.products&&random()<.68)item=productById(event.products[Math.floor(random()*event.products.length)]);
  else item=PRODUCTS[Math.floor(random()*PRODUCTS.length)];
  const maxQuantity=Math.min(3,1+Math.floor((state.day-1)/4));
  const quantity=1+Math.floor(random()*Math.max(1,maxQuantity));
  const price=retailPrice(state,item.id)*quantity;
  const brand=item.brands[Math.floor(random()*item.brands.length)]||item.brands[0];
  return {id:`order-${Date.now()}-${Math.floor(random()*1e6)}`,product:item.id,brand:brand.id,quantity,unitPrice:retailPrice(state,item.id),price};
}

export function takeShelfItems(state,order){
  if((state.shelfStock[order.product]||0)<order.quantity)return false;
  state.shelfStock[order.product]-=order.quantity;
  return true;
}

export function completeSale(state,order){
  state.salesFund+=order.price;
  syncCash(state);
  state.totalSales++;
  state.servedToday++;
  state.handledToday++;
  state.revenueToday+=order.price;
  state.rep=Math.min(100,state.rep+1+state.upgrades.decor);
  awardStoreXp(state,18+Math.max(1,Number(order.quantity)||1)*4);
  return maybeFinishDay(state);
}

export function missSale(state,penalty=1){
  state.missedToday++;
  state.handledToday++;
  state.rep=Math.max(0,state.rep-penalty);
  return maybeFinishDay(state);
}

export function recordQueue(state,length){
  state.queueRecord=Math.max(state.queueRecord||0,Math.max(0,Math.floor(length)));
  return state.queueRecord;
}

export function dailyTarget(state){
  const base=DIFFICULTY[state.difficulty];
  return Math.min(16,base.customers+Math.floor((state.day-1)/3));
}

export function serveTarget(state){return Math.ceil(dailyTarget(state)*DIFFICULTY[state.difficulty].serveRatio)}

// Checkout customers wait in line indefinitely. Kept as an exported compatibility helper.
export function customerWait(){return Number.POSITIVE_INFINITY}

export function spawnDelay(state){
  const event=eventForDay(state.day);
  return Math.max(3.1,(6.4-Math.min(state.day-1,7)*.35)*(event.spawn||1));
}

export function checkoutDuration(state){return Math.max(.85,2.8-state.upgrades.checkout*.5)}
export function staffCheckoutDuration(state){return state.staff.cashier?Math.max(1.45,3.55-state.staff.cashier*.65):Infinity}
export function cashierHireCost(state){return state.staff.cashier===0?28000:state.staff.cashier===1?18000:0}
export function cashierWage(state){return [0,1100,1800][state.staff.cashier]||0}
export function restockerHireCost(state){return state.staff.restocker===0?22000:state.staff.restocker===1?15000:0}
export function restockerWage(state){return [0,900,1450][state.staff.restocker]||0}
export function totalStaffWage(state){return cashierWage(state)+restockerWage(state)}

export function hireCashier(state){
  if(state.staff.cashier>=2)return {ok:false,reason:"staffMaxed"};
  const cost=cashierHireCost(state);
  if(state.operatingBudget<cost)return {ok:false,reason:"notEnoughBudget",cost};
  state.operatingBudget-=cost;
  state.staff.cashier++;
  syncCash(state);
  return {ok:true,cost,level:state.staff.cashier,wage:cashierWage(state)};
}

export function hireRestocker(state){
  if(state.staff.restocker>=2)return {ok:false,reason:"staffMaxed"};
  const cost=restockerHireCost(state);
  if(state.operatingBudget<cost)return {ok:false,reason:"notEnoughBudget",cost};
  state.operatingBudget-=cost;
  state.staff.restocker++;
  syncCash(state);
  return {ok:true,cost,level:state.staff.restocker,wage:restockerWage(state)};
}

export function restockerTransfer(state,id){
  if(!state.staff.restocker)return {ok:false,reason:"staffMissing"};
  const available=Math.max(0,state.warehouse[id]||0);
  const room=Math.max(0,shelfCapacity(state)-(state.shelfStock[id]||0));
  const amount=Math.min(available,room,state.staff.restocker===1?2:4);
  if(!amount)return {ok:false,reason:available?"shelfFull":"warehouseEmpty"};
  state.warehouse[id]-=amount;
  state.shelfStock[id]+=amount;
  awardStoreXp(state,amount*2);
  return {ok:true,id,amount};
}

export function adjustCleanliness(state,delta){
  state.cleanliness=clamp(Number(state.cleanliness??100)+Number(delta||0),0,100);
  return state.cleanliness;
}

export function businessDailyIncome(state){
  return Object.entries(BUSINESSES).reduce((sum,[key,info])=>sum+(state.businesses?.[key]?info.income:0),0);
}

export function buyBusiness(state,key){
  const info=BUSINESSES[key];
  if(!info)return {ok:false,reason:"unknownBusiness"};
  state.businesses=state.businesses||{};
  if(state.businesses[key])return {ok:false,reason:"alreadyOwned"};
  if((state.storeLevel||1)<info.level)return {ok:false,reason:"levelLocked",level:info.level};
  if(state.operatingBudget<info.cost)return {ok:false,reason:"notEnoughBudget",cost:info.cost};
  state.operatingBudget-=info.cost;state.businesses[key]=true;syncCash(state);
  return {ok:true,key,cost:info.cost,income:info.income};
}

export function dailyExpense(state){
  return Math.round((850+state.day*110)*DIFFICULTY[state.difficulty].expense)+totalStaffWage(state);
}

export function maybeFinishDay(state){
  if(state.dayComplete||state.handledToday<dailyTarget(state))return null;
  const target=serveTarget(state);
  const success=state.servedToday>=target;
  const reward=success?2200+state.day*350:0;
  const expense=dailyExpense(state);
  const wage=totalStaffWage(state);
  const serviceIncome=businessDailyIncome(state);
  state.operatingBudget+=serviceIncome;
  if(success){state.operatingBudget+=reward;state.rep=Math.min(100,state.rep+3);awardStoreXp(state,70+state.day*5)}
  else state.rep=Math.max(0,state.rep-3);
  const short=state.operatingBudget<expense;
  state.operatingBudget=Math.max(0,state.operatingBudget-expense);
  syncCash(state);
  if(short)state.rep=Math.max(0,state.rep-2);
  state.dayComplete=true;
  state.lastDay={day:state.day,served:state.servedToday,missed:state.missedToday,revenue:state.revenueToday,target,reward,expense,wage,serviceIncome,success,short,salesFund:state.salesFund,operatingBudget:state.operatingBudget};
  return state.lastDay;
}

export function startNextDay(state){
  state.day++;
  state.servedToday=0;
  state.missedToday=0;
  state.revenueToday=0;
  state.handledToday=0;
  state.dayComplete=false;
  state.lastDay=null;
  state.rep=Math.min(100,state.rep+state.upgrades.decor);
  state.cleanliness=Math.min(100,(state.cleanliness??100)+6);
}

export function upgradeCost(state,key){
  const base={capacity:6500,checkout:8500,decor:5500}[key];
  return base+state.upgrades[key]*4200;
}

export function buyUpgrade(state,key){
  if(!(key in state.upgrades))return {ok:false,reason:"unknownUpgrade"};
  if(state.upgrades[key]>=3)return {ok:false,reason:"maxed"};
  const cost=upgradeCost(state,key);
  if(state.operatingBudget<cost)return {ok:false,reason:"notEnoughBudget",cost};
  state.operatingBudget-=cost;
  state.upgrades[key]++;
  syncCash(state);
  return {ok:true,cost,level:state.upgrades[key]};
}
