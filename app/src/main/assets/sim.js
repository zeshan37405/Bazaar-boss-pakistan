export const PRODUCTS=[
  {id:"flour",emoji:"🌾",color:0xd7b77a,cost:110,sell:155,n:{ur:"آٹا",hi:"आटा",en:"Flour"}},
  {id:"rice",emoji:"🍚",color:0xf4efe3,cost:145,sell:205,n:{ur:"چاول",hi:"चावल",en:"Rice"}},
  {id:"ghee",emoji:"🫙",color:0xf4c542,cost:240,sell:335,n:{ur:"گھی",hi:"घी",en:"Ghee"}},
  {id:"oil",emoji:"🧴",color:0xe7a831,cost:205,sell:290,n:{ur:"کوکنگ آئل",hi:"कुकिंग ऑयल",en:"Cooking oil"}},
  {id:"biscuit",emoji:"🍪",color:0xd4683a,cost:18,sell:36,n:{ur:"بسکٹ",hi:"बिस्कुट",en:"Biscuits"}},
  {id:"toffee",emoji:"🍬",color:0xe84b78,cost:4,sell:10,n:{ur:"ٹافی",hi:"टॉफ़ी",en:"Toffee"}}
];

export const EVENTS=[
  {id:"normal",emoji:"☀️"},
  {id:"wedding",emoji:"💍",products:["ghee","oil"],demand:1.18},
  {id:"ration",emoji:"🛒",products:["flour","rice"],demand:1.16},
  {id:"school",emoji:"🎒",products:["biscuit","toffee"],demand:1.22},
  {id:"inflation",emoji:"📈",market:1.20},
  {id:"rush",emoji:"⚡",spawn:.72,wait:.82}
];

export const DIFFICULTY={
  easy:{customers:5,serveRatio:.60,wait:58,expense:.78},
  normal:{customers:6,serveRatio:.75,wait:44,expense:1},
  hard:{customers:7,serveRatio:.86,wait:32,expense:1.28}
};

export const DEFAULT_STOCK={flour:4,rice:4,ghee:3,oil:3,biscuit:6,toffee:8};
export const copy=value=>JSON.parse(JSON.stringify(value));
export const productById=id=>PRODUCTS.find(item=>item.id===id)||PRODUCTS[0];
export const eventForDay=day=>EVENTS[(Math.max(1,day)-1)%EVENTS.length];

export function createState(saved,legacy){
  const source=saved&&saved.version>=3?saved:null;
  const old=legacy||{};
  const state={
    version:3,
    lang:source?.lang||old.lang||"ur",
    difficulty:source?.difficulty||old.difficulty||"normal",
    sound:source?.sound??old.sound??true,
    cash:Number(source?.cash??old.cash??2200),
    rep:Number(source?.rep??old.rep??20),
    day:Number(source?.day??old.day??1),
    totalSales:Number(source?.totalSales??old.sales??0),
    shelfStock:{},warehouse:{},
    upgrades:{capacity:0,checkout:0,decor:0},
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
    tutorialStep:Number(source?.tutorialStep??0)
  };
  for(const item of PRODUCTS){
    const oldAmount=old.stock&&Number.isFinite(old.stock[item.id])?old.stock[item.id]:DEFAULT_STOCK[item.id];
    state.shelfStock[item.id]=Math.max(0,Number(source?.shelfStock?.[item.id]??oldAmount));
    state.warehouse[item.id]=Math.max(0,Number(source?.warehouse?.[item.id]??0));
  }
  state.upgrades.capacity=Math.max(0,Math.min(3,Number(source?.upgrades?.capacity??old.upgrades?.shelf??0)));
  state.upgrades.checkout=Math.max(0,Math.min(3,Number(source?.upgrades?.checkout??0)));
  state.upgrades.decor=Math.max(0,Math.min(3,Number(source?.upgrades?.decor??old.upgrades?.lights??0)));
  if(!DIFFICULTY[state.difficulty])state.difficulty="normal";
  if(!["ur","hi","en"].includes(state.lang))state.lang="ur";
  return state;
}

export function shelfCapacity(state){return 8+state.upgrades.capacity*4}

export function marketPrice(state,id){
  const item=productById(id);
  const pattern=[-.14,.08,.17,-.06,.12,-.10,.04];
  const wave=pattern[(state.day*2+PRODUCTS.indexOf(item)*3)%pattern.length];
  const factor=(eventForDay(state.day).market||1)*(1+wave);
  return Math.max(2,Math.round(item.cost*factor));
}

export function marketTrend(state,id){
  const item=productById(id);
  const ratio=marketPrice(state,id)/item.cost;
  return ratio<.94?"cheap":ratio>1.08?"expensive":"normalPrice";
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
  if(event.products&&random()<.68){
    item=productById(event.products[Math.floor(random()*event.products.length)]);
  }else{
    item=PRODUCTS[Math.floor(random()*PRODUCTS.length)];
  }
  const maxQuantity=Math.min(3,1+Math.floor((state.day-1)/3));
  const quantity=1+Math.floor(random()*Math.max(1,maxQuantity));
  const demanded=event.products?.includes(item.id)?event.demand||1:1;
  const price=Math.round(item.sell*quantity*demanded*(1+Math.min(state.day-1,10)*.025));
  return {id:`order-${Date.now()}-${Math.floor(random()*1e6)}`,product:item.id,quantity,price};
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

export function dailyTarget(state){
  const base=DIFFICULTY[state.difficulty];
  return Math.min(10,base.customers+Math.floor((state.day-1)/3));
}

export function serveTarget(state){
  return Math.ceil(dailyTarget(state)*DIFFICULTY[state.difficulty].serveRatio);
}

export function customerWait(state){
  const event=eventForDay(state.day);
  return Math.round(DIFFICULTY[state.difficulty].wait*(event.wait||1));
}

export function spawnDelay(state){
  const event=eventForDay(state.day);
  return Math.max(4.5,(10-Math.min(state.day-1,4)*.6)*(event.spawn||1));
}

export function checkoutDuration(state){return Math.max(.75,2.2-state.upgrades.checkout*.4)}

export function dailyExpense(state){
  return Math.round((125+state.day*28)*DIFFICULTY[state.difficulty].expense);
}

export function maybeFinishDay(state){
  if(state.dayComplete||state.handledToday<dailyTarget(state))return null;
  const target=serveTarget(state);
  const success=state.servedToday>=target;
  const reward=success?300+state.day*70:0;
  const expense=dailyExpense(state);
  if(success){state.cash+=reward;state.rep=Math.min(100,state.rep+3)}
  else state.rep=Math.max(0,state.rep-3);
  const short=state.cash<expense;
  state.cash=Math.max(0,state.cash-expense);
  if(short)state.rep=Math.max(0,state.rep-2);
  state.dayComplete=true;
  state.lastDay={day:state.day,served:state.servedToday,missed:state.missedToday,revenue:state.revenueToday,target,reward,expense,success,short};
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
  const base={capacity:1200,checkout:1450,decor:1000}[key];
  return base+state.upgrades[key]*800;
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
