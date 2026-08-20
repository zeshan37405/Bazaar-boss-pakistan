export const PRICE_REFERENCE={
  asOf:"2026-07-30",
  label:"Pakistan Bureau of Statistics SPI + Pakistan retail benchmarks"
};

export const PRODUCTS=[
  {id:"flour",emoji:"🌾",color:0xd7b77a,cost:1225,sell:1320,shape:"bag",n:{ur:"آٹا",hi:"आटा",en:"Flour"},unit:{ur:"10 کلو تھیلا",hi:"10 किलो बैग",en:"10 kg bag"}},
  {id:"rice",emoji:"🍚",color:0xf4efe3,cost:198,sell:220,shape:"bag",n:{ur:"باسمتی چاول",hi:"बासमती चावल",en:"Basmati rice"},unit:{ur:"1 کلو پیک",hi:"1 किलो पैक",en:"1 kg pack"}},
  {id:"ghee",emoji:"🫙",color:0xf4c542,cost:575,sell:610,shape:"tin",n:{ur:"گھی",hi:"घी",en:"Ghee"},unit:{ur:"1 کلو پاؤچ",hi:"1 किलो पाउच",en:"1 kg pouch"}},
  {id:"oil",emoji:"🧴",color:0xe7a831,cost:580,sell:615,shape:"bottle",n:{ur:"کوکنگ آئل",hi:"कुकिंग ऑयल",en:"Cooking oil"},unit:{ur:"1 لیٹر بوتل",hi:"1 लीटर बोतल",en:"1 litre bottle"}},
  {id:"biscuit",emoji:"🍪",color:0xd4683a,cost:88,sell:110,shape:"packet",n:{ur:"بسکٹ",hi:"बिस्कुट",en:"Biscuits"},unit:{ur:"100 گرام پیک",hi:"100 ग्राम पैक",en:"100 g pack"}},
  {id:"toffee",emoji:"🍬",color:0xe84b78,cost:205,sell:240,shape:"pouch",n:{ur:"ٹافی",hi:"टॉफ़ी",en:"Toffee"},unit:{ur:"50 عدد پاؤچ",hi:"50 नग पाउच",en:"50-piece pouch"}}
];

export const EVENTS=[
  {id:"normal",emoji:"☀️"},
  {id:"wedding",emoji:"💍",products:["ghee","oil"],demand:1.18},
  {id:"ration",emoji:"🛒",products:["flour","rice"],demand:1.16},
  {id:"school",emoji:"🎒",products:["biscuit","toffee"],demand:1.22},
  {id:"inflation",emoji:"📈",market:1.09,retail:1.055},
  {id:"rush",emoji:"⚡",spawn:.68}
];

export const DIFFICULTY={
  easy:{customers:7,serveRatio:.72,expense:.78},
  normal:{customers:9,serveRatio:.78,expense:1},
  hard:{customers:11,serveRatio:.82,expense:1.24}
};

export const DEFAULT_STOCK={flour:8,rice:8,ghee:8,oil:8,biscuit:8,toffee:8};
export const copy=value=>JSON.parse(JSON.stringify(value));
export const productById=id=>PRODUCTS.find(item=>item.id===id)||PRODUCTS[0];
export const eventForDay=day=>EVENTS[(Math.max(1,day)-1)%EVENTS.length];
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const roundFive=value=>Math.max(5,Math.round(value/5)*5);

export function createState(saved,legacy){
  const source=saved&&saved.version>=3?saved:null;
  const old=legacy||{};
  const state={
    version:4,
    lang:source?.lang||old.lang||"ur",
    difficulty:source?.difficulty||old.difficulty||"normal",
    sound:source?.sound??old.sound??true,
    cash:Number(source?.cash??old.cash??12000),
    rep:Number(source?.rep??old.rep??35),
    day:Number(source?.day??old.day??1),
    totalSales:Number(source?.totalSales??old.sales??0),
    shelfStock:{},warehouse:{},
    upgrades:{capacity:0,checkout:0,decor:0},
    staff:{cashier:0},
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
    cameraDistance:clamp(Number(source?.cameraDistance??10.8),8.8,14)
  };
  for(const item of PRODUCTS){
    const legacyAmount=old.stock&&Number.isFinite(old.stock[item.id])?old.stock[item.id]:DEFAULT_STOCK[item.id];
    state.shelfStock[item.id]=Math.max(0,Number(source?.shelfStock?.[item.id]??legacyAmount));
    state.warehouse[item.id]=Math.max(0,Number(source?.warehouse?.[item.id]??0));
  }
  state.upgrades.capacity=clamp(Number(source?.upgrades?.capacity??old.upgrades?.shelf??0),0,3);
  state.upgrades.checkout=clamp(Number(source?.upgrades?.checkout??0),0,3);
  state.upgrades.decor=clamp(Number(source?.upgrades?.decor??old.upgrades?.lights??0),0,3);
  state.staff.cashier=clamp(Number(source?.staff?.cashier??0),0,2);
  if(!DIFFICULTY[state.difficulty])state.difficulty="normal";
  if(!["ur","hi","en"].includes(state.lang))state.lang="ur";
  return state;
}

