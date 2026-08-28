# Bazaar Boss — انٹرنیشنل گیم پلان

تاریخِ تحقیق: 28 اگست 2026  
مقصد: پاکستانی شناخت برقرار رکھتے ہوئے ایسی موبائل 3D سپرمارکیٹ مینجمنٹ گیم بنانا جو بین الاقوامی کھلاڑی سمجھ سکیں، دیر تک کھیلیں، اور اعتماد کے ساتھ خرید سکیں۔

## بنیادی فیصلہ

Bazaar Boss کو کسی دوسری گیم کی نقل نہیں بنانا۔ کامیاب supermarket simulators کا سمجھ میں آنے والا loop لینا ہے—مال خریدیں، ٹرک سے منگوائیں، شیلف بھریں، قیمت لگائیں، کسٹمر کو checkout کریں، عملہ رکھیں اور اسٹور بڑھائیں—مگر اس کی اپنی پہچان پاکستانی منڈی، بھاؤ تاؤ، مقامی برانڈز، اردو/ہندی/انگلش، ٹرک اور الگ کاروباری بجٹ ہوں گے۔

## مارکیٹ ریسرچ

| حوالہ گیم | نمایاں نظام | Bazaar Boss کے لیے نتیجہ |
|---|---|---|
| [Store Manager Simulator 3D](https://play.google.com/store/apps/details?id=com.dmg.supermarket.simulator) | آزاد store customization، نئی products/services، expansion اور staff management | لمبے عرصے کے کھیل کے لیے صرف checkout کافی نہیں؛ unlocks، visual growth اور staff progression ضروری ہیں |
| [Supermarket Simulator](https://play.google.com/store/apps/details?id=com.nokope.supermarket.simulator) | shelf stocking، prices، checkout، orders، staff، expansion اور store design | ہر کام کا واضح physical feedback چاہیے: خالی/بھری shelf، ہاتھ/ٹرالی، scanner اور cash result |
| [My Supermarket Simulator 3D](https://play.google.com/store/apps/details?id=com.playspare.supermarket.store.simulator) | mobile-first supermarket expansion | چھوٹے فون پر readable controls، مختصر onboarding اور stable save بنیادی معیار ہیں |

28 اگست 2026 کے Play Store review audit میں بار بار سامنے آنے والی شکایات یہ تھیں: lag/گرم فون، چھوٹے بٹن، save ضائع ہونا، غیر فطری customers، checkout حساب میں خرابی، اور بلاوجہ انتظار۔ Bazaar Boss کے acceptance tests میں انہی خطرات کو پہلے پکڑنا ہے۔

## موجودہ v13 میں لاگو کیے گئے اصول

- کرداروں کی حقیقی قد کی حد: خواتین تقریباً 1.68m، مرد تقریباً 1.78m؛ superhero/alien جیسا 2.68m scale ختم۔
- خواتین کی bun/braid سر کے پیچھے؛ چہرے یا ماتھے کے آگے کوئی ponytail نہیں۔
- کسٹمر، cashier، labourer اور restocker کے سر پر floating tags نہیں۔
- ہر product category اپنی رنگین physical 3D gallery، shelf، product board، brands، unit اور price رکھتی ہے۔
- بڑا 42m-wide store، کشادہ راستے اور checkout کو الگ جگہ۔
- shopping trolley کا handle انسانی ہاتھوں کی اونچائی پر اور دونوں hand bones کے درمیان align۔
- stockroom کے پاس الگ functional stock trolley؛ crate ہاتھ میں لٹکانے کے بجائے trolley پر load ہوتا ہے۔
- scanner پر ہی quantity، item، brand اور مکمل price ظاہر ہوتے ہیں۔
- startup پر صرف 3D English Bazaar Boss logo، Language، Easy/Hard اور Start؛ settings کے اندر صرف Language۔

## گیم کا مطلوبہ core loop

1. اگلی گلی کی منڈی میں جائیں اور قیمت پر بھاؤ تاؤ کریں۔
2. خریدا مال truck cargo میں load کریں۔
3. کاروباری بجٹ سے driver/freight اور labourers ادا کریں۔
4. stockroom سے crate کو stock trolley پر رکھیں۔
5. صحیح category gallery کی shelf بھریں۔
6. customer خود product اٹھائے اور queue میں آئے۔
7. scanner quantity، brand اور price دکھائے؛ sale fund میں رقم آئے۔
8. prices، staff، cleanliness، capacity، decor اور side businesses بہتر کریں۔
9. store visually بڑا اور مصروف ہو، مگر controls اور screen صاف رہیں۔

## Easy اور Hard میں حقیقی فرق

| نظام | Easy | Hard |
|---|---:|---:|
| روزانہ customers | 50 | 60 |
| target ratio | 72% | 82% |
| روزانہ expense multiplier | 0.78× | 1.24× |
| مقصد | نئے کھلاڑی کو systems سکھانا | experienced player کو queue، stock اور cash pressure دینا |

Difficulty صرف آغاز پر منتخب ہوگی۔ Settings میں اسے رکھنا نہیں، تاکہ کھلاڑی غلطی سے جاری economy نہ بدل دے۔ مستقبل میں نئی difficulty نئی save slot کے ساتھ شروع ہونی چاہیے۔

## بین الاقوامی معیار کے لیے art direction

- **شکل:** stylized-real humans؛ واضح آنکھیں، ناک، منہ، قدرتی shoulders، مختلف skin tones، عمر اور body shapes۔
- **لباس:** پاکستانی shalwar kameez، dupatta، cashier uniform، safety vest؛ clothing ہمیشہ skeleton bones کے ساتھ animate ہو۔
- **حرکت:** walk، sprint، push، pickup، interact، sit، checkout اور driving؛ foot sliding اور elbow trolley ممنوع۔
- **UI:** دنیا کے اندر physical signs؛ screen-space tag صرف بہت قریب interactable جگہ کے لیے۔
- **کیمرہ:** player، cart اور اگلی aisle ایک ساتھ نظر آئیں؛ walls یا giant characters view block نہ کریں۔
- **audio:** market ambience، trolley wheels، scanner beep، cash، footsteps؛ الگ mute/settings بعد میں تبھی جب UI spec میں منظور ہو۔

Character base Quaternius Universal Base Characters کے humanoid rig اور CC0 license پر ہے۔ [اصل asset page](https://quaternius.com/packs/universalbasecharacters.html) کے مطابق models مشترک humanoid skeleton اور animation library کے لیے بنے ہیں؛ shipped attribution/CC0 notice repository میں رہنا چاہیے۔

## performance اور Android quality budget

[Android کی سرکاری رہنمائی](https://developer.android.com/games/optimize/framerate) average 60 FPS کے ساتھ P90/P99 frame stability ناپنے پر زور دیتی ہے۔ صرف average FPS pass سمجھنا درست نہیں۔ Release gate:

- mid-range Android: 60 FPS target، P90 کم از کم 55، P99 کم از کم 48؛ sustained 10-minute store rush test۔
- low-end Android: stable 30 FPS quality mode، input latency اور scanner response برقرار۔
- DOM world labels کی تعداد انتہائی کم؛ customer/shelf labels صفر۔
- repeated products/shelf props کو اگلے مرحلے میں [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html) سے draw-call batch کرنا۔
- texture atlas، 1K maximum character textures، compressed WebP/KTX2، visible-object culling اور pooled customers/carts۔
- Android vitals میں crash/ANR، slow sessions، memory اور battery review؛ [Play Console app quality guidance](https://support.google.com/googleplay/android-developer/answer/13965279?hl=en) کے مطابق staged rollout۔
- 2027 کی آئندہ Play technical quality requirements کے لیے memory اور code optimization پہلے سے track کرنا: [Play technical quality requirements](https://support.google.com/googleplay/android-developer/answer/17492799?hl=en)।

## کمائی کا محفوظ ماڈل

پہلی international release کے لیے تجویز:

1. free playable first store/day، تاکہ player performance اور controls خود آزما سکے؛
2. ایک واضح one-time **Full Bazaar Boss** unlock؛
3. بعد میں optional cosmetic store themes؛
4. forced interstitial ads، pay-to-scan، energy timer یا ضروری stock کے loot boxes نہیں؛ یہ core simulation اور ratings دونوں کو نقصان پہنچاتے ہیں؛
5. purchase restore، family-safe privacy disclosure، age rating اور regional price tiers launch checklist کا حصہ ہوں۔

## مطالعہ سے اختیار کیے گئے اصول

- [Game Design Workshop](https://www.gamedesignworkshop.com/) — playcentric prototypes اور بار بار حقیقی players سے test؛ ہر feature پہلے measurable player experience حل کرے۔
- [The Art of Game Design](https://schellgames.com/art-of-game-design) — challenge، economy، clarity، community اور player motivation کو مختلف “lenses” سے پرکھنا۔
- [Game Programming Patterns](https://gameprogrammingpatterns.com/) — state، update loop، object pooling اور decoupled systems سے قابلِ توسیع code؛ یہ کتاب قانونی طور پر online دستیاب ہے۔
- *Level Up! The Guide to Great Video Game Design* — readable actions، camera، levels اور marketable core idea؛ ہر mechanic کو player-facing verb میں بیان کرنا۔

## اگلے production milestones

### M1 — Human & store quality gate

- کم از کم 12 واضح مختلف human faces/body silhouettes؛ child characters شامل نہ ہوں۔
- trolley hand IK/animation phone پر visual QA۔
- ہر gallery تک customer اور stock trolley collision-free پہنچے۔
- Urdu/Hindi/English text clipping صفر۔

### M2 — International vertical slice

- ایک مکمل 20–30 minute day: market → truck → stock → sell → upgrade۔
- save slots، autosave recovery اور corrupt-save fallback۔
- tutorial کو عمل کے دوران سکھانا؛ لمبی instruction list نہیں۔
- English store/name defaults اور optional Pakistan theme onboarding۔

### M3 — Retention & economy

- سات دن کا event cycle، unlock tree، store expansion zones، staff schedules اور achievements۔
- economy simulation کے کم از کم 1,000 automated days؛ dead-end cash اور impossible targets صفر۔
- Easy اور Hard completion/failure telemetry الگ۔

### M4 — Release candidate

- 10+ physical Android devices، 3 RAM classes، 30/60 FPS profiles۔
- internal → closed → open test؛ crash, ANR, P90/P99, save restore اور purchase restore gates۔
- localized screenshots/video، privacy policy، content rating، store listing اور staged rollout۔

## “کام مکمل” کی تعریف

صرف APK بن جانا کافی نہیں۔ Release تب مکمل ہوگی جب کردار انسان نظر آئیں، ہاتھ ٹرالی پر ہوں، کوئی head-tag clutter نہ ہو، scan کا حساب درست ہو، 15 galleries قابلِ استعمال ہوں، save واپس آئے، low-end phone پر stable رہے، اور نئے player کو بغیر بیرونی وضاحت کے پہلے دس منٹ کا loop سمجھ آ جائے۔
