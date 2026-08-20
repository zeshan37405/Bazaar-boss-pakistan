import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {
  PRODUCTS,createState,shelfCapacity,marketPrice,buyWarehouse,takeCrate,restockShelf,
  createOrder,takeShelfItems,completeSale,missSale,dailyTarget,serveTarget,
  customerWait,checkoutDuration,startNextDay,buyUpgrade,upgradeCost,eventForDay
} from "../app/src/main/assets/sim.js";

test("new and migrated games keep all six grocery products",()=>{
  const fresh=createState(null,null);
  assert.equal(fresh.cash,2200);
  assert.equal(shelfCapacity(fresh),8);
  assert.deepEqual(Object.keys(fresh.shelfStock),PRODUCTS.map(item=>item.id));
  const migrated=createState(null,{lang:"hi",cash:900,stock:{flour:7},upgrades:{shelf:2}});
  assert.equal(migrated.lang,"hi");
  assert.equal(migrated.cash,900);
  assert.equal(migrated.shelfStock.flour,7);
  assert.equal(migrated.upgrades.capacity,2);
  const resumed=createState({...fresh,carrying:{id:"rice",amount:2}},null);
  assert.deepEqual(resumed.carrying,{id:"rice",amount:2});
});

test("market purchase, crate pickup and shelf restock form one stock loop",()=>{
  const state=createState(null,null);
  state.shelfStock.flour=2;
  const before=state.cash;
  const bought=buyWarehouse(state,"flour",3);
  assert.equal(bought.ok,true);
  assert.equal(state.cash,before-marketPrice(state,"flour")*3);
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
  state.cash=0;
  assert.equal(buyWarehouse(state,"ghee",3).reason,"notEnoughCash");
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
  assert.ok(state.cash>2200);
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
  assert.ok(customerWait(hard)<customerWait(easy));
  const normalCheckout=checkoutDuration(easy);
  easy.cash=99999;
  const cost=upgradeCost(easy,"checkout");
  assert.deepEqual(buyUpgrade(easy,"checkout"),{ok:true,cost,level:1});
  assert.ok(checkoutDuration(easy)<normalCheckout);
  assert.equal(eventForDay(2).id,"wedding");
  assert.equal(eventForDay(6).id,"rush");
});

test("Urdu, Hindi and English dictionaries have matching keys",()=>{
  const context={window:{}};vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL("../app/src/main/assets/translations.js",import.meta.url),"utf8"),context);
  const text=context.window.BAZAAR_TEXT;
  const expected=Object.keys(text.ur).sort();
  assert.deepEqual(Object.keys(text.hi).sort(),expected);
  assert.deepEqual(Object.keys(text.en).sort(),expected);
});