export function shelfCapacity(state){return 8+state.upgrades.capacity*4}

export function marketPrice(state,id){
  const item=productById(id);
  const pattern=[-.045,.025,.06,-.02,.04,-.035,.012];
  const wave=pattern[(state.day*2+PRODUCTS.indexOf(item)*3)%pattern.length];
  const growth=1+Math.min(60,state.day-1)*.0025;
  return roundFive(item.cost*(eventForDay(state.day).market||1)*(1+wave)*growth);
}

export function retailPrice(state,id){
  const item=productById(id);
  const pattern=[.018,-.012,.027,-.02,.011,.032,-.007];
  const wave=pattern[(state.day+PRODUCTS.indexOf(item)*2)%pattern.length];
  const growth=1+Math.min(60,state.day-1)*.0025;
  const price=roundFive(item.sell*(eventForDay(state.day).retail||1)*(1+wave)*growth);
  return Math.max(price,roundFive(marketPrice(state,id)*1.055));
}

export function marketTrend(state,id){
  const item=productById(id);
  const ratio=marketPrice(state,id)/item.cost;
  return ratio<.975?"cheap":ratio>1.035?"expensive":"normalPrice";
}

export function buyWarehouse(state,id,quantity){
  const amount=Math.max(1,Math.floor(quantity));
  const cost=marketPrice(state,id)*amount;
  if(state.cash<cost)return {ok:false,reason:"notEnoughCash",cost};
  state.cash-=cost;
  state.warehouse[id]=(state.warehouse[id]||0)+amount;
  return {ok:true,cost,amount};
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
  return {ok:true,amount,empty:carrying.amount<=0};
}

export function createOrder(state,random=Math.random){
  const event=eventForDay(state.day);
  let item;
  if(event.products&&random()<.68)item=productById(event.products[Math.floor(random()*event.products.length)]);
  else item=PRODUCTS[Math.floor(random()*PRODUCTS.length)];
  const maxQuantity=Math.min(3,1+Math.floor((state.day-1)/4));
  const quantity=1+Math.floor(random()*Math.max(1,maxQuantity));
  const price=retailPrice(state,item.id)*quantity;
  return {id:`order-${Date.now()}-${Math.floor(random()*1e6)}`,product:item.id,quantity,unitPrice:retailPrice(state,item.id),price};
}

export function takeShelfItems(state,order){
  if((state.shelfStock[order.product]||0)<order.quantity)return false;
  state.shelfStock[order.product]-=order.quantity;
  return true;
}

export function completeSale(state,order){
  state.cash+=order.price;
  state.totalSales++;
  state.servedToday++;
  state.handledToday++;
  state.revenueToday+=order.price;
  state.rep=Math.min(100,state.rep+1+state.upgrades.decor);
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

export function hireCashier(state){
  if(state.staff.cashier>=2)return {ok:false,reason:"staffMaxed"};
  const cost=cashierHireCost(state);
  if(state.cash<cost)return {ok:false,reason:"notEnoughCash",cost};
  state.cash-=cost;
  state.staff.cashier++;
  return {ok:true,cost,level:state.staff.cashier,wage:cashierWage(state)};
}

export function dailyExpense(state){
  return Math.round((850+state.day*110)*DIFFICULTY[state.difficulty].expense)+cashierWage(state);
}

export function maybeFinishDay(state){
  if(state.dayComplete||state.handledToday<dailyTarget(state))return null;
  const target=serveTarget(state);
  const success=state.servedToday>=target;
  const reward=success?2200+state.day*350:0;
  const expense=dailyExpense(state);
  const wage=cashierWage(state);
  if(success){state.cash+=reward;state.rep=Math.min(100,state.rep+3)}
  else state.rep=Math.max(0,state.rep-3);
  const short=state.cash<expense;
  state.cash=Math.max(0,state.cash-expense);
  if(short)state.rep=Math.max(0,state.rep-2);
  state.dayComplete=true;
  state.lastDay={day:state.day,served:state.servedToday,missed:state.missedToday,revenue:state.revenueToday,target,reward,expense,wage,success,short};
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
}

export function upgradeCost(state,key){
  const base={capacity:6500,checkout:8500,decor:5500}[key];
  return base+state.upgrades[key]*4200;
}

export function buyUpgrade(state,key){
  if(!(key in state.upgrades))return {ok:false,reason:"unknownUpgrade"};
  if(state.upgrades[key]>=3)return {ok:false,reason:"maxed"};
  const cost=upgradeCost(state,key);
  if(state.cash<cost)return {ok:false,reason:"notEnoughCash",cost};
  state.cash-=cost;
  state.upgrades[key]++;
  return {ok:true,cost,level:state.upgrades[key]};
}
