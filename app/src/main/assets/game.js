"use strict";

(()=>{
  const TEXT=window.BAZAAR_TEXT;
  const PRODUCTS=[
    {id:"flour",emoji:"🌾",cost:110,sell:150,n:{ur:"آٹا پیکٹ",hi:"आटा पैकेट",en:"Flour pack"}},
    {id:"rice",emoji:"🍚",cost:145,sell:195,n:{ur:"چاول",hi:"चावल",en:"Rice"}},
    {id:"ghee",emoji:"🫙",cost:240,sell:320,n:{ur:"گھی",hi:"घी",en:"Ghee"}},
    {id:"oil",emoji:"🧴",cost:205,sell:275,n:{ur:"کوکنگ آئل",hi:"कुकिंग ऑयल",en:"Cooking oil"}},
    {id:"biscuit",emoji:"🍪",cost:18,sell:32,n:{ur:"بسکٹ",hi:"बिस्कुट",en:"Biscuits"}},
    {id:"toffee",emoji:"🍬",cost:4,sell:9,n:{ur:"ٹافی پیکٹ",hi:"टॉफ़ी पैकेट",en:"Toffee pack"}}
  ];

  const PEOPLE=[
    {id:"ali",emoji:"👦",n:{ur:"علی",hi:"अली",en:"Ali"},l:{ur:"بھائی جان، مناسب قیمت لگانا!",hi:"भाई जान, सही कीमत लगाना!",en:"Please give me a fair price!"}},
    {id:"fatima",emoji:"👩",n:{ur:"فاطمہ",hi:"फ़ातिमा",en:"Fatima"},l:{ur:"جلدی کریں، گھر بھی جانا ہے۔",hi:"जल्दी करें, घर भी जाना है।",en:"Please hurry, I need to get home."}},
    {id:"chaudhry",emoji:"👨‍🦳",n:{ur:"چوہدری صاحب",hi:"चौधरी साहब",en:"Mr Chaudhry"},l:{ur:"پرانا گاہک ہوں، رعایت تو بنتی ہے۔",hi:"पुराना ग्राहक हूँ, छूट तो बनती है।",en:"I am a regular; surely I get a discount."}},
    {id:"student",emoji:"🧑‍🎓",n:{ur:"طالب علم",hi:"विद्यार्थी",en:"Student"},l:{ur:"میرے پاس بس اتنے ہی پیسے ہیں۔",hi:"मेरे पास बस इतने ही पैसे हैं।",en:"This is all the money I have."}},
    {id:"aunt",emoji:"👵",n:{ur:"خالہ جان",hi:"खाला जान",en:"Auntie"},l:{ur:"اچھی چیز دینا بیٹا۔",hi:"अच्छा सामान देना बेटा।",en:"Give me the good quality one, dear."}},
    {id:"rider",emoji:"🛵",n:{ur:"ڈلیوری رائیڈر",hi:"डिलीवरी राइडर",en:"Delivery rider"},l:{ur:"فٹا فٹ دیں، آرڈر لیٹ ہو رہا ہے!",hi:"जल्दी दें, ऑर्डर लेट हो रहा है!",en:"Quick please, the order is getting late!"}}
  ];

  const EVENTS=[
    {id:"normal",emoji:"🌇",n:{ur:"عام کاروباری دن",hi:"सामान्य बाज़ार",en:"Normal market day"},d:{ur:"آج قیمتیں معمول کے مطابق ہیں۔",hi:"आज कीमतें सामान्य हैं।",en:"Prices are normal today."}},
    {id:"wedding",emoji:"💍",products:["ghee"],bonus:.15,n:{ur:"شادیوں کا موسم",hi:"शादियों का मौसम",en:"Wedding season"},d:{ur:"گھی کی مانگ 15٪ زیادہ ہے۔",hi:"घी की माँग 15% अधिक है।",en:"Ghee demand is 15% higher."}},
    {id:"ration",emoji:"🛒",products:["flour","rice"],bonus:.12,n:{ur:"راشن کا رش",hi:"राशन की भीड़",en:"Ration rush"},d:{ur:"آٹا اور چاول تیزی سے بک رہے ہیں۔",hi:"आटा और चावल तेजी से बिक रहे हैं।",en:"Flour and rice are selling fast."}},
    {id:"school",emoji:"🎒",products:["biscuit","toffee"],bonus:.18,n:{ur:"سکول کی چھٹی",hi:"स्कूल की छुट्टी",en:"School break"},d:{ur:"بسکٹ اور ٹافی کی مانگ بڑھی ہے۔",hi:"बिस्कुट और टॉफ़ी की माँग बढ़ी है।",en:"Biscuits and toffees are in demand."}},
    {id:"inflation",emoji:"📈",marketFactor:1.22,n:{ur:"مہنگائی کا دن",hi:"महँगाई का दिन",en:"Inflation day"},d:{ur:"منڈی کی قیمتیں 22٪ بڑھ گئی ہیں۔",hi:"मंडी की कीमतें 22% बढ़ी हैं।",en:"Wholesale prices are up 22%."}},
    {id:"power",emoji:"🔦",patienceFactor:.72,n:{ur:"بجلی کی بندش",hi:"बिजली बंद",en:"Power outage"},d:{ur:"گاہک آج کم وقت انتظار کریں گے۔",hi:"ग्राहक आज कम इंतज़ार करेंगे।",en:"Customers will wait less today."}},
    {id:"bulk",emoji:"📦",bulk:1,n:{ur:"بڑی خریداری",hi:"थोक खरीदारी",en:"Bulk shopping"},d:{ur:"گاہک زیادہ مقدار خرید سکتے ہیں۔",hi:"ग्राहक अधिक मात्रा खरीद सकते हैं।",en:"Customers may buy larger quantities."}}
  ];

  const UPGRADES={
    shelf:{emoji:"🗄️",cost:900,n:{ur:"بڑی الماری",hi:"बड़ी अलमारी",en:"Large shelves"},b:{ur:"ہر چیز کی گنجائش +4",hi:"हर चीज़ की जगह +4",en:"+4 capacity per item"}},
    sign:{emoji:"✨",cost:1100,n:{ur:"روشن سائن بورڈ",hi:"चमकता साइन बोर्ड",en:"Bright sign"},b:{ur:"بھاؤ تاؤ کی کامیابی بڑھے",hi:"मोलभाव की सफलता बढ़े",en:"Better negotiation odds"}},
    lights:{emoji:"💡",cost:750,n:{ur:"بہتر روشنیاں",hi:"बेहतर रोशनी",en:"Better lighting"},b:{ur:"ہر نئے دن اضافی ساکھ",hi:"हर नए दिन अतिरिक्त साख",en:"Bonus reputation each day"}}
  };

  const DIFFICULTY={
    easy:{target:.84,patience:7,bargain:.10,bill:.80},
    normal:{target:1,patience:0,bargain:0,bill:1},
    hard:{target:1.16,patience:-5,bargain:-.09,bill:1.25}
  };

  const FRESH={
    version:2,lang:"ur",difficulty:"normal",cash:1800,rep:15,day:1,visits:0,sales:0,
    stock:{flour:4,rice:4,ghee:3,oil:3,biscuit:6,toffee:8},
    upgrades:{shelf:0,sign:0,lights:0},claimed:[],sound:true,introSeen:false,
    messageKey:"welcomeMessage",messageData:{},customer:null,
    dayRevenue:0,dayProfit:0,dayHappy:0,dailyMisses:0,stockouts:0,
    dayComplete:false,lastDay:null
  };

  const KEY="bazaarBossPakistanV1";
  const DAILY_CUSTOMERS=8;
  const copy=value=>JSON.parse(JSON.stringify(value));
  const $=id=>document.getElementById(id);
  let state=loadState();
  let activeDrawer="shop";

  function t(key,data={}){
    const language=TEXT[state.lang]||TEXT.ur;
    const value=language[key]||TEXT.ur[key]||key;
    return String(value).replace(/\{(\w+)\}/g,(_,name)=>data[name]??"");
  }

  function localNumber(value){
    const locale=state.lang==="en"?"en-PK":state.lang==="hi"?"hi-IN":"ur-PK";
    return Number(value||0).toLocaleString(locale);
  }

  function money(value){return "₨ "+Math.round(value||0).toLocaleString("en-PK")}
  function product(id){return PRODUCTS.find(item=>item.id===id)||PRODUCTS[0]}
  function productName(item){return item.n[state.lang]||item.n.ur}
  function person(id){return PEOPLE.find(item=>item.id===id)||PEOPLE[0]}
  function currentEvent(){return EVENTS[(state.day-1)%EVENTS.length]}
  function difficulty(){return DIFFICULTY[state.difficulty]||DIFFICULTY.normal}

  function loadState(){
    try{
      const old=JSON.parse(localStorage.getItem(KEY));
      if(!old)return copy(FRESH);
      const next=Object.assign(copy(FRESH),old);
      next.version=2;
      next.lang=["ur","hi","en"].includes(old.lang)?old.lang:"ur";
      next.difficulty=DIFFICULTY[old.difficulty]?old.difficulty:"normal";
      next.stock=copy(FRESH.stock);
      PRODUCTS.forEach(item=>{
        if(old.stock&&Number.isFinite(old.stock[item.id]))next.stock[item.id]=old.stock[item.id];
      });
      if(old.stock){
        if(old.stock.flour==null&&Number.isFinite(old.stock.chai))next.stock.flour=old.stock.chai;
        if(old.stock.rice==null&&Number.isFinite(old.stock.soda))next.stock.rice=old.stock.soda;
        if(old.stock.ghee==null&&Number.isFinite(old.stock.chips))next.stock.ghee=old.stock.chips;
      }
      next.upgrades=Object.assign(copy(FRESH.upgrades),old.upgrades||{});
      next.claimed=Array.isArray(old.claimed)?old.claimed:[];
      next.messageKey=old.messageKey||"welcomeMessage";
      next.messageData=old.messageData||{};
      return next;
    }catch(error){return copy(FRESH)}
  }

  function save(){localStorage.setItem(KEY,JSON.stringify(state))}

  function marketPrice(item){
    const pattern=[-.14,.08,.17,-.06,.12,-.10,.04];
    const index=PRODUCTS.indexOf(item);
    const wave=pattern[(state.day*2+index*3)%pattern.length];
    const factor=(currentEvent().marketFactor||1)*(1+wave);
    return Math.max(2,Math.round(item.cost*factor));
  }

  function marketTrend(item){
    const ratio=marketPrice(item)/item.cost;
    if(ratio<.94)return {key:"cheap",color:"var(--green)"};
    if(ratio>1.08)return {key:"expensive",color:"var(--red)"};
    return {key:"normalPrice",color:"var(--muted)"};
  }

  function demandBonus(item){
    const event=currentEvent();
    return event.products&&event.products.includes(item.id)?event.bonus||0:0;
  }

  function makeCustomer(){
    const event=currentEvent();
    const selectedPerson=PEOPLE[Math.floor(Math.random()*PEOPLE.length)];
    const featured=event.products&&Math.random()<.62
      ? event.products[Math.floor(Math.random()*event.products.length)]
      : null;
    const item=featured?product(featured):PRODUCTS[Math.floor(Math.random()*PRODUCTS.length)];
    const maxQuantity=Math.min(4,2+Math.floor((state.day-1)/3)+(event.bulk||0));
    const quantity=1+Math.floor(Math.random()*Math.max(1,maxQuantity));
    const retail=Math.round(item.sell*(1+Math.min(state.day-1,12)*.025)*(1+demandBonus(item)));
    const fair=retail*quantity;
    const offer=Math.max(marketPrice(item)*quantity+2,Math.round(fair*(.88+Math.random()*.12)));
    const maxPrice=Math.round(fair*(1.06+Math.random()*.15));
    const baseSeconds=27+difficulty().patience-Math.min(state.day-1,8);
    const seconds=Math.max(11,Math.round(baseSeconds*(event.patienceFactor||1)+Math.random()*5));
    return {person:selectedPerson.id,product:item.id,quantity,offer,maxPrice,time:seconds,maxTime:seconds};
  }

  function validCustomer(customer){
    return customer&&customer.person&&PRODUCTS.some(item=>item.id===customer.product)&&customer.quantity&&customer.maxTime;
  }

  if(!validCustomer(state.customer)){
    state.customer=makeCustomer();
    save();
  }

  function currentMessage(){return t(state.messageKey||"welcomeMessage",state.messageData||{})}

  function tone(kind){
    if(!state.sound)return;
    try{
      const Audio=window.AudioContext||window.webkitAudioContext;
      const context=new Audio();
      const oscillator=context.createOscillator();
      const gain=context.createGain();
      oscillator.type=kind==="miss"?"sawtooth":"sine";
      oscillator.frequency.value=kind==="coin"?620:kind==="up"?760:180;
      gain.gain.setValueAtTime(.04,context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+.12);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime+.13);
    }catch(error){}
    if(navigator.vibrate)navigator.vibrate(24);
  }

  function toast(text){
    const element=$("toast");
    element.textContent=text;
    element.classList.remove("hidden");
    clearTimeout(toast.timer);
    toast.timer=setTimeout(()=>element.classList.add("hidden"),1200);
  }

  function floatingText(text){
    const element=$("float");
    element.textContent=text;
    element.classList.remove("hidden");
    clearTimeout(floatingText.timer);
    floatingText.timer=setTimeout(()=>element.classList.add("hidden"),900);
  }

  function dailyChallenge(){
    const scale=difficulty().target;
    const type=(state.day-1)%4;
    const reward=180+state.day*25;
    if(type===0){
      const target=Math.round((170+state.day*20)*scale);
      return {id:"profit",emoji:"💰",title:t("profitMission"),detail:t("profitMissionDetail",{target}),value:state.dayProfit,target,reward,passed:state.dayProfit>=target};
    }
    if(type===1){
      const target=Math.round((900+state.day*85)*scale);
      return {id:"revenue",emoji:"📊",title:t("revenueMission"),detail:t("revenueMissionDetail",{target}),value:state.dayRevenue,target,reward,passed:state.dayRevenue>=target};
    }
    if(type===2){
      const target=Math.max(4,Math.round(6*scale));
      return {id:"happy",emoji:"😊",title:t("happyMission"),detail:t("happyMissionDetail",{target}),value:state.dayHappy,target,reward,passed:state.dayHappy>=target};
    }
    const target=state.difficulty==="easy"?2:state.difficulty==="hard"?0:1;
    return {id:"careful",emoji:"🛡️",title:t("carefulMission"),detail:t("carefulMissionDetail",{target}),value:state.dailyMisses,target,reward,passed:state.dailyMisses<=target,inverse:true};
  }

  function challengePercent(challenge){
    if(challenge.inverse){
      const room=challenge.target+1;
      return Math.max(0,Math.min(100,(room-state.dailyMisses)/room*100));
    }
    return Math.min(100,challenge.value/challenge.target*100);
  }

  function challengeCount(challenge){
    if(challenge.inverse)return t("missed",{value:localNumber(challenge.value),target:localNumber(challenge.target)});
    return localNumber(Math.min(challenge.value,challenge.target))+" / "+localNumber(challenge.target);
  }

  function operatingCost(){return Math.round((95+state.day*14)*difficulty().bill)}

  function advance(messageKey,messageData={}){
    state.visits++;
    state.messageKey=messageKey;
    state.messageData=messageData;
    if(state.visits>=DAILY_CUSTOMERS){
      finishDay();
      return;
    }
    state.customer=makeCustomer();
    save();
    render();
  }

  function sell(price,messageKey,messageData={}){
    const customer=state.customer;
    const item=product(customer.product);
    const quantity=customer.quantity;
    if(state.stock[item.id]<quantity){
      state.dailyMisses++;
      state.stockouts++;
      state.rep=Math.max(0,state.rep-2);
      tone("miss");
      floatingText(t("stockEmpty"));
      advance("outOfStock");
      return;
    }
    const cost=marketPrice(item)*quantity;
    const profit=Math.max(0,price-cost);
    state.cash+=price;
    state.sales++;
    state.dayRevenue+=price;
    state.dayProfit+=profit;
    state.dayHappy++;
    state.rep=Math.min(100,state.rep+(profit>cost*.35?2:1));
    state.stock[item.id]-=quantity;
    tone("coin");
    floatingText("+ "+money(price));
    advance(messageKey,Object.assign({profit},messageData));
  }

  function acceptOffer(){
    if(state.dayComplete)return toast(t("paused"));
    const customer=state.customer;
    const who=person(customer.person);
    const profit=Math.max(0,customer.offer-marketPrice(product(customer.product))*customer.quantity);
    sell(customer.offer,"saleMessage",{name:who.n[state.lang],profit});
  }

  function negotiationChance(extra){
    const customer=state.customer;
    const ask=Math.ceil(customer.offer*(1+extra));
    const pressure=Math.max(0,(ask-customer.maxPrice)/Math.max(1,customer.maxPrice));
    const base=extra<=.05?.86:extra<=.12?.64:.40;
    const chance=base-pressure*1.7+state.rep/420+state.upgrades.sign*.055+difficulty().bargain;
    return Math.max(.12,Math.min(.94,chance));
  }

  function negotiate(extra){
    if(state.dayComplete)return;
    const customer=state.customer;
    const who=person(customer.person);
    const ask=Math.ceil(customer.offer*(1+extra));
    const chance=negotiationChance(extra);
    closeDrawer();
    if(Math.random()<chance){
      sell(ask,"dealSuccess",{name:who.n[state.lang],price:ask});
    }else{
      state.rep=Math.max(0,state.rep-1);
      state.dailyMisses++;
      tone("miss");
      floatingText(t("customerLeft"));
      advance("dealFailed",{name:who.n[state.lang]});
    }
  }

  function refuseCustomer(){
    if(state.dayComplete)return toast(t("paused"));
    const who=person(state.customer.person);
    state.dailyMisses++;
    state.rep=Math.max(0,state.rep-1);
    tone("miss");
    floatingText(t("customerLeft"));
    advance("rejectMessage",{name:who.n[state.lang]});
  }

  function customerTimedOut(){
    if(state.dayComplete)return;
    const who=person(state.customer.person);
    state.dailyMisses++;
    state.rep=Math.max(0,state.rep-2);
    tone("miss");
    floatingText(t("timeUp"));
    closeDrawer();
    advance("timeoutMessage",{name:who.n[state.lang]});
  }

  function finishDay(){
    const challenge=dailyChallenge();
    const bill=operatingCost();
    const reward=challenge.passed?challenge.reward:0;
    if(challenge.passed){
      state.cash+=reward;
      state.rep=Math.min(100,state.rep+3);
    }else{
      state.rep=Math.max(0,state.rep-2);
    }
    const cashBeforeBill=state.cash;
    state.cash=Math.max(0,state.cash-bill);
    const short=cashBeforeBill<bill;
    if(short)state.rep=Math.max(0,state.rep-3);
    state.dayComplete=true;
    state.lastDay={day:state.day,profit:state.dayProfit,happy:state.dayHappy,bill,passed:challenge.passed,reward,short};
    save();
    render();
    $("dayModal").classList.remove("hidden");
  }

  function startNextDay(){
    state.day++;
    state.visits=0;
    state.dayRevenue=0;
    state.dayProfit=0;
    state.dayHappy=0;
    state.dailyMisses=0;
    state.stockouts=0;
    state.dayComplete=false;
    state.lastDay=null;
    state.rep=Math.min(100,state.rep+state.upgrades.lights);
    state.customer=makeCustomer();
    state.messageKey="newDayMessage";
    state.messageData={};
    save();
    $("dayModal").classList.add("hidden");
    render();
  }

  function buyStock(id,requested){
    const item=product(id);
    const capacity=8+state.upgrades.shelf*4;
    const amount=Math.min(requested,capacity-state.stock[id]);
    const price=marketPrice(item)*amount;
    if(amount<=0)return toast(t("capacityFull"));
    if(state.cash<price){tone("miss");return toast(t("notEnoughCash"))}
    state.cash-=price;
    state.stock[id]+=amount;
    tone("coin");
    toast(t("stockBought",{amount:localNumber(amount),price}));
    save();
    render();
    openDrawer("market");
  }

  function buyUpgrade(key){
    const level=state.upgrades[key];
    const price=UPGRADES[key].cost+level*550;
    if(level>=3)return toast(t("maxed"));
    if(state.cash<price){tone("miss");return toast(t("notEnoughCash"))}
    state.cash-=price;
    state.upgrades[key]++;
    tone("up");
    toast(t("upgradeDone"));
    save();
    render();
    openDrawer("upgrades");
  }

  function achievements(){
    return [
      {id:"sales20",title:t("goalSalesTitle"),detail:t("goalSalesDetail"),value:state.sales,target:20,reward:500,emoji:"🛍️"},
      {id:"rep50",title:t("goalRepTitle"),detail:t("goalRepDetail"),value:state.rep,target:50,reward:650,emoji:"⭐"},
      {id:"cash5000",title:t("goalCashTitle"),detail:t("goalCashDetail"),value:state.cash,target:5000,reward:900,emoji:"💰"},
      {id:"days7",title:t("goalDaysTitle"),detail:t("goalDaysDetail"),value:Math.max(0,state.day-1),target:7,reward:1200,emoji:"📅"}
    ];
  }

  function claimReward(id){
    const goal=achievements().find(item=>item.id===id);
    if(!goal||goal.value<goal.target||state.claimed.includes(id))return;
    state.claimed.push(id);
    state.cash+=goal.reward;
    tone("up");
    toast(t("rewardReceived",{reward:goal.reward}));
    save();
    render();
    openDrawer("challenges");
  }

  function resetGame(){
    if(!confirm(t("resetConfirm")))return;
    const preferences={lang:state.lang,difficulty:state.difficulty,sound:state.sound};
    localStorage.removeItem(KEY);
    state=copy(FRESH);
    Object.assign(state,preferences);
    state.customer=makeCustomer();
    closeDrawer();
    save();
    render();
    $("intro").classList.remove("hidden");
  }

  function setLanguage(language){
    if(!TEXT[language])return;
    state.lang=language;
    save();
    render();
    if(!$("drawer").classList.contains("hidden"))openDrawer("settings");
    toast(t("languageChanged"));
  }

  function setDifficulty(level){
    if(!DIFFICULTY[level])return;
    const previous=state.difficulty;
    const delta=DIFFICULTY[level].patience-DIFFICULTY[previous].patience;
    state.difficulty=level;
    state.customer.maxTime=Math.max(10,state.customer.maxTime+delta);
    state.customer.time=Math.max(1,Math.min(state.customer.maxTime,state.customer.time+delta));
    save();
    render();
    openDrawer("settings");
    toast(t("difficultyChanged"));
  }

  function applyTranslations(){
    document.documentElement.lang=state.lang;
    document.documentElement.dir=state.lang==="ur"?"rtl":"ltr";
    document.querySelectorAll("[data-t]").forEach(element=>{element.textContent=t(element.dataset.t)});
    document.querySelectorAll("[data-ta]").forEach(element=>{element.setAttribute("aria-label",t(element.dataset.ta))});
    document.querySelectorAll("[data-intro-lang]").forEach(button=>button.classList.toggle("active",button.dataset.introLang===state.lang));
    $("langBtn").textContent=state.lang==="ur"?"اردو":state.lang==="hi"?"हिन्दी":"EN";
  }

  function renderTimer(){
    const customer=state.customer;
    const percent=Math.max(0,customer.time/customer.maxTime*100);
    $("timerText").textContent=t("seconds",{n:localNumber(customer.time)});
    $("patienceFill").style.width=percent+"%";
    $("patienceFill").classList.toggle("warn",percent<=35);
  }

  function render(){
    applyTranslations();
    const customer=state.customer;
    const item=product(customer.product);
    const who=person(customer.person);
    const event=currentEvent();
    const capacity=8+state.upgrades.shelf*4;
    const challenge=dailyChallenge();
    const cost=marketPrice(item)*customer.quantity;
    const expectedProfit=Math.max(0,customer.offer-cost);

    $("dayNo").textContent=localNumber(state.day);
    $("cash").textContent=money(state.cash);
    $("rep").textContent=state.rep+"%";
    $("sales").textContent=localNumber(state.sales);
    $("soundBtn").textContent=state.sound?"🔊":"🔇";
    $("missionEmoji").textContent=challenge.emoji;
    $("missionTitle").textContent=challenge.title;
    $("missionCount").textContent=challengeCount(challenge);
    $("missionFill").style.width=challengePercent(challenge)+"%";
    $("event").innerHTML="<span>"+event.emoji+"</span><p><strong>"+event.n[state.lang]+"</strong><small>"+event.d[state.lang]+"</small></p>";
    $("sign").classList.toggle("famous",state.upgrades.sign>0);
    $("storeName").textContent=t("storeName");
    $("signLine").textContent=state.upgrades.sign?t("famousStore",{level:localNumber(state.upgrades.sign)}):t("welcomeSign");
    $("slogan").textContent=t("slogan");
    $("customerName").textContent=who.n[state.lang];
    $("customerLine").textContent="“"+who.l[state.lang]+"”";
    $("productEmoji").textContent=item.emoji;
    $("productName").textContent=t("quantity",{n:localNumber(customer.quantity),item:productName(item)});
    $("avatar").textContent=who.emoji;
    $("offer").textContent=money(customer.offer);
    $("profit").textContent="+"+money(expectedProfit);
    $("currentStock").textContent=localNumber(state.stock[item.id]);
    $("visitCount").textContent=localNumber(Math.min(state.visits+1,DAILY_CUSTOMERS))+" / "+localNumber(DAILY_CUSTOMERS);
    $("dayProgress").style.width=Math.min(100,(state.visits+(state.dayComplete?0:1))/DAILY_CUSTOMERS*100)+"%";
    $("messageText").textContent=currentMessage();
    $("stockGrid").innerHTML=PRODUCTS.map(stockItem=>
      "<div class='stock-card "+(state.stock[stockItem.id]<2?"low":"")+"'><span>"+stockItem.emoji+"</span><p><strong>"+productName(stockItem)+"</strong><small>"+localNumber(state.stock[stockItem.id])+" / "+localNumber(capacity)+"</small></p></div>"
    ).join("");
    renderTimer();

    if(state.lastDay){
      $("dayTitle").textContent=t("dayComplete",{day:localNumber(state.lastDay.day)});
      $("summaryCash").textContent=money(state.cash);
      $("summaryProfit").textContent=money(state.lastDay.profit);
      $("summaryHappy").textContent=localNumber(state.lastDay.happy);
      $("summaryBill").textContent="-"+money(state.lastDay.bill);
      $("challengeResult").className="result "+(state.lastDay.passed?"win":"lose");
      $("challengeResult").textContent=t(state.lastDay.passed?"challengeWon":"challengeLost",{reward:state.lastDay.reward})+(state.lastDay.short?" "+t("billShort"):"");
      if(state.dayComplete)$("dayModal").classList.remove("hidden");
    }
    if(!state.introSeen)$("intro").classList.remove("hidden");
  }

  function drawerHeader(icon,small,title){
    return "<div class='handle'></div><div class='drawer-head'><div><span class='drawer-icon'>"+icon+"</span><p><small>"+small+"</small><strong>"+title+"</strong></p></div><button class='close' data-close>✕</button></div>";
  }

  function renderMarket(){
    const capacity=8+state.upgrades.shelf*4;
    $("drawer").innerHTML=drawerHeader("🧺",t("marketSmall"),t("marketTitle"))+
      "<p class='note'>"+t("marketNote")+"</p><div class='drawer-list'>"+
      PRODUCTS.map(item=>{
        const price=marketPrice(item);
        const trend=marketTrend(item);
        const room=capacity-state.stock[item.id];
        const canBuyOne=room>=1&&state.cash>=price;
        const canBuyThree=room>=3&&state.cash>=price*3;
        return "<div class='drawer-card'><span class='drawer-art'>"+item.emoji+"</span><div class='drawer-copy'><strong>"+productName(item)+"</strong><small>"+
          t("currentStock",{stock:localNumber(state.stock[item.id]),cap:localNumber(capacity)})+"</small><small style='color:"+trend.color+"'>"+
          t("unitPrice",{price,trend:t(trend.key)})+"</small></div><div class='buy-group'><button class='buy' data-buy='"+item.id+"' data-amount='1' "+(!canBuyOne?"disabled":"")+">"+
          (room<1?t("full"):t("buyOne"))+"<br>₨"+price+"</button><button class='buy' data-buy='"+item.id+"' data-amount='3' "+(!canBuyThree?"disabled":"")+">"+
          t("buyThree")+"<br>₨"+(price*3)+"</button></div></div>";
      }).join("")+"</div>";
  }

  function renderUpgrades(){
    $("drawer").innerHTML=drawerHeader("⬆️",t("upgradeSmall"),t("upgradeTitle"))+"<div class='drawer-list'>"+
      Object.keys(UPGRADES).map(key=>{
        const upgrade=UPGRADES[key];
        const level=state.upgrades[key];
        const price=upgrade.cost+level*550;
        return "<div class='drawer-card'><span class='drawer-art'>"+upgrade.emoji+"</span><div class='drawer-copy'><strong>"+upgrade.n[state.lang]+"</strong><small>"+
          upgrade.b[state.lang]+" • "+t("level",{level:localNumber(level)})+"</small><div class='levels'>"+[1,2,3].map(number=>"<i class='"+(number<=level?"on":"")+"'></i>").join("")+
          "</div></div><button class='buy' data-up='"+key+"' "+(level>=3||state.cash<price?"disabled":"")+">"+(level>=3?t("maxed"):"₨"+price)+"</button></div>";
      }).join("")+"</div>";
  }

  function renderChallenges(){
    const challenge=dailyChallenge();
    const completed=state.dayComplete&&challenge.passed;
    $("drawer").innerHTML=drawerHeader("🎯",t("challengeSmall"),t("challengeTitle"))+
      "<div class='drawer-card daily'><span class='drawer-art'>"+challenge.emoji+"</span><div class='drawer-copy'><strong>"+t("dailyMission")+": "+challenge.title+"</strong><small>"+
      challenge.detail+" • "+t("reward",{reward:challenge.reward})+"</small><div class='goal-track'><i style='width:"+challengePercent(challenge)+"%'></i></div><span class='goal-count'>"+
      challengeCount(challenge)+"</span></div><button class='buy "+(completed?"green":"")+"' disabled>"+(completed?t("missionComplete"):t("missionPending"))+"</button></div>"+
      "<h3 class='section-label'>"+t("achievements")+"</h3><div class='drawer-list'>"+
      achievements().map(goal=>{
        const complete=goal.value>=goal.target;
        const claimed=state.claimed.includes(goal.id);
        const percent=Math.min(100,goal.value/goal.target*100);
        return "<div class='drawer-card'><span class='drawer-art'>"+goal.emoji+"</span><div class='drawer-copy'><strong>"+goal.title+"</strong><small>"+goal.detail+
          "</small><div class='goal-track'><i style='width:"+percent+"%'></i></div><span class='goal-count'>"+Math.min(goal.value,goal.target).toLocaleString("en-PK")+" / "+goal.target.toLocaleString("en-PK")+
          "</span></div><button class='buy "+(complete?"green":"")+"' data-claim='"+goal.id+"' "+(!complete||claimed?"disabled":"")+">"+(claimed?t("claimed"):t("claim",{reward:goal.reward}))+"</button></div>";
      }).join("")+"</div>";
  }

  function renderNegotiation(){
    const options=[
      {extra:.05,key:"safe",emoji:"🤝"},
      {extra:.12,key:"smart",emoji:"🧠"},
      {extra:.22,key:"bold",emoji:"🔥"}
    ];
    $("drawer").innerHTML=drawerHeader("↗",t("negotiateSmall"),t("negotiateTitle"))+"<p class='note'>"+t("negotiateNote")+"</p><div class='deal-options'>"+
      options.map((option,index)=>{
        const ask=Math.ceil(state.customer.offer*(1+option.extra));
        const chance=Math.round(negotiationChance(option.extra)*100);
        return "<button class='deal-option "+(index===2?"risky":"")+"' data-neg='"+option.extra+"'><span>"+option.emoji+"</span><p><strong>"+t(option.key)+" • "+money(ask)+
          "</strong><small>"+t("extra",{n:Math.round(option.extra*100)})+"</small></p><b>"+t("successChance",{n:chance})+"</b></button>";
      }).join("")+"</div>";
  }

  function renderSettings(){
    $("drawer").innerHTML=drawerHeader("🌐",t("settingsSmall"),t("settingsTitle"))+
      "<h3 class='section-label'>"+t("chooseLanguage")+"</h3><div class='choice-grid'>"+
      "<button class='choice "+(state.lang==="ur"?"active":"")+"' data-lang='ur'>اردو</button>"+
      "<button class='choice "+(state.lang==="hi"?"active":"")+"' data-lang='hi'>हिन्दी</button>"+
      "<button class='choice "+(state.lang==="en"?"active":"")+"' data-lang='en'>English</button></div>"+
      "<h3 class='section-label'>"+t("chooseDifficulty")+"</h3><div class='choice-grid'>"+
      difficultyButton("easy","easy","easyHint")+difficultyButton("normal","standard","standardHint")+difficultyButton("hard","hard","hardHint")+"</div>"+
      "<p class='note' style='margin-top:10px'>"+t("difficultyNote")+"</p><button class='reset' data-reset>"+t("reset")+"</button>";
  }

  function difficultyButton(value,label,hint){
    return "<button class='choice "+(state.difficulty===value?"active":"")+"' data-diff='"+value+"'>"+t(label)+"<small>"+t(hint)+"</small></button>";
  }

  function openDrawer(tab){
    if(state.dayComplete&&tab==="negotiate")return toast(t("paused"));
    activeDrawer=tab;
    document.querySelectorAll(".nav button").forEach(button=>{
      button.classList.toggle("active",tab!=="settings"&&tab!=="negotiate"&&button.dataset.tab===tab);
    });
    if(tab==="shop")return closeDrawer();
    $("shade").classList.remove("hidden");
    $("drawer").classList.remove("hidden");
    if(tab==="market")renderMarket();
    else if(tab==="upgrades")renderUpgrades();
    else if(tab==="challenges")renderChallenges();
    else if(tab==="negotiate")renderNegotiation();
    else renderSettings();
    bindDrawer();
  }

  function bindDrawer(){
    const close=document.querySelector("[data-close]");
    if(close)close.onclick=closeDrawer;
    document.querySelectorAll("[data-buy]").forEach(button=>button.onclick=()=>buyStock(button.dataset.buy,Number(button.dataset.amount)));
    document.querySelectorAll("[data-up]").forEach(button=>button.onclick=()=>buyUpgrade(button.dataset.up));
    document.querySelectorAll("[data-claim]").forEach(button=>button.onclick=()=>claimReward(button.dataset.claim));
    document.querySelectorAll("[data-neg]").forEach(button=>button.onclick=()=>negotiate(Number(button.dataset.neg)));
    document.querySelectorAll("[data-lang]").forEach(button=>button.onclick=()=>setLanguage(button.dataset.lang));
    document.querySelectorAll("[data-diff]").forEach(button=>button.onclick=()=>setDifficulty(button.dataset.diff));
    const reset=document.querySelector("[data-reset]");
    if(reset)reset.onclick=resetGame;
  }

  function closeDrawer(){
    activeDrawer="shop";
    $("shade").classList.add("hidden");
    $("drawer").classList.add("hidden");
    document.querySelectorAll(".nav button").forEach(button=>button.classList.toggle("active",button.dataset.tab==="shop"));
  }

  function timerPaused(){
    const introOpen=!$("intro").classList.contains("hidden");
    const drawerPauses=!$("drawer").classList.contains("hidden")&&activeDrawer!=="negotiate";
    return state.dayComplete||introOpen||drawerPauses||document.hidden;
  }

  function tick(){
    if(timerPaused()||!state.customer)return;
    state.customer.time=Math.max(0,state.customer.time-1);
    renderTimer();
    if(activeDrawer==="negotiate"&&!$("drawer").classList.contains("hidden")){
      renderNegotiation();
      bindDrawer();
    }
    if(state.customer.time<=0)customerTimedOut();
    else if(state.customer.time%5===0)save();
  }

  $("accept").onclick=acceptOffer;
  $("bargain").onclick=()=>openDrawer("negotiate");
  $("refuse").onclick=refuseCustomer;
  $("nextDay").onclick=startNextDay;
  $("shade").onclick=closeDrawer;
  $("langBtn").onclick=()=>openDrawer("settings");
  $("soundBtn").onclick=()=>{state.sound=!state.sound;save();render();tone("coin")};
  $("startGame").onclick=()=>{state.introSeen=true;save();$("intro").classList.add("hidden");tone("up")};
  document.querySelectorAll("[data-tab]").forEach(button=>button.onclick=()=>openDrawer(button.dataset.tab));
  document.querySelectorAll("[data-open]").forEach(button=>button.onclick=()=>openDrawer(button.dataset.open));
  document.querySelectorAll("[data-intro-lang]").forEach(button=>button.onclick=()=>setLanguage(button.dataset.introLang));
  document.addEventListener("visibilitychange",save);
  window.addEventListener("beforeunload",save);
  setInterval(tick,1000);
  render();
})();
