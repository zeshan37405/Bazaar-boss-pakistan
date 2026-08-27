import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {
  PRODUCTS,DEFAULT_WAREHOUSE,PRICE_REFERENCE,BUSINESSES,createState,shelfCapacity,marketPrice,recommendedRetailPrice,retailPrice,changeRetailMarkup,priceAcceptanceChance,buyWarehouse,bargainPurchase,cargoCount,
  dispatchTruck,advanceDelivery,deliveryFee,labourWage,startUnloading,advanceUnloading,syncCash,cameraRelativeVector,takeCrate,restockShelf,
  createOrder,takeShelfItems,completeSale,missSale,dailyTarget,serveTarget,
  customerWait,checkoutDuration,staffCheckoutDuration,startNextDay,buyUpgrade,upgradeCost,eventForDay,
  cashierHireCost,cashierWage,hireCashier,restockerHireCost,restockerWage,hireRestocker,restockerTransfer,buyBusiness,businessDailyIncome,adjustCleanliness,recordQueue
} from "../app/src/main/assets/sim.js";

test("new and migrated games keep all ten fully stocked grocery categories",()=>{
  const fresh=createState(null,null);
  assert.equal(fresh.cash,12000);
  assert.equal(fresh.version,10);
  assert.equal(fresh.salesFund,9000);
  assert.equal(fresh.operatingBudget,3000);
  assert.equal(fresh.cameraDistance,18);
  assert.equal(shelfCapacity(fresh),18);
  assert.equal(PRODUCTS.length,10);
  assert.deepEqual(Object.keys(fresh.shelfStock),PRODUCTS.map(item=>item.id));
  assert.ok(Object.values(fresh.shelfStock).every(amount=>amount===shelfCapacity(fresh)));
  assert.ok(PRODUCTS.every(item=>fresh.warehouse[item.id]===DEFAULT_WAREHOUSE[item.id]));
  assert.ok(PRODUCTS.every(item=>item.brands.length>=3));
  assert.ok(PRODUCTS.find(item=>item.id==="ghee").brands.some(brand=>brand.id==="latif"));
  const migrated=createState(null,{lang:"hi",cash:900,stock:{flour:7},upgrades:{shelf:2}});
  assert.equal(migrated.lang,"hi");
  assert.equal(migrated.cash,900);
  assert.equal(migrated.salesFund+migrated.operatingBudget,900);
  assert.equal(migrated.shelfStock.flour,7);
  assert.equal(migrated.upgrades.capacity,2);
  const upgradedV4=createState({version:4,cash:12000,cameraDistance:10.8,shelfStock:fresh.shelfStock,warehouse:fresh.warehouse},null);
  assert.equal(upgradedV4.cameraDistance,18);
  assert.ok(PRODUCTS.every(item=>upgradedV4.warehouse[item.id]>=DEFAULT_WAREHOUSE[item.id]));
  const resumed=createState({...fresh,carrying:{id:"rice",amount:2}},null);
  assert.deepEqual(resumed.carrying,{id:"rice",amount:2});
});

test("market purchase, truck delivery, crate pickup and shelf restock form one stock loop",()=>{
  const state=createState(null,null);
  state.shelfStock.flour=2;
  state.warehouse.flour=0;
  const before=state.salesFund;
  const bought=buyWarehouse(state,"flour",3);
  assert.equal(bought.ok,true);
  assert.equal(state.salesFund,before-marketPrice(state,"flour")*3);
  assert.equal(state.truckCargo.flour,3);
  assert.equal(state.warehouse.flour,0);
  const fee=deliveryFee(state);
  assert.deepEqual(dispatchTruck(state),{ok:true,fee,count:3,duration:10});
  assert.equal(cargoCount(state.truckCargo),0);
  assert.equal(advanceDelivery(state,4).arrived,false);
  assert.equal(advanceDelivery(state,6).arrived,true);
  assert.equal(state.delivery.arrived,true);
  assert.equal(state.warehouse.flour,0);
  const budgetBeforeLabour=state.operatingBudget;
  assert.deepEqual(startUnloading(state,2),{ok:true,cost:labourWage(2),labourers:2,duration:5,count:3});
  assert.equal(state.operatingBudget,budgetBeforeLabour-labourWage(2));
  assert.equal(advanceUnloading(state,2).complete,false);
  assert.equal(advanceUnloading(state,3).complete,true);
  assert.equal(state.warehouse.flour,3);
  const crate=takeCrate(state,"flour");
  assert.deepEqual(crate,{ok:true,id:"flour",amount:3});
  const carrying={id:crate.id,amount:crate.amount};
  const stocked=restockShelf(state,carrying);
  assert.equal(stocked.ok,true);
  assert.equal(state.shelfStock.flour,5);
  assert.equal(carrying.amount,0);
});

test("stock cannot be bought without enough cash or exceed shelf capacity",()=>{
  const state=createState(null,null);
  state.salesFund=0;syncCash(state);
  assert.equal(buyWarehouse(state,"ghee",3).reason,"notEnoughSalesFund");
  state.shelfStock.ghee=shelfCapacity(state);
  assert.equal(restockShelf(state,{id:"ghee",amount:3}).reason,"shelfFull");
});

test("customers remove shelf goods and successful checkouts close the day",()=>{
  const state=createState(null,null);
  state.shelfStock.flour=30;
  const order=createOrder(state,()=>0);
  assert.equal(order.product,"flour");
  assert.equal(takeShelfItems(state,order),true);
  let result=null;
  for(let index=0;index<dailyTarget(state);index++)result=completeSale(state,{price:100});
  assert.equal(state.dayComplete,true);
  assert.equal(result.success,true);
  assert.equal(result.served,dailyTarget(state));
  assert.ok(state.salesFund>9000);
});

test("missed customers can fail a day and next day resets counters",()=>{
  const state=createState(null,null);
  let result=null;
  for(let index=0;index<dailyTarget(state);index++)result=missSale(state);
  assert.equal(result.success,false);
  const oldDay=state.day;
  startNextDay(state);
  assert.equal(state.day,oldDay+1);
  assert.equal(state.handledToday,0);
  assert.equal(state.dayComplete,false);
});

test("difficulty, events and upgrades change real gameplay values",()=>{
  const easy=createState(null,null);easy.difficulty="easy";
  const hard=createState(null,null);hard.difficulty="hard";
  assert.ok(dailyTarget(hard)>dailyTarget(easy));
  assert.ok(serveTarget(hard)>serveTarget(easy));
  assert.equal(customerWait(hard),Infinity);
  assert.equal(customerWait(easy),Infinity);
  const normalCheckout=checkoutDuration(easy);
  easy.operatingBudget=99999;syncCash(easy);
  const cost=upgradeCost(easy,"checkout");
  assert.deepEqual(buyUpgrade(easy,"checkout"),{ok:true,cost,level:1});
  assert.ok(checkoutDuration(easy)<normalCheckout);
  assert.equal(eventForDay(2).id,"wedding");
  assert.equal(eventForDay(6).id,"rush");
});

test("Pakistan benchmark pack prices vary each day while preserving a retail margin",()=>{
  const state=createState(null,null);
  assert.equal(PRICE_REFERENCE.asOf,"2026-08-20");
  assert.ok(product("flour").sell>=1200&&product("flour").sell<=1400);
  assert.ok(product("rice").sell>=200&&product("rice").sell<=240);
  const dayOne=PRODUCTS.map(item=>retailPrice(state,item.id));
  for(const item of PRODUCTS)assert.ok(retailPrice(state,item.id)>marketPrice(state,item.id));
  state.day=2;
  const dayTwo=PRODUCTS.map(item=>retailPrice(state,item.id));
  assert.ok(dayOne.some((price,index)=>price!==dayTwo[index]));
  function product(id){return PRODUCTS.find(item=>item.id===id)}
});

test("owner pricing changes customer acceptance without breaking the Pakistan benchmark floor",()=>{
  const state=createState(null,null),recommended=recommendedRetailPrice(state,"rice");
  assert.equal(priceAcceptanceChance(state,"rice"),1);
  changeRetailMarkup(state,"rice",.3);
  assert.ok(retailPrice(state,"rice")>recommended);
  assert.ok(priceAcceptanceChance(state,"rice")<1);
  changeRetailMarkup(state,"rice",-1);
  assert.ok(retailPrice(state,"rice")>marketPrice(state,"rice"));
});

test("restocker, cleanliness and side businesses form a management progression",()=>{
  const state=createState(null,null);state.operatingBudget=100000;syncCash(state);
  const cost=restockerHireCost(state);
  assert.deepEqual(hireRestocker(state),{ok:true,cost,level:1,wage:500});
  assert.equal(restockerWage(state),500);
  state.shelfStock.rice=5;state.warehouse.rice=4;
  assert.deepEqual(restockerTransfer(state,"rice"),{ok:true,id:"rice",amount:2});
  assert.equal(state.shelfStock.rice,7);
  assert.equal(adjustCleanliness(state,-30),70);
  assert.equal(buyBusiness(state,"vending").reason,"levelLocked");
  state.storeLevel=2;
  assert.equal(buyBusiness(state,"vending").ok,true);
  assert.equal(businessDailyIncome(state),BUSINESSES.vending.income);
});

test("a hired cashier serves automatically, earns a daily wage and tracks queue records",()=>{
  const state=createState(null,null);state.operatingBudget=100000;syncCash(state);
  const cost=cashierHireCost(state);
  assert.deepEqual(hireCashier(state),{ok:true,cost,level:1,wage:800});
  assert.equal(state.operatingBudget,100000-cost);
  assert.equal(cashierWage(state),800);
  assert.ok(Number.isFinite(staffCheckoutDuration(state)));
  assert.equal(recordQueue(state,5),5);
  assert.equal(recordQueue(state,2),5);
  assert.equal(hireCashier(state).level,2);
  assert.equal(hireCashier(state).reason,"staffMaxed");
});

test("bargaining can be accepted or rejected and never spends the business budget",()=>{
  const state=createState(null,null),budget=state.operatingBudget;
  const rejected=bargainPurchase(state,"rice",3,"bold",()=>1);
  assert.equal(rejected.reason,"bargainRejected");
  assert.equal(cargoCount(state.truckCargo),0);
  const accepted=bargainPurchase(state,"rice",3,"bold",()=>0);
  assert.equal(accepted.ok,true);
  assert.ok(accepted.discount>0);
  assert.equal(state.truckCargo.rice,3);
  assert.equal(state.operatingBudget,budget);
});

test("sales refill only the sales fund while staff and upgrades use only the business budget",()=>{
  const state=createState(null,null);
  const salesBefore=state.salesFund,budgetBefore=state.operatingBudget;
  completeSale(state,{price:500});
  assert.equal(state.salesFund,salesBefore+500);
  assert.equal(state.operatingBudget,budgetBefore);
  state.operatingBudget=50000;syncCash(state);
  const salesAfter=state.salesFund;
  assert.equal(buyUpgrade(state,"decor").ok,true);
  assert.equal(state.salesFund,salesAfter);
});

test("joystick directions remain screen-relative at every camera angle",()=>{
  assert.deepEqual(cameraRelativeVector(0,0,1),{x:0,z:-1});
  const rightAtFront=cameraRelativeVector(0,1,0);
  assert.equal(rightAtFront.x,1);assert.ok(Math.abs(rightAtFront.z)<1e-9);
  const forwardAtRight=cameraRelativeVector(Math.PI/2,0,1);
  const rightAtRight=cameraRelativeVector(Math.PI/2,1,0);
  assert.ok(forwardAtRight.x<-.999&&Math.abs(forwardAtRight.z)<1e-9);
  assert.ok(rightAtRight.z<-.999&&Math.abs(rightAtRight.x)<1e-9);
});

test("Urdu, Hindi and English dictionaries have matching keys",()=>{
  const context={window:{}};vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL("../app/src/main/assets/translations.js",import.meta.url),"utf8"),context);
  const text=context.window.BAZAAR_TEXT;
  const expected=Object.keys(text.ur).sort();
  assert.deepEqual(Object.keys(text.hi).sort(),expected);
  assert.deepEqual(Object.keys(text.en).sort(),expected);
});
